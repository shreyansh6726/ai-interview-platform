import { useState, useRef } from "react";
import { uploadResume } from "../api/client.js";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];

export default function UploadResume({ onAnalyzed }) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [targetRole, setTargetRole] = useState("");
  const [status, setStatus] = useState("idle"); // idle | reading | analyzing | error
  const [errorMessage, setErrorMessage] = useState("");
  const inputRef = useRef(null);

  function validateAndSetFile(candidate) {
    setErrorMessage("");
    if (!candidate) return;
    if (!ACCEPTED_TYPES.includes(candidate.type)) {
      setErrorMessage("Only PDF and DOCX files are supported.");
      return;
    }
    if (candidate.size > 5 * 1024 * 1024) {
      setErrorMessage("File is too large. Max size is 5MB.");
      return;
    }
    setFile(candidate);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    validateAndSetFile(e.dataTransfer.files?.[0]);
  }

  async function handleAnalyze() {
    if (!file) return;
    setStatus("analyzing");
    setErrorMessage("");
    try {
      const result = await uploadResume(file, targetRole.trim() || null);
      setStatus("idle");
      onAnalyzed(result);
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err.message || "Something went wrong analyzing your resume. Please try again."
      );
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative overflow-hidden border-2 border-dashed rounded-sm p-10 text-center cursor-pointer transition-colors ${
          isDragging ? "border-rust bg-rust/5" : "border-line bg-white/40"
        }`}
      >
        {status === "analyzing" && <div className="scan-line" />}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={(e) => validateAndSetFile(e.target.files?.[0])}
        />
        <p className="font-display text-2xl text-ink mb-2">
          {file ? file.name : "Drop your resume here"}
        </p>
        <p className="font-mono text-xs uppercase tracking-widest text-slate">
          {file ? `${(file.size / 1024).toFixed(0)} KB — click to replace` : "PDF or DOCX, up to 5MB"}
        </p>
      </div>

      <div className="mt-4">
        <label className="font-mono text-xs uppercase tracking-widest text-slate block mb-1">
          Target role (optional)
        </label>
        <input
          type="text"
          value={targetRole}
          onChange={(e) => setTargetRole(e.target.value)}
          placeholder="e.g. Frontend Developer"
          className="w-full border border-line bg-white/60 rounded-sm px-3 py-2 font-body text-sm text-ink focus:outline-none focus:ring-2 focus:ring-rust/40"
        />
      </div>

      {errorMessage && (
        <p className="mt-3 text-sm text-rust font-body">{errorMessage}</p>
      )}

      <button
        onClick={handleAnalyze}
        disabled={!file || status === "analyzing"}
        className="mt-5 w-full bg-ink text-paper font-display text-lg py-3 rounded-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-rust transition-colors"
      >
        {status === "analyzing" ? "Analyzing resume…" : "Run diagnostics"}
      </button>
    </div>
  );
}
