import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import mammoth from "mammoth";

async function extractPdfText(fileBuffer) {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(fileBuffer),
    // Suppresses the standardFontDataUrl warning; not needed for text extraction.
    disableFontFace: true
  });
  const doc = await loadingTask.promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item) => item.str).join(" ") + "\n";
  }
  return text.trim();
}

// Extracts raw text from an uploaded resume file buffer.
// Supports PDF and DOCX. Throws a descriptive error for unsupported/corrupt files.
async function extractResumeText(fileBuffer, mimetype, originalName) {
  const isPdf =
    mimetype === "application/pdf" || originalName.toLowerCase().endsWith(".pdf");
  const isDocx =
    mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    originalName.toLowerCase().endsWith(".docx");

  if (!isPdf && !isDocx) {
    throw new Error("UNSUPPORTED_FILE_TYPE");
  }

  try {
    if (isPdf) {
      const text = await extractPdfText(fileBuffer);
      if (text.length < 40) {
        // Likely a scanned/image-only PDF with no extractable text layer
        throw new Error("EMPTY_TEXT_LAYER");
      }
      return text;
    }

    if (isDocx) {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      const text = (result.value || "").trim();
      if (text.length < 40) {
        throw new Error("EMPTY_TEXT_LAYER");
      }
      return text;
    }
  } catch (err) {
    if (err.message === "EMPTY_TEXT_LAYER") throw err;
    throw new Error("PARSE_FAILED");
  }
}

export { extractResumeText };
