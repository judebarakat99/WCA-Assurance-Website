import { test } from "vitest";
import assert from "node:assert/strict";
import { buildReport } from "@/lib/domain/report.mjs";
import { renderReport } from "@/lib/export";
import { getAssessments, loadSampleAssessments } from "@/lib/store/assessments";
import { localClear, localSeed, localState } from "@/lib/store/intakeLocal";

test("each format renders a valid file", async () => {
  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  localClear();
  loadSampleAssessments();
  localSeed();
  const s = localState();
  const data = { records: getAssessments(), checks: s.checks, documents: s.documents, sample: true, date: "2026-11-25" };
  for (const [kind, scope] of [["programme", {}], ["stadium", { stadiumId: "aramco" }], ["contractor", {}]]) {
    const model = buildReport(kind, scope, data);
    for (const format of ["docx", "xlsx", "pdf"]) {
      const bytes = new Uint8Array(await (await renderReport(model, format)).arrayBuffer());
      const head = String.fromCharCode(...bytes.slice(0, 4));
      assert.equal(head, format === "pdf" ? "%PDF" : "PK\u0003\u0004", `${kind} ${format}`);
      assert.ok(bytes.length > 5000, `${kind} ${format} ${bytes.length}`);
    }
  }
}, 60000);
