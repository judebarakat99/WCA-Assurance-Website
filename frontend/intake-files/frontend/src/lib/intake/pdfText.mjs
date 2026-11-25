// Reads the text of a PDF in the browser, with no library: objects and object streams, Flate-compressed
// content streams, page and font resources, and ToUnicode maps (which is how most PDFs saved from Word,
// Chrome and similar tools encode their text). Scanned PDFs, which are pictures of pages, have no text to
// read, and so do PDFs that use other encodings; for those readable is false and the caller falls back to the
// file name.
//
//   const { text, pages, pageCount, readable } = await extractPdfText(arrayBuffer);
//   pages: [{ n: 1, text: "..." }, ...]

const CP1252 = {
  0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†", 0x87: "‡", 0x88: "ˆ", 0x89: "‰", 0x8a: "Š",
  0x8b: "‹", 0x8c: "Œ", 0x8e: "Ž", 0x91: "‘", 0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—",
  0x98: "˜", 0x99: "™", 0x9a: "š", 0x9b: "›", 0x9c: "œ", 0x9e: "ž", 0x9f: "Ÿ",
};
const winAnsi = (code) => CP1252[code] ?? String.fromCharCode(code);

function latin1(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return out;
}

function ascii85(bytes) {
  const src = latin1(bytes).replace(/\s+/g, "").replace(/^<~/, "");
  const end = src.indexOf("~>");
  const text = end < 0 ? src : src.slice(0, end);
  const out = [];
  let group = [];
  const flush = (n) => {
    const pad = 5 - n;
    const g = group.concat(Array(pad).fill(84));
    let v = 0;
    for (const c of g) v = v * 85 + c;
    const four = [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
    out.push(...four.slice(0, 4 - pad));
    group = [];
  };
  for (const ch of text) {
    if (ch === "z" && group.length === 0) { out.push(0, 0, 0, 0); continue; }
    group.push(ch.charCodeAt(0) - 33);
    if (group.length === 5) flush(5);
  }
  if (group.length > 1) flush(group.length);
  return Uint8Array.from(out);
}

function asciiHex(bytes) {
  const hex = latin1(bytes).replace(/>.*$/s, "").replace(/\s+/g, "");
  const out = [];
  for (let i = 0; i < hex.length; i += 2) out.push(parseInt(hex.slice(i, i + 2).padEnd(2, "0"), 16));
  return Uint8Array.from(out);
}

async function inflate(bytes) {
  if (typeof DecompressionStream !== "function") throw new Error("This browser cannot unpack PDF streams.");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// ---------- low-level parsing ----------

/** Index just after the balanced << ... >> that starts at i. */
function dictEnd(s, i) {
  let depth = 0;
  for (let k = i; k < s.length - 1; k++) {
    if (s[k] === "<" && s[k + 1] === "<") { depth++; k++; }
    else if (s[k] === ">" && s[k + 1] === ">") { depth--; k++; if (depth === 0) return k + 1; }
  }
  return s.length;
}

/** The value after a key in a dictionary string: { dict } | { ref } | { array } | { text }, or null. */
function valueOf(dict, key) {
  const m = new RegExp(`${key}(?![A-Za-z0-9])\\s*`).exec(dict);
  if (!m) return null;
  const at = m.index + m[0].length;
  if (dict.startsWith("<<", at)) return { dict: dict.slice(at, dictEnd(dict, at)) };
  if (dict[at] === "[") return { array: dict.slice(at, dict.indexOf("]", at) + 1) };
  const r = /^(\d+)\s+\d+\s+R/.exec(dict.slice(at, at + 24));
  if (r) return { ref: Number(r[1]) };
  const t = /^\/?[^\s/<>\[\]]+/.exec(dict.slice(at, at + 60));
  return t ? { text: t[0] } : null;
}
const refsIn = (s) => [...s.matchAll(/(\d+)\s+\d+\s+R/g)].map((m) => Number(m[1]));

async function parseDocument(bytes) {
  const s = latin1(bytes);
  const objs = new Map(); // number -> { dict, start, end }
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m;
  while ((m = re.exec(s))) {
    const num = Number(m[1]);
    let p = m.index + m[0].length;
    while (/\s/.test(s[p] || "")) p++;
    let dict = "";
    let start = -1;
    let end = -1;
    if (s.startsWith("<<", p)) {
      const de = dictEnd(s, p);
      dict = s.slice(p, de);
      let q = de;
      while (/\s/.test(s[q] || "")) q++;
      if (s.startsWith("stream", q)) {
        q += 6;
        if (s[q] === "\r") q++;
        if (s[q] === "\n") q++;
        start = q;
        end = s.indexOf("endstream", q);
        if (end < 0) end = s.length;
        re.lastIndex = end;
      } else re.lastIndex = de;
    } else {
      const e = s.indexOf("endobj", p);
      dict = s.slice(p, e < 0 ? s.length : e);
      re.lastIndex = e < 0 ? s.length : e;
    }
    objs.set(num, { dict, start, end });
  }
  const streamOf = async (obj) => {
    if (!obj || obj.start < 0) return null;
    const filter = valueOf(obj.dict, "/Filter");
    const chain = [...(filter ? filter.array || filter.text || "" : "").matchAll(/\/?([A-Za-z0-9]+)/g)].map((m) => m[1]);
    const known = { FlateDecode: "flate", Fl: "flate", ASCII85Decode: "a85", A85: "a85", ASCIIHexDecode: "hex", AHx: "hex" };
    if (chain.some((f) => !known[f])) return null; // images, LZW and encrypted streams are not text we can read
    const lenV = valueOf(obj.dict, "/Length");
    let len = null;
    if (lenV?.text && /^\d+$/.test(lenV.text)) len = Number(lenV.text);
    else if (lenV?.ref && objs.get(lenV.ref)) len = Number.parseInt(objs.get(lenV.ref).dict, 10);
    const sizes = [];
    if (Number.isFinite(len)) sizes.push(len);
    sizes.push(obj.end - obj.start, obj.end - obj.start - 1, obj.end - obj.start - 2);
    for (const size of sizes) {
      try {
        let data = bytes.subarray(obj.start, obj.start + size);
        for (const f of chain) {
          const kind = known[f];
          if (kind === "flate") data = await inflate(data);
          else if (kind === "a85") data = ascii85(data);
          else data = asciiHex(data);
        }
        return data;
      } catch {
        // try the next length
      }
    }
    return null;
  };
  // Object streams hold most objects in newer PDFs.
  for (const [num, obj] of [...objs]) {
    if (!/\/Type\s*\/ObjStm/.test(obj.dict)) continue;
    const data = await streamOf(obj);
    if (!data) continue;
    const text = latin1(data);
    const n = Number(valueOf(obj.dict, "/N")?.text);
    const first = Number(valueOf(obj.dict, "/First")?.text);
    if (!(n > 0) || !(first > 0)) continue;
    const head = text.slice(0, first).trim().split(/\s+/).map(Number);
    for (let i = 0; i < n; i++) {
      const on = head[2 * i];
      const off = head[2 * i + 1];
      const next = i + 1 < n ? head[2 * i + 3] : text.length - first;
      if (Number.isFinite(on) && !objs.has(on)) objs.set(on, { dict: text.slice(first + off, first + next), start: -1, end: -1 });
    }
    void num;
  }
  return { s, objs, streamOf };
}

// ---------- fonts ----------

function parseCMap(text) {
  const map = new Map();
  let width = 1;
  for (const block of text.matchAll(/begincodespacerange([\s\S]*?)endcodespacerange/g))
    for (const h of block[1].matchAll(/<([0-9a-fA-F]+)>/g)) width = Math.max(width, Math.ceil(h[1].length / 2));
  const unit = (hex) => {
    let out = "";
    for (let i = 0; i + 3 < hex.length + 1; i += 4) out += String.fromCharCode(parseInt(hex.slice(i, i + 4).padEnd(4, "0"), 16));
    return out;
  };
  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g))
    for (const e of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) map.set(parseInt(e[1], 16), unit(e[2]));
  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const e of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(\[[^\]]*\]|<[0-9a-fA-F]+>)/g)) {
      const lo = parseInt(e[1], 16);
      const hi = parseInt(e[2], 16);
      if (e[3].startsWith("[")) {
        [...e[3].matchAll(/<([0-9a-fA-F]+)>/g)].forEach((d, k) => map.set(lo + k, unit(d[1])));
      } else {
        const base = e[3].slice(1, -1);
        const head = base.slice(0, -4);
        const tail = parseInt(base.slice(-4).padEnd(4, "0"), 16);
        for (let c = lo; c <= hi && c - lo < 65536; c++) map.set(c, unit(head + (tail + c - lo).toString(16).padStart(4, "0")));
      }
    }
  }
  return { map, width };
}

