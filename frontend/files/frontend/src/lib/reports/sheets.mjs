// The report as spreadsheet sheets: one sheet per section, with KPIs and facts turned into small tables.
// The workbook writer and the on-screen preview both read this, so the preview shows what the file contains.
import { columnsFor } from "@/lib/reports/model.mjs";

const clean = (name) => String(name).replace(/[\[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31) || "Sheet";

/** [{ name, blocks }] where each block is a "table" ({ title, columns, rows }) or a "text" ({ text }). */
export function sheetsOf(report) {
  const used = new Set();
  return report.sections.map((section) => {
    let name = clean(section.title);
    let n = 2;
    while (used.has(name.toLowerCase())) name = `${clean(section.title).slice(0, 28)} ${n++}`;
    used.add(name.toLowerCase());
    const blocks = [];
    for (const b of section.blocks) {
      if (b.type === "kpis")
        blocks.push({
          type: "table",
          columns: [{ key: "label", label: "Measure", w: 3 }, { key: "value", label: "Value", w: 1.3 }, { key: "sub", label: "Detail", w: 3 }],
          rows: b.items.map((i) => ({ label: i.label, value: i.value, value_tone: i.tone, sub: i.sub || "" })),
        });
      else if (b.type === "facts")
        blocks.push({ type: "table", columns: [{ key: "label", label: "Item", w: 2 }, { key: "value", label: "Detail", w: 6 }], rows: b.items });
      else if (b.type === "text" || b.type === "note") blocks.push({ type: "text", text: b.text, note: b.type === "note" });
      else blocks.push({ ...b, columns: columnsFor(b, "xlsx"), rows: b.rows });
    }
    return { name, blocks };
  });
}
