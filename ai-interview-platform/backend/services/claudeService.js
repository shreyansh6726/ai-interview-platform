const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
// llama-3.1-70b-versatile was retired by Groq. Keep this overrideable so the
// model can be changed without editing code when Groq updates availability.
const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

// Strips markdown code fences if the model wraps JSON in ```json ... ```
function cleanJson(text) {
  return text.replace(/```json\s*|```\s*/g, "").trim();
}

async function callClaudeJson(systemPrompt, userPrompt, maxTokens = 2000) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("MISSING_GROQ_API_KEY");
  }

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      temperature: 0.1,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GROQ_API_ERROR: ${response.status} ${errorBody.slice(0, 1000)}`);
  }

  const payload = await response.json();
  const text = payload?.choices?.[0]?.message?.content;
  if (!text) throw new Error("NO_TEXT_RESPONSE");

  try {
    return JSON.parse(cleanJson(text));
  } catch (e) {
    throw new Error("INVALID_JSON_FROM_MODEL");
  }
}

// Extracts structured resume data from raw resume text.
async function extractResumeStructuredData(rawText) {
  const systemPrompt = `You are a resume parsing engine. Extract structured information from the resume text provided.
Return ONLY valid JSON, no markdown fences, no preamble, no explanation. Match this exact schema:

{
  "name": string | null,
  "education": [{ "degree": string, "institution": string, "year": string | null }],
  "skills": [string],
  "workExperience": [{ "role": string, "company": string, "duration": string | null, "description": string }],
  "projects": [{ "title": string, "description": string, "technologies": [string] }],
  "certifications": [string],
  "achievements": [string]
}

If a section is missing from the resume, return an empty array for it. Never invent information not present in the resume text.`;

  const userPrompt = `Resume text:\n\n${rawText}`;

  return callClaudeJson(systemPrompt, userPrompt, 3000);
}

// Produces an ATS-style score and breakdown for the resume.
async function scoreResumeATS(rawText, parsedJson, targetRole = null) {
  const systemPrompt = `You are an ATS (Applicant Tracking System) evaluation engine. Assess the resume text for how well it would perform when parsed and ranked by real ATS software${
    targetRole ? ` for a "${targetRole}" role` : ""
  }.
Return ONLY valid JSON, no markdown fences, no preamble. Match this exact schema:

{
  "overallScore": number (0-100),
  "breakdown": {
    "skillsMatch": number (0-100),
    "keywordOptimization": number (0-100),
    "formatting": number (0-100),
    "experienceRelevance": number (0-100),
    "resumeStructure": number (0-100)
  },
  "strengths": [string],
  "weaknesses": [string],
  "suggestions": [string]
}

Be specific and actionable in suggestions (e.g. "Add measurable outcomes to the DecodeLab internship bullet" rather than "improve experience section"). Base scores only on the actual content provided.`;

  const userPrompt = `Resume text:\n\n${rawText}\n\nParsed structured data:\n\n${JSON.stringify(
    parsedJson,
    null,
    2
  )}`;

  return callClaudeJson(systemPrompt, userPrompt, 2000);
}

export { extractResumeStructuredData, scoreResumeATS };