async function fontInfo(doc, num, cache) {
  if (cache.has(num)) return cache.get(num);
  const obj = doc.objs.get(num);
  let info = { cmap: null, broken: false };
  if (obj) {
    const tu = valueOf(obj.dict, "/ToUnicode");
    if (tu?.ref) {
      const data = await doc.streamOf(doc.objs.get(tu.ref));
      if (data) info.cmap = parseCMap(latin1(data));
    }
    // A composite font with no ToUnicode map has glyph numbers we cannot turn into letters.
    if (!info.cmap && /\/Subtype\s*\/Type0/.test(obj.dict)) info.broken = true;
    if (/\/Subtype\s*\/Type3/.test(obj.dict) && !info.cmap) info.broken = true;
  }
  cache.set(num, info);
  return info;
}

// ---------- pages ----------

function pageList(doc) {
  const { objs } = doc;
  const root = [...objs.values()].find((o) => /\/Type\s*\/Catalog/.test(o.dict));
  const out = [];
  const seen = new Set();
  const walk = (num) => {
    if (seen.has(num) || !objs.has(num)) return;
    seen.add(num);
    const d = objs.get(num).dict;
    const kids = valueOf(d, "/Kids");
    if (kids?.array) for (const k of refsIn(kids.array)) walk(k);
    else if (/\/Type\s*\/Page(?![a-z])/.test(d) || valueOf(d, "/Contents")) out.push(num);
  };
  const pagesRef = root && valueOf(root.dict, "/Pages")?.ref;
  if (pagesRef) walk(pagesRef);
  if (!out.length)
    for (const [num, o] of [...objs].sort((a, b) => a[0] - b[0])) if (/\/Type\s*\/Page(?![a-z])/.test(o.dict)) out.push(num);
  return out;
}

