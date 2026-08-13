import express from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { extractResumeText } from "../services/parseService.js";
import { extractResumeStructuredData, scoreResumeATS } from "../services/claudeService.js";
import { getOrCreateSession, updateSession, getSession } from "../session/sessionStore.js";

const router = express.Router();

function buildFallbackParsedJson(rawText) {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const name = lines[0] || null;

  return {
    name,
    education: [],
    skills: [],
    workExperience: [],
    projects: [],
    certifications: [],
    achievements: []
  };
}

// Multer: memory storage only — file buffer is never written to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("UNSUPPORTED_FILE_TYPE"));
    }
    cb(null, true);
  }
});

// Simple in-memory rate limiter: max 5 uploads per sessionId per hour.
const uploadCounts = new Map(); // sessionId -> { count, windowStart }
function isRateLimited(sessionId) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const entry = uploadCounts.get(sessionId);
  if (!entry || now - entry.windowStart > windowMs) {
    uploadCounts.set(sessionId, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > 5;
}

// POST /api/resume/upload
// Accepts multipart/form-data with field "resume". Returns sessionId + parsed data + ATS score.
router.post("/upload", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "NO_FILE_PROVIDED" });
    }

    // sessionId: reuse if client sent one, otherwise mint a new one
    const sessionId = req.body.sessionId || uuidv4();

    if (isRateLimited(sessionId)) {
      return res.status(429).json({
        error: "RATE_LIMITED",
        message: "Too many uploads. Please wait before trying again."
      });
    }

    getOrCreateSession(sessionId);

    // Step 1: extract raw text from the file
    let rawText;
    try {
      rawText = await extractResumeText(req.file.buffer, req.file.mimetype, req.file.originalname);
    } catch (err) {
      if (err.message === "EMPTY_TEXT_LAYER") {
        return res.status(422).json({
          error: "EMPTY_TEXT_LAYER",
          message:
            "We couldn't read any text from this file — it may be a scanned image. Try a text-based PDF/DOCX, or enter your details manually."
        });
      }
      if (err.message === "UNSUPPORTED_FILE_TYPE") {
        return res.status(415).json({ error: "UNSUPPORTED_FILE_TYPE" });
      }
      return res.status(422).json({
        error: "PARSE_FAILED",
        message: "This file looks corrupted or unreadable. Please try re-exporting it and upload again."
      });
    }

    // Step 2: structured extraction via Claude (with one retry on failure)
    const targetRole = req.body.targetRole || null;
    let parsedJson = buildFallbackParsedJson(rawText);
    let aiExtractionFailed = false;
    try {
      parsedJson = await extractResumeStructuredData(rawText);
    } catch (err) {
      try {
        parsedJson = await extractResumeStructuredData(rawText); // retry once
      } catch (err2) {
        aiExtractionFailed = true;
      }
    }

    // Step 3: ATS scoring via Claude (with one retry on failure)
    let atsResult;
    try {
      atsResult = await scoreResumeATS(rawText, parsedJson, targetRole);
    } catch (err) {
      try {
        atsResult = await scoreResumeATS(rawText, parsedJson, targetRole);
      } catch (err2) {
        // Degrade gracefully: still return parsed resume even if ATS scoring fails
        console.error("ATS scoring failed after retry:", err2);
        atsResult = null;
      }
    }

    const resumeData = {
      rawText,
      parsedJson,
      atsScore: atsResult?.overallScore ?? null,
      atsBreakdown: atsResult?.breakdown ?? null,
      strengths: atsResult?.strengths ?? [],
      weaknesses: atsResult?.weaknesses ?? [],
      suggestions: atsResult?.suggestions ?? [],
      aiExtractionFailed,
      atsScoringFailed: atsResult === null
    };

    updateSession(sessionId, { resumeData });

    return res.status(200).json({
      sessionId,
      resumeData
    });
  } catch (err) {
    console.error("Unhandled error in /resume/upload:", err);
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Something went wrong processing your resume. Please try again."
    });
  }
});

// GET /api/resume/:sessionId
// Fetch the currently stored resume data for a session (used on page reload/recovery).
router.get("/:sessionId", (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session || !session.resumeData) {
    return res.status(404).json({ error: "SESSION_NOT_FOUND" });
  }
  return res.status(200).json({ sessionId: session.sessionId, resumeData: session.resumeData });
});

// Multer error handler (file too large, wrong type, etc.)
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "FILE_TOO_LARGE", message: "Resume must be under 5MB." });
    }
    return res.status(400).json({ error: "UPLOAD_ERROR", message: err.message });
  }
  if (err && err.message === "UNSUPPORTED_FILE_TYPE") {
    return res.status(415).json({
      error: "UNSUPPORTED_FILE_TYPE",
      message: "Only PDF and DOCX files are supported."
    });
  }
  next(err);
});

export default router;
