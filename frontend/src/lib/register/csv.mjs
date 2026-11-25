// Minimal CSV reader and writer (RFC 4180): quoted fields, doubled quotes, line breaks inside quotes.
// Shared by the build script (Node) and the browser export, so both read and write the same format.

/** Parse CSV text into an array of objects keyed by the header row. */
export function parseCsv(text) {
  const src = String(text).replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); if (row.length > 1 || row[0] !== "") rows.push(row); }
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r, n) => {
    if (r.length !== header.length) throw new Error(`CSV row ${n + 2} has ${r.length} fields; expected ${header.length}`);
    return Object.fromEntries(header.map((h, k) => [h, r[k]]));
  });
}

const needsQuote = (s) => /[",\r\n]/.test(s) || /^\s|\s$/.test(s);
const cell = (v) => {
  const s = v == null ? "" : String(v);
  return needsQuote(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Serialise objects to CSV text with the given column order. A BOM keeps Excel reading UTF-8 correctly. */
export function toCsv(fields, rows, { bom = true } = {}) {
  const lines = [fields.map(cell).join(",")];
  for (const r of rows) lines.push(fields.map((f) => cell(r[f])).join(","));
  return (bom ? "\uFEFF" : "") + lines.join("\r\n") + "\r\n";
}
