// Makes the file for a report and hands it to the browser. The three writers are loaded only when needed, so the
// page itself stays light.
import { FORMATS } from "@/lib/reports/model.mjs";
import { downloadFile } from "@/lib/ui/download";

/** The report as bytes in the given format ("docx", "xlsx" or "pdf"). */
export async function renderReport(report, format) {
  if (format === "docx") return (await import("@/lib/reports/docx.js")).renderDocx(report);
  if (format === "pdf") return (await import("@/lib/reports/pdf.js")).renderPdf(report);
  if (format === "xlsx") return (await import("@/lib/reports/xlsx.js")).renderXlsx(report);
  throw new Error(`Unknown format: ${format}`);
}

/** Make the file and download it. Returns the file name. */
export async function downloadReport(report, format) {
  const f = FORMATS.find((x) => x.id === format);
  const bytes = await renderReport(report, format);
  return downloadFile(`${report.filenameBase}.${f.ext}`, new Blob([bytes], { type: f.mime }));
}
