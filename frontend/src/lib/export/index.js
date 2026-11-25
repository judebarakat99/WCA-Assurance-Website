// Export a report model as Word, Excel or PDF. Each renderer (and its library)
// loads only when first used, so the rest of the app stays light.
import { download } from "@/lib/export/style";

export const FORMATS = {
  docx: { label: "Word document", ext: "docx", hint: "An editable report to review and share" },
  xlsx: { label: "Excel workbook", ext: "xlsx", hint: "Every row, to filter, sort and work with" },
  pdf: { label: "PDF", ext: "pdf", hint: "A fixed layout to send or print" },
};

const RENDER = {
  docx: async (m) => (await import("@/lib/export/docx")).reportToDocx(m),
  xlsx: async (m) => (await import("@/lib/export/xlsx")).reportToXlsx(m),
  pdf: async (m) => (await import("@/lib/export/pdf")).reportToPdf(m),
};

/** Render the model and download it. Returns the file name. */
export async function exportReport(model, format) {
  const blob = await RENDER[format](model);
  const filename = `${model.filename}.${FORMATS[format].ext}`;
  download(blob, filename);
  return filename;
}

/** Render without downloading (tests). */
export const renderReport = (model, format) => RENDER[format](model);
