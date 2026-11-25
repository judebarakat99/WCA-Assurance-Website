// Reads an uploaded file into pages of text for the agent: PDFs through lib/intake/pdfText, text and Markdown as they are.
import { extractPdfText } from "@/lib/intake/pdfText.mjs";

/** { pages: [{ n, text }], pageCount, readable } for a File. Never throws. */
export async function readDocument(file) {
  const name = String(file?.name || "").toLowerCase();
  try {
    if (name.endsWith(".pdf")) {
      const r = await extractPdfText(await file.arrayBuffer());
      return { pages: r.pages, pageCount: r.pageCount, readable: r.readable };
    }
    const text = await file.text();
    return { pages: [{ n: 1, text }], pageCount: 1, readable: /[A-Za-z]{3}/.test(text) };
  } catch {
    return { pages: [], pageCount: 0, readable: false };
  }
}
