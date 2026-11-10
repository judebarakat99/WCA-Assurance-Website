// Guided demo of the FIFA assurance flow: country → city → review → back.
// Same step shape as steps.js: run() sets up the page and returns the
// selector to highlight; say is the narration (computed after run()).
// Figures are read from the live (sample) data, so the script stays true.
import { pct } from "@/lib/domain/data";
import { assuranceMap } from "@/lib/domain/cityAssurance.mjs";
import { queueCounts, reviewQueue } from "@/lib/domain/reviewQueue.mjs";
import { getAssessments, loadSampleAssessments, reviewAssessment } from "@/lib/store/assessments";
import { goView, resetMapUi, rerender, updateMap } from "@/lib/store/state";
import { EXEC } from "@/lib/tour/steps";

const CITY = "riyadh";
const go = (key) => goView(key);
const now = (pillar = null, year = null) => assuranceMap(getAssessments(), pillar, year);
const city = (m, id = CITY) => m.cities.find((c) => c.id === id);
const n = (x, one, many = `${one}s`) => `${x} ${x === 1 ? one : many}`;

// What the demo decided, so stepping back and forth does not decide twice.
const demo = { item: null, before: null };

/** The first item awaiting review in the demo city whose evidence meets its criterion. */
function pickItem() {
  return reviewQueue(getAssessments(), { cityId: CITY, status: "evidence-submitted" }).find((i) => i.reason === "pass");
}

const home = (patch) => {
  updateMap(patch);
  go("home");
};

const OPENING = [
  {
    title: "Where we stand",
    run: () => {
      loadSampleAssessments();
      resetMapUi();
      demo.item = null;
      demo.before = null;
      rerender();
      go("home");
      return ".abrief";
    },
    say: () => {
      const p = now().programme;
      return `Saudi Arabia will host the 2034 World Cup in fifteen stadiums across five cities. This view answers one question: how much of what FIFA requires is proven? Of ${p.inScope} requirements that apply to the stadiums, ${pct(p.assured)} percent are accepted by a reviewer. ${pct(p.coverage)} percent have been assessed at all. Nothing counts until a reviewer accepts the evidence. These figures are sample data for the demonstration.`;
    },
  },
  {
    title: "Five host cities",
    run: () => {
      home({ city: null, pillar: null, year: 2034 });
      return ".amap";
    },
    say: () => {
      const m = now();
      const worst = [...m.cities].sort((a, b) => a.assurance.assured - b.assurance.assured)[0];
      return `Each host city's region is shaded by how much is assured there. The badge on each pin counts the items waiting for someone, and a pin pulses when something is non-compliant. ${worst.name} is lowest, at ${pct(worst.assurance.assured)} percent.`;
    },
  },
  {
    title: "Look ahead by delivery date",
    run: () => {
      home({ city: null, year: 2027 });
      return ".atimeline";
    },
    say: () => {
      const m = now(null, 2027);
      return `Stadiums open in waves, from 2026 to 2032. Move the timeline to 2027 and the map counts only the ${m.due} stadiums due by then. For them, ${pct(m.programme.assured)} percent of requirements are assured, and ${m.programme.needsAttention} items still need attention. Those come first.`;
    },
  },
  {
    title: "Into a city",
    run: () => {
      home({ city: CITY, year: 2034 });
      return ".abrief";
    },
    say: () => {
      const c = city(now());
      const approx = c.stadiums.filter((s) => s.location.accuracy === "approximate").length;
      const located =
        approx === c.stadiums.length
          ? "Their positions are approximate for now, and marked that way."
          : approx
            ? `${n(approx, "position")} are approximate for now, and marked that way.`
            : "";
      return `Open ${c.name}: ${n(c.stadiums.length, "stadium")}, ${pct(c.assurance.assured)} percent assured. The map zooms to the stadiums, each coloured by its own status. ${located}`;
    },
  },
  {
    title: "One requirement area at a time",
    run: () => {
      home({ city: CITY, pillar: "Lighting" });
      return ".arail";
    },
    say: () => {
      const c = city(now("Lighting"));
      return `The rail narrows everything to one requirement area. For lighting, ${c.name} is at ${pct(c.assurance.assured)} percent. Lighting criteria are marked provisional: they follow FIFA's 2020 lighting guide until the 2034 tournament requirements are published.`;
    },
  },
  {
    title: "Who needs to act",
    run: () => {
      updateMap({ pillar: null });
      go(`review?city=${CITY}`);
      return ".mini-grid";
    },
    say: () => {
      const q = queueCounts(reviewQueue(getAssessments(), { cityId: CITY }));
      return `From the map, one click opens the review queue for ${city(now()).name}. ${q.total} items need a person. ${q["evidence-submitted"]} have evidence waiting for a decision, and ${q.fail} of those miss their criterion. ${q["non-compliant"]} are non-compliant, waiting for new evidence. Stadiums due earliest are at the top.`;
    },
  },
  {
    title: "A reviewer decides",
    run: () => {
      if (!demo.item) {
        demo.item = pickItem();
        demo.before = city(now()).assurance.assured;
        if (demo.item) reviewAssessment(demo.item.stadium.id, demo.item.requirement, "compliant", "Accepted in the guided demo");
      }
      go(`review?city=${CITY}`);
      return ".rq-list";
    },
    say: () => {
      const i = demo.item;
      if (!i) return "Every item here has a decision.";
      return `The reviewer opens the evidence for ${i.requirement.title} at ${i.stadium.name}. The value meets the criterion, so they accept it. The item leaves the queue and the decision is recorded with its date and reviewer.`;
    },
  },
  {
    title: "The map updates",
    run: () => {
      home({ city: CITY });
      return ".abrief";
    },
    say: () => {
      const after = city(now()).assurance.assured;
      return `Back on the map, ${city(now()).name} has moved from ${pct(demo.before ?? after)} to ${pct(after)} percent assured. The numbers come from the decisions themselves, not from a status report.`;
    },
  },
];

const CLOSING = {
  title: "Proven, not declared",
  run: () => {
    home({ city: null, pillar: null, year: 2034, recenter: Date.now() });
    return ".abrief";
  },
  say: "Every FIFA requirement, checked for every stadium, and counted only when the evidence is accepted. From the whole country down to a single requirement, and back. That is what the proof of concept delivers.",
};

const DEEPER = [
  {
    title: "Evidence at the stadium",
    run: () => {
      const id = demo.item?.stadium.id || "king-fahad-sports-city";
      go(`facility-${id}`);
      return ".assess-table";
    },
    say: () => {
      const name = demo.item?.stadium.name || "the stadium";
      return `Each stadium has its own page. Every FIFA requirement is listed with whether it applies to ${name} and why, its status, the evidence submitted and the reviewer's decision. New evidence is recorded here, and checked against the criterion as soon as it arrives.`;
    },
  },
  {
    title: "Where the requirements come from",
    run: () => {
      go("compliance");
      return ".page-head";
    },
    say: "The requirements come from FIFA's own documents. Each one keeps its source section and page, its criterion and its version. When FIFA publishes a new version, that version is what new evidence is checked against.",
  },
  // Design review, from the simulation demo: designs checked before they are built.
  ...EXEC.filter((s) => ["Designs checked before they are built", "Fixed, re-checked, passed"].includes(s.title)),
];

/** Short assurance demo (about 3 minutes) and the full one. */
export const ASSURANCE = [...OPENING, CLOSING];
export const ASSURANCE_FULL = [...OPENING, ...DEEPER, CLOSING];
