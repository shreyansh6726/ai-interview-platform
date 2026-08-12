// In-memory session store. No database — sessions live in a Map keyed by sessionId.
// Each session holds: resumeData, questions[], answers[], interview status/timing.
// Sessions auto-expire after INACTIVITY_TIMEOUT_MS of no activity to avoid memory leaks.

const sessions = new Map();

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

function createSession(sessionId) {
  const session = {
    sessionId,
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    resumeData: null, // { rawText, parsedJson, atsScore, atsBreakdown, atsSuggestions }
    interview: {
      status: "not_started", // not_started | in_progress | completed
      startedAt: null,
      endedAt: null,
      questions: [],
      answers: [],
      report: null
    }
  };
  sessions.set(sessionId, session);
  return session;
}

function getSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  session.lastActiveAt = Date.now();
  return session;
}

function getOrCreateSession(sessionId) {
  return getSession(sessionId) || createSession(sessionId);
}

function updateSession(sessionId, patch) {
  const session = getSession(sessionId);
  if (!session) return null;
  Object.assign(session, patch);
  session.lastActiveAt = Date.now();
  return session;
}

function deleteSession(sessionId) {
  sessions.delete(sessionId);
}

// Sweep expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.lastActiveAt > INACTIVITY_TIMEOUT_MS) {
      sessions.delete(id);
    }
  }
}, 10 * 60 * 1000); // check every 10 min

export { createSession, getSession, getOrCreateSession, updateSession, deleteSession };
