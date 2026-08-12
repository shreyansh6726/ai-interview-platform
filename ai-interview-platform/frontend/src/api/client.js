const SESSION_KEY = "aiInterviewSessionId";
const RESUME_DATA_KEY = "aiInterviewResumeData";

function getSessionId() {
  return localStorage.getItem(SESSION_KEY);
}

function setSessionId(id) {
  localStorage.setItem(SESSION_KEY, id);
}

function getCachedResumeData() {
  const raw = localStorage.getItem(RESUME_DATA_KEY);
  return raw ? JSON.parse(raw) : null;
}

function setCachedResumeData(data) {
  localStorage.setItem(RESUME_DATA_KEY, JSON.stringify(data));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(RESUME_DATA_KEY);
}

async function uploadResume(file, targetRole) {
  const formData = new FormData();
  formData.append("resume", file);
  const existingSessionId = getSessionId();
  if (existingSessionId) formData.append("sessionId", existingSessionId);
  if (targetRole) formData.append("targetRole", targetRole);

  const res = await fetch("/api/resume/upload", {
    method: "POST",
    body: formData
  });

  const data = await res.json();

  if (!res.ok) {
    const error = new Error(data.message || data.error || "UPLOAD_FAILED");
    error.code = data.error;
    throw error;
  }

  setSessionId(data.sessionId);
  setCachedResumeData(data.resumeData);
  return data;
}

async function fetchResumeForSession(sessionId) {
  const res = await fetch(`/api/resume/${sessionId}`);
  if (!res.ok) return null;
  const data = await res.json();
  setCachedResumeData(data.resumeData);
  return data;
}

export {
  getSessionId,
  setSessionId,
  getCachedResumeData,
  setCachedResumeData,
  clearSession,
  uploadResume,
  fetchResumeForSession
};
