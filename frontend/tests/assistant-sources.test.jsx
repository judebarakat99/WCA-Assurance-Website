import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import AssistantSource from "@/components/molecules/AssistantSource";

const sourceHtml = (source) => renderToStaticMarkup(<AssistantSource source={source} />);
import { buildAssistantContext } from "@/lib/assistant/context.js";
import { loadSampleAssessments, resetAssessments } from "@/lib/store/assessments";

test("forecast source renders named facts instead of raw JSON", () => {
  const html = sourceHtml({
    kind: "programme",
    category: "forecasts",
    title: "Jeddah",
    as_of: "2026-11-05",
    excerpt: '{"do_not_render":"raw JSON"}',
    facts: [
      { label: "On-time probability", value: "9.7%" },
      { label: "Scenario P80", value: "26 May 2027" },
    ],
  });
  assert.ok(html.includes("Milestone forecast"));
  assert.ok(html.includes("9.7%"));
  assert.ok(html.includes("5 Nov 2026"));
  assert.ok(!html.includes("do_not_render"));
});
test("gate source makes unmet conditions and scope labels explicit", () => {
  const html = sourceHtml({
    kind: "programme",
    category: "venues",
    title: "Jeddah",
    facts: [
      { label: "Overall venue assured readiness", value: "35.9%" },
      { label: "Gate-scope assured readiness", value: "52%" },
    ],
    checks: [
      {
        label: "Verify critical obligations",
        met: false,
        blockers: ["JED-ITT-01"],
      },
    ],
  });
  assert.ok(html.includes("Overall venue assured readiness"));
  assert.ok(html.includes("Gate-scope assured readiness"));
  assert.ok(html.includes("Unmet"));
  assert.ok(html.includes("JED-ITT-01"));
});
test("source content is escaped and documents retain page references", () => {
  const html = sourceHtml({
    kind: "document",
    title: "<script>bad</script>.pdf",
    page: 4,
    excerpt: "<img src=x onerror=alert(1)> & text",
  });
  assert.ok(html.includes("page 4"));
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;img"));
  assert.ok(html.includes("&amp; text"));
});
test("the snapshot carries assurance roll-ups for every stadium", () => {
  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  resetAssessments();
  loadSampleAssessments();
  const snapshot = buildAssistantContext();
  assert.equal(snapshot.source, "browser-demo");
  assert.equal(snapshot.venues.length, 15);
  assert.ok(snapshot.summary.assured > 0 && snapshot.summary.assured < 1);
  assert.ok(snapshot.summary.review_queue.total > 0);
  for (const v of snapshot.venues) assert.ok(v.assurance.in_scope > 0, v.id);
  assert.ok(JSON.stringify(snapshot).length < 100000);
});