function inherited(doc, num, key) {
  let cur = num;
  for (let depth = 0; cur && depth < 12; depth++) {
    const d = doc.objs.get(cur)?.dict;
    if (!d) return null;
    const v = valueOf(d, key);
    if (v) return v;
    cur = valueOf(d, "/Parent")?.ref;
  }
  return null;
}

async function pageFonts(doc, pageNum) {
  const res = inherited(doc, pageNum, "/Resources");
  const resDict = res?.dict ?? (res?.ref ? doc.objs.get(res.ref)?.dict : "") ?? "";
  const font = valueOf(resDict || "", "/Font");
  const fontDict = font?.dict ?? (font?.ref ? doc.objs.get(font.ref)?.dict : "") ?? "";
  const names = {};
  for (const m of (fontDict || "").matchAll(/\/([^\s/<>\[\]()]+)\s+(\d+)\s+\d+\s+R/g)) names[m[1]] = Number(m[2]);
  return names;
}

function pageContent(doc, pageNum) {
  const c = valueOf(doc.objs.get(pageNum).dict, "/Contents");
  if (!c) return [];
  if (c.ref) {
    const o = doc.objs.get(c.ref);
    if (o && o.start < 0 && /^\s*\[/.test(o.dict)) return refsIn(o.dict);
    return [c.ref];
  }
  return c.array ? refsIn(c.array) : [];
}

// ---------- content streams ----------

function* tokens(str) {
  let i = 0;
  const n = str.length;
  while (i < n) {
    const ch = str[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === "%") { while (i < n && str[i] !== "\n" && str[i] !== "\r") i++; continue; }
    if (ch === "(") {
      let depth = 1;
      let out = "";
      i++;
      while (i < n && depth > 0) {
        const c = str[i];
        if (c === "\\") {
          const nx = str[i + 1];
          if (nx >= "0" && nx <= "7") {
            let oct = nx;
            let k = 2;
            while (k < 4 && str[i + k] >= "0" && str[i + k] <= "7") oct += str[i + k++];
            out += String.fromCharCode(parseInt(oct, 8) & 255);
            i += k;
          } else {
            const map = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" };
            if (nx === "\r" || nx === "\n") i += nx === "\r" && str[i + 2] === "\n" ? 3 : 2;
            else { out += map[nx] ?? nx; i += 2; }
          }
        } else {
          if (c === "(") depth++;
          else if (c === ")") { depth--; if (depth === 0) { i++; break; } }
          out += c;
          i++;
        }
      }
      yield { t: "str", v: out };
      continue;
    }
    if (ch === "<") {
      if (str[i + 1] === "<") { i += 2; yield { t: "<<" }; continue; }
      const e = str.indexOf(">", i);
      let hex = str.slice(i + 1, e < 0 ? n : e).replace(/\s+/g, "");
      if (hex.length % 2) hex += "0";
      let out = "";
      for (let k = 0; k < hex.length; k += 2) out += String.fromCharCode(parseInt(hex.slice(k, k + 2), 16) || 0);
      yield { t: "str", v: out, hex: true };
      i = e < 0 ? n : e + 1;
      continue;
    }
    if (ch === ">") { i += str[i + 1] === ">" ? 2 : 1; yield { t: ">>" }; continue; }
    if (ch === "[") { i++; yield { t: "[" }; continue; }
    if (ch === "]") { i++; yield { t: "]" }; continue; }
    if (ch === "/") {
      let k = i + 1;
      while (k < n && !/[\s/<>\[\]()%]/.test(str[k])) k++;
      yield { t: "name", v: str.slice(i + 1, k) };
      i = k;
      continue;
    }
    let k = i;
    while (k < n && !/[\s/<>\[\]()%]/.test(str[k])) k++;
    const word = str.slice(i, k);
    i = k > i ? k : i + 1;
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word)) yield { t: "num", v: parseFloat(word) };
    else if (word === "ID") {
      const e = str.indexOf("EI", i);
      i = e < 0 ? n : e + 2;
    } else if (word) yield { t: "op", v: word };
  }
}

