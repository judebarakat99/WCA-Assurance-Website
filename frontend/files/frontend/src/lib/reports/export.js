// Makes the file for a report and hands it to the browser. The three writers are loaded only when needed, so the
// page itself stays light.
import { FORMATS } from "@/lib/reports/model.mjs";

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
  const blob = new Blob([bytes], { type: f.mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const name = `${report.filenameBase}.${f.ext}`;
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return name;
}
