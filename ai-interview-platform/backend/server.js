import "dotenv/config";
import express from "express";
import cors from "cors";
import resumeRoutes from "./routes/resume.js";

const app = express();
const PORT = process.env.PORT || 5000;

if (!process.env.GROQ_API_KEY) {
  console.warn(
    "⚠️  GROQ_API_KEY is not set. Add it to backend/.env before uploading a resume."
  );
}

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/resume", resumeRoutes);

// Fallback error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "INTERNAL_ERROR", message: "Unexpected server error." });
});

app.listen(PORT, () => {
  console.log(`AI Interview backend running on http://localhost:${PORT}`);
});