function decodeText(bytes, font) {
  if (font?.broken) return "";
  if (font?.cmap) {
    const { map, width } = font.cmap;
    let out = "";
    for (let k = 0; k + width <= bytes.length; k += width) {
      let code = 0;
      for (let b = 0; b < width; b++) code = (code << 8) | bytes.charCodeAt(k + b);
      out += map.get(code) ?? (width === 1 ? winAnsi(code) : "");
    }
    return out;
  }
  let out = "";
  for (let k = 0; k < bytes.length; k++) out += winAnsi(bytes.charCodeAt(k));
  return out;
}

function interpret(content, fonts) {
  const lines = [];
  let line = "";
  let font = null;
  let x = 0;
  let y = 0;
  let lastY = null;
  let moved = false;
  const stack = [];
  const flush = () => {
    if (line.trim()) lines.push(line);
    line = "";
  };
  const show = (text) => {
    if (!text) return;
    if (lastY !== null && Math.abs(y - lastY) > 0.5) flush();
    else if (moved && line && !/\s$/.test(line) && !/^\s/.test(text)) line += " ";
    line += text;
    lastY = y;
    moved = false;
  };
  for (const tok of tokens(content)) {
    if (tok.t === "op") {
      const op = tok.v;
      const a = stack;
      const num = (k) => (typeof a[k]?.v === "number" ? a[k].v : 0);
      if (op === "Tf") font = fonts[a.findLast?.((t) => t.t === "name")?.v ?? ""] ?? null;
      else if (op === "Td" || op === "TD") { x += num(a.length - 2); y += num(a.length - 1); moved = true; }
      else if (op === "Tm") { x = num(a.length - 2); y = num(a.length - 1); moved = true; }
      else if (op === "T*") { y -= 1; moved = true; }
      else if (op === "Tj") show(decodeText(a.at(-1)?.v ?? "", font));
      else if (op === "'" || op === '"') { y -= 1; show(decodeText(a.at(-1)?.v ?? "", font)); }
      else if (op === "TJ") {
        for (const item of a) {
          if (item.t === "str") show(decodeText(item.v, font));
          else if (item.t === "num" && item.v < -250 && line && !/\s$/.test(line)) line += " ";
        }
      } else if (op === "ET") moved = true;
      else if (op === "BT") { x = 0; y = 0; lastY = null; flush(); }
      stack.length = 0;
    } else stack.push(tok);
  }
  flush();
  return lines
    .map((l) => l.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** Read a PDF's text, page by page. Never throws: a file it cannot read comes back with readable: false. */
export async function extractPdfText(buffer) {
  try {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    if (latin1(bytes.subarray(0, 8)).indexOf("%PDF") !== 0 && latin1(bytes.subarray(0, 1024)).indexOf("%PDF") < 0)
      return { text: "", pages: [], pageCount: 0, readable: false };
    const doc = await parseDocument(bytes);
    const pages = [];
    const cache = new Map();
    const order = pageList(doc);
    for (const [index, pageNum] of order.entries()) {
      const names = await pageFonts(doc, pageNum);
      const fonts = {};
      for (const [name, num] of Object.entries(names)) fonts[name] = await fontInfo(doc, num, cache);
      let content = "";
      for (const ref of pageContent(doc, pageNum)) {
        const data = await doc.streamOf(doc.objs.get(ref));
        if (data) content += latin1(data) + "\n";
      }
      pages.push({ n: index + 1, text: interpret(content, fonts) });
    }
    const text = pages.map((p) => p.text).join("\n");
    const letters = (text.match(/[A-Za-z]/g) || []).length;
    const odd = (text.match(/[^\x20-\x7e\n\u00a0-\u024f\u2010-\u203a\u2190-\u21ff\u00b2\u00b3\u00d7]/g) || []).length;
    return { text, pages, pageCount: order.length, readable: letters >= 30 && odd / Math.max(text.length, 1) < 0.1 };
  } catch {
    return { text: "", pages: [], pageCount: 0, readable: false };
  }
}
