// Venue Compliance Hub: Nabd answers from the programme data when the assistant service does not.
// Run from the frontend folder:  node apply-chat.cjs
// Adds src/lib/assistant/localChat.js (plus exposure.mjs and mitigation.mjs, which it uses),
// then edits src/lib/assistant/chat.js and api.js so the service is tried first and Nabd answers
// from the programme data when it does not respond. Nothing in the backend is touched.
// Safe to run again: edits already in place are left alone. If a file does not match what this
// script expects, nothing is written at all.
const fs = require("fs");
const path = require("path");

const here = __dirname;
const src = path.resolve("src");
if (!fs.existsSync(src)) { console.error("Run this from the frontend folder (src/ not found)."); process.exit(1); }

const readText = (p) => {
  let raw = fs.readFileSync(p, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return { text: raw.replace(/\r\n/g, "\n"), crlf: raw.includes("\r\n") };
};
const writeText = (p, text, crlf) => fs.writeFileSync(p, crlf ? text.replace(/\n/g, "\r\n") : text, "utf8");
const count = (a, b) => a.split(b).length - 1;

const QUESTIONS = `export const QUICK_QUESTIONS = [
  "What is the latest compliance status?",
  "Which stadium has the lowest assured share?",
  "What is outstanding at King Salman International Stadium?",
  "What are the lighting requirements for a stadium?",
  "What evidence is needed for lighting?",
  "How many items are waiting for review?",
];`;

const CATCH_OLD = `  } catch (error) {
    ai.msgs.push({ who: "a", text: error.message, error: true });
  } finally {`;
const CATCH_NEW = `  } catch (error) {
    // The service did not answer (not running, timed out or refused): answer from the programme data instead.
    try {
      const local = await localAnswer(q);
      ai.msgs.push({ who: "a", text: local.reply, sources: local.sources, warnings: local.warnings });
    } catch {
      ai.msgs.push({ who: "a", text: error.message, error: true });
    }
  } finally {`;

// Each file: a list of { name, applied(text), apply(text) -> text | null }.
const plans = {
  "lib/assistant/chat.js": [
    {
      name: "import",
      applied: (t) => t.includes('from "@/lib/assistant/localChat"'),
      apply: (t) => {
        const a = 'import { assistantRequest } from "@/lib/assistant/api";';
        return count(t, a) === 1 ? t.replace(a, () => a + '\nimport { localAnswer } from "@/lib/assistant/localChat";') : null;
      },
    },
    {
      name: "quick questions",
      applied: (t) => t.includes("What is the latest compliance status?"),
      apply: (t) => {
        const re = /export const QUICK_QUESTIONS = \[[\s\S]*?\];/;
        return re.test(t) ? t.replace(re, () => QUESTIONS) : null;
      },
    },
    {
      name: "service timeout",
      applied: (t) => t.includes("timeoutMs: 25000"),
      apply: (t) => {
        const a = 'const result = await assistantRequest("/chat", {';
        return count(t, a) === 1 ? t.replace(a, () => a + "\n      timeoutMs: 25000,") : null;
      },
    },
    {
      name: "answer from the programme data",
      applied: (t) => t.includes("await localAnswer(q)"),
      apply: (t) => (count(t, CATCH_OLD) === 1 ? t.replace(CATCH_OLD, () => CATCH_NEW) : null),
    },
  ],
  "lib/assistant/api.js": [
    {
      name: "timeout option",
      applied: (t) => t.includes("timeoutMs"),
      apply: (t) => {
        const a = "export async function assistantRequest(path, options = {}) {";
        const b = "setTimeout(() => controller.abort(), 180000)";
        if (count(t, a) !== 1 || count(t, b) !== 1) return null;
        return t
          .replace(a, () => "export async function assistantRequest(path, { timeoutMs = 180000, ...options } = {}) {")
          .replace(b, () => "setTimeout(() => controller.abort(), timeoutMs)");
      },
    },
  ],
};

// 1. work out every edit before writing anything
const results = [];
let problems = 0;
for (const [rel, steps] of Object.entries(plans)) {
  const full = path.join(src, rel);
  if (!fs.existsSync(full)) { console.error(`MISSING FILE  src/${rel}`); problems++; continue; }
  const file = readText(full);
  let text = file.text;
  let changed = false;
  for (const step of steps) {
    if (step.applied(text)) { console.log(`already in place: ${rel} [${step.name}]`); continue; }
    const next = step.apply(text);
    if (next == null) { console.error(`NOT APPLIED   ${rel} [${step.name}]: the text is not what I expected`); problems++; continue; }
    text = next;
    changed = true;
  }
  results.push({ rel, full, text, crlf: file.crlf, changed });
}
if (problems) {
  console.error(`\n${problems} problem(s). Nothing was written.`);
  process.exit(2);
}

// 2. new files
const NEW = [
  ["files/localChat.js", "lib/assistant/localChat.js"],
  ["files/exposure.mjs", "lib/domain/exposure.mjs"],
  ["files/mitigation.mjs", "lib/domain/mitigation.mjs"],
];
for (const [from, to] of NEW) {
  const dest = path.join(src, to);
  const body = readText(path.join(here, from));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  writeText(dest, body.text, fs.existsSync(dest) ? readText(dest).crlf : true);
  console.log("wrote   src/" + to);
}

// 3. edited files
for (const r of results) {
  if (r.changed) {
    writeText(r.full, r.text, r.crlf);
    console.log("edited  src/" + r.rel);
  }
}
