import { useEffect, useState } from "react";
import UploadResume from "./components/UploadResume.jsx";
import AtsScoreCard from "./components/AtsScoreCard.jsx";
import { getSessionId, getCachedResumeData, fetchResumeForSession, clearSession } from "./api/client.js";

export default function App() {
  const [resumeData, setResumeData] = useState(null);
  const [recovering, setRecovering] = useState(true);

  // On load, try to recover an in-progress session (backend memory OR localStorage cache)
  useEffect(() => {
    async function recover() {
      const sessionId = getSessionId();
      if (!sessionId) {
        setRecovering(false);
        return;
      }
      const fromBackend = await fetchResumeForSession(sessionId);
      if (fromBackend) {
        setResumeData(fromBackend.resumeData);
      } else {
        const cached = getCachedResumeData();
        if (cached) setResumeData(cached);
      }
      setRecovering(false);
    }
    recover();
  }, []);

  function handleReset() {
    clearSession();
    setResumeData(null);
  }

  return (
    <div className="min-h-screen bg-paper px-6 py-16">
      <header className="max-w-2xl mx-auto mb-12 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-rust mb-2">
          AI Interview Platform
        </p>
        <h1 className="font-display text-4xl text-ink">Resume Diagnostics</h1>
        <p className="font-body text-sm text-slate mt-2">
          Upload your resume for an instant ATS score, then take a personalized mock interview
          built entirely from what's on the page.
        </p>
      </header>

      {recovering ? (
        <p className="text-center font-mono text-xs uppercase tracking-widest text-slate">
          Checking for a saved session…
        </p>
      ) : resumeData ? (
        <AtsScoreCard resumeData={resumeData} onReset={handleReset} />
      ) : (
        <UploadResume onAnalyzed={(result) => setResumeData(result.resumeData)} />
      )}
    </div>
  );
}
