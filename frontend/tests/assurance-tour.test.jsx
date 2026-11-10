import { test } from "vitest";
import assert from "node:assert/strict";
import { reviewQueue } from "@/lib/domain/reviewQueue.mjs";
import { pathFor } from "@/lib/runtime";
import { getAssessments } from "@/lib/store/assessments";
import { ui } from "@/lib/store/state";
import { ASSURANCE, ASSURANCE_FULL } from "@/lib/tour/assuranceSteps";

const say = (st) => (typeof st.say === "function" ? st.say() : st.say);

function play(list) {
  return list.map((st) => {
    const sel = st.run();
    return { title: st.title, sel, text: say(st) };
  });
}

test("every assurance step highlights something and narrates real figures", () => {
  for (const list of [ASSURANCE, ASSURANCE_FULL]) {
    for (const s of play(list)) {
      assert.equal(typeof s.sel, "string", s.title);
      assert.ok(s.text.length > 40, s.title);
      assert.doesNotMatch(s.text, /undefined|NaN|null/, s.title);
    }
  }
  assert.ok(ASSURANCE.length <= 10);
  assert.ok(ASSURANCE_FULL.length > ASSURANCE.length);
});

test("the review step decides one item, once, and the map moves", () => {
  const open = () => reviewQueue(getAssessments(), { cityId: "riyadh" }).length;
  ASSURANCE[0].run(); // fresh sample data
  const before = open();
  const review = ASSURANCE.findIndex((s) => s.title === "A reviewer decides");
  for (const st of ASSURANCE.slice(1, review + 1)) st.run();
  assert.equal(open(), before - 1);
  ASSURANCE[review].run(); // stepping back and forward again
  assert.equal(open(), before - 1);
  const after = ASSURANCE[review + 1];
  after.run();
  assert.match(say(after), /from \d+ to \d+ percent/);
  assert.equal(ui.map.city, "riyadh");
});

test("tour destinations resolve to app paths", () => {
  assert.equal(pathFor("home"), "/");
  assert.equal(pathFor("review?city=riyadh"), "/review?city=riyadh");
  assert.equal(pathFor("facility-neom"), "/facilities/neom");
  assert.equal(pathFor("venue-JED"), "/control-tower/JED");
});
