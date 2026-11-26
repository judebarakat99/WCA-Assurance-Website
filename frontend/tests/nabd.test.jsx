import { beforeEach, test } from "vitest";
import assert from "node:assert/strict";
import { answerQuestion } from "@/lib/assistant/localChat";
import { delivery } from "@/lib/domain/delivery.mjs";
import { queueCounts, reviewQueue } from "@/lib/domain/reviewQueue.mjs";
import { getAssessments, resetAssessments } from "@/lib/store/assessments";
import { localClear, localSeed } from "@/lib/store/intakeLocal";

beforeEach(() => {
  const mem = {};
  globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => (mem[k] = String(v)) };
  resetAssessments();
  localClear();
});
const ask = (q, memory = {}) => answerQuestion(q, getAssessments(), memory);

test("Nabd's figures match the pages: review queue and status", () => {
  const c = queueCounts(reviewQueue(getAssessments()));
  assert.match(ask("How many items are waiting for review?").reply, new RegExp(`^${c.total} items`));
  assert.match(ask("What is the latest compliance status?").reply, new RegExp(`${c.total} items waiting`));
});

test("schedule and cost answers come from Project progress", () => {
  const d = delivery({});
  const late = ask("Which stadiums are behind schedule?");
  for (const r of d.rows.filter((x) => ["late", "at-risk"].includes(x.status)).slice(0, 3))
    assert.ok(late.reply.includes(r.name), r.name);
  const cost = ask("Where is the budget overrunning?");
  assert.match(cost.reply, new RegExp(`${d.totals.overBudget} stadiums are forecast`));
  const ksis = ask("What is the cost at King Salman?");
  assert.match(ksis.reply, /CPI 0\.88/);
  assert.equal(ksis.stadium.id, "king-salman-international");
});

test("follow-ups keep the stadium; progress claims, owners, documents and pages are answered", () => {
  const memory = {};
  const first = ask("When is the handover of Prince Faisal?", memory);
  memory.stadiumId = first.stadium.id;
  assert.match(ask("and its cost?", memory).reply, /^Prince Faisal bin Fahad/);
  assert.match(ask("Which progress claims are overstated?").reply, /No progress report has been checked/);
  localSeed();
  assert.match(ask("Which progress claims are overstated?").reply, /Aramco Stadium: reported 88%, recalculated 86\.8%/);
  assert.match(ask("What documents are on file?").reply, /^9 documents are on file/);
  assert.match(
    ask("What does the Media and broadcast lead have open?").reply,
    /^Media and broadcast lead has \d+ open items/,
  );
  assert.match(ask("What does the Evidence page do?").reply, /^Evidence: drop a contractor's document/);
  assert.match(ask("What is the capital of France?").reply, /could not match that/);
});
