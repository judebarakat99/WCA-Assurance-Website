// Guided demo script: what each step shows (run) and says (say).
// run() navigates and sets up the page, then returns the selector to highlight.
import { fmtD, pct, venueMeta, decMeta, SAMPLE_CLAUSE, CHANGES } from "@/lib/domain/data";
import { S, ui, goView } from "@/lib/store/state";
import { scores } from "@/lib/domain/scoring";
import { forecasts } from "@/lib/domain/forecast";
import {
  decide,
  decRec,
  advance,
  changeImpact,
  decompose,
  applyChange,
  requestGatePass,
  escalateGateBlockers,
} from "@/lib/domain/actions";
import { openDrawer, closeDrawer, runValidation } from "@/lib/drawer";

const go = (h) => goView(h);

const RR_STEPS = [
  {
    title: "Questions first",
    run: () => {
      closeDrawer();
      go("readiness");
      return "#aiExec";
    },
    say: () => {
      const f = forecasts(),
        on = f.filter((x) => x.late80 <= 0).length;
      return `In 2034, forty-eight teams will play across fifteen stadiums in Saudi Arabia. An executive does not need another dashboard. They need answers. The Readiness Room opens on the questions that matter before every FIFA milestone, and answers each one from validated evidence. Right now, ${on} of ${f.length} venues make their next gate with eighty percent confidence.`;
    },
  },
  {
    title: "PMC schedule versus evidence",
    run: () => {
      go("readiness");
      return "#fcPanel";
    },
    say: () => {
      const j = forecasts().find((x) => x.id === "JED");
      return `Take Jeddah. The PMC's schedule says Construction complete lands on ${fmtD(j.pmc.finish)}, with float to spare. The engine runs a thousand simulations on the evidence itself: what is still unproven, what was rejected, and how fast this venue really closes items. Its P50 is ${fmtD(j.d50)}. Its P80 is ${fmtD(j.d80)}. The chance of meeting FIFA's milestone is ${pct(j.prob)} percent.`;
    },
  },
  {
    title: "Decide before options close",
    run: () => {
      decide("DEC-01", 0);
      go("decisions");
      return "#dec-DEC-01";
    },
    say: () => {
      const r = decRec("DEC-01");
      return `So the tool raises a decision, with its last responsible moment, ${fmtD(decMeta("DEC-01").lrm)}. The executive deploys a recovery team, and the forecast re-runs at once. Jeddah's P80 moves from ${fmtD(r.before)} to ${fmtD(r.after)}. The chance of meeting the milestone rises from ${pct(r.beforeProb)} to ${pct(r.afterProb)} percent. ${r.afterLate > 0 ? "It is still late, so the next lever is already in view." : "It is now inside FIFA's milestone."}`;
    },
  },
];
const TOUR = [
  ...RR_STEPS,
  {
    title: "Control tower",
    run: () => {
      closeDrawer();
      go("tower");
      return ".tiles";
    },
    say: () => {
      const s = scores(S.obligations);
      return `This is the control tower for the 2034 World Cup programme. Every FIFA requirement is tracked here as an owned obligation with a measurable criterion. Look at the first two numbers. Owners declare ${pct(s.declared)} percent readiness. Only ${pct(s.assured)} percent is backed by validated evidence. That gap of ${pct(s.declared - s.assured)} points is the risk a status report never shows.`;
    },
  },
  {
    title: "Proven versus declared",
    run: () => {
      go("tower");
      return ".venue";
    },
    say: "Every venue shows the same split. The solid bar is readiness proven by evidence. The hatched part is what owners say is done but nobody has proven yet. Each card also projects readiness at the venue's next gate.",
  },
  {
    title: "The green that was red",
    run: () => {
      go("tower");
      openDrawer("JED-LGT-01");
      return ".drawer .criterion";
    },
    say: "Here is King Abdullah Sports City in Jeddah, an existing stadium being upgraded for 2034. The lighting contractor has declared the new floodlighting complete. The acceptance criterion is precise: at least 2,500 lux towards the fixed cameras.",
  },
  {
    title: "Evidence decides",
    run: () => {
      if (ui.drawerId !== "JED-LGT-01") openDrawer("JED-LGT-01");
      runValidation("JED-LGT-01");
      return "#lastResult";
    },
    say: "The engine checks the submitted commissioning test against the rule. It shows 1,850 lux. So the owner's complete is overturned. The obligation is rejected, and a corrective action opens with a seven day deadline. In a status report, this would have been green.",
  },
  {
    title: "Escalation ladder",
    run: () => {
      closeDrawer();
      go("issues");
      return ".ladder";
    },
    say: "Every failed check becomes a corrective action, with a deadline set by criticality. Critical items get seven days, high items fourteen.",
  },
  {
    title: "Time moves on",
    run: () => {
      go("issues");
      advance();
      return ".ladder";
    },
    say: "Let's move the programme clock forward one week. Actions that missed their deadline climb the ladder automatically: from the delivery owner, to the workstream lead, to the authority executive, and finally to ministerial steering. Nothing sits quietly in a spreadsheet.",
  },
  {
    title: "The gate holds",
    run: () => {
      go("gates");
      return "#gate-JED";
    },
    say: "Now the readiness gates. King Abdullah Sports City in Jeddah is due to pass Construction complete. The engine tests four rules. Every critical obligation verified. Evidence from the built stadium, not just drawings. At least ninety percent assured readiness. And no open critical issues.",
  },
  {
    title: "Gate refused",
    run: () => {
      go("gates");
      requestGatePass("JED");
      return "#gate-JED";
    },
    say: "The contractor requests the gate pass. The engine refuses it, and names every blocker. The tool does not just inform the decision. It enforces the standard.",
  },
  {
    title: "Blockers escalated",
    run: () => {
      go("gates");
      escalateGateBlockers("JED");
      return "#gate-JED";
    },
    say: "With one click, every blocker is escalated straight to the authority executive, each with its own deadline and owner.",
  },
  {
    title: "Base camp at risk",
    run: () => {
      go("gates");
      openDrawer("TBC-R3-TBC-03");
      return ".drawer .result";
    },
    say: "Dependencies are tracked too. At team base camp R-03 in Riyadh, private training cannot be ready, because the team hotel evidence shows only 38 of the 50 rooms required. The risk surfaces weeks before a monthly pack would catch it.",
  },
  {
    title: "FIFA changes the rules",
    run: () => {
      closeDrawer();
      ui.selChange = "lux";
      go("change");
      return "#view .cols > .panel";
    },
    say: () => {
      const f = changeImpact(CHANGES[0]).filter((r) => r.flip);
      const names = f.map((r) => venueMeta(r.o.venue).name).join(" and ");
      return `Requirements change over eight years. Here FIFA raises the floodlighting minimum from 2,500 to 3,000 lux. The engine re-tests every piece of existing evidence against the new rule. ${f.length === 0 ? "No venue is affected this time." : f.length === 1 ? "Floodlighting at " + names + " was compliant yesterday. Today it fails." : f.length + " obligations that were compliant yesterday fail today."}`;
    },
  },
  {
    title: "Impact applied",
    run: () => {
      ui.selChange = "lux";
      go("change");
      if (!(S.applied || []).includes("lux")) applyChange();
      return ".tablewrap";
    },
    say: "Applying the update re-baselines the criterion everywhere it appears, reverts the failing evidence, and opens corrective actions. Past compliance cannot silently decay.",
  },
  {
    title: "Inspection tomorrow",
    run: () => {
      ui.dossierVenue = "KHO";
      go("dossier");
      return "#dossierDoc";
    },
    say: "FIFA announces an inspection of Aramco Stadium in Al Khobar. The dossier is generated in one click, from validated evidence and the full audit trail. Nothing in it is self-declared.",
  },
  {
    title: "From clause to obligation",
    run: () => {
      ui.decoInput = SAMPLE_CLAUSE;
      ui.decoOut = decompose(SAMPLE_CLAUSE);
      go("decompose");
      return "#view .tablewrap";
    },
    say: "And this is where it all starts. Paste a FIFA clause, and the engine splits it into atomic obligations. It separates binding shall language from advisory should language, and pulls out the measurable criteria. In the full product, a language model does this, with a reviewer approving every line.",
  },
  {
    title: "A design arrives",
    run: () => {
      closeDrawer();
      go("twin");
      window.WNSTwin && window.WNSTwin.play([0, 1, 2]);
      return ".tw-main";
    },
    say: "Now the front of the pipeline, before anything is built. This is King Salman International Stadium in Riyadh, the planned venue for the opening match and the final, with 92,760 seats. Its circular form rises from King Abdulaziz Park like a seed cracking the earth, wrapped in green walls and a green roof. The design team submits its model for the design freeze gate. The engine reads the model and pulls out the facts the requirements care about, noting where each one came from. Then it turns the requirements into nine checks, each with a threshold, a criticality and the gate it blocks. The submission you are about to see is simulated.",
  },
  {
    title: "Failures shown in place",
    run: () => {
      go("twin");
      window.WNSTwin && window.WNSTwin.play([3]);
      return ".tw-main";
    },
    say: "The checks run against the model. Three fail, and each one lights up where the problem is. The north stand is short of seats, because its upper tier was deferred, which leaves the bowl below the eighty thousand needed for a final. The media tribune is too small. And the east stand has no wheelchair positions. Two more checks need evidence. The lighting calculation leaves out the south third of the pitch, and the green roof has no build-up data. The engine asks, rather than guesses.",
  },
  {
    title: "Findings routed",
    run: () => {
      go("twin");
      window.WNSTwin && window.WNSTwin.play([4]);
      return ".tw-panel";
    },
    say: "Each fail becomes a non-conformance, and each gap becomes a clarification. All five go to named owners in the design team, with due dates set by criticality. From here they follow the same escalation ladder as everything else in the control tower.",
  },
  {
    title: "Resubmission re-checked",
    run: () => {
      go("twin");
      window.WNSTwin && window.WNSTwin.play([5]);
      return ".tw-main";
    },
    say: "Six days later the design team sends revision D. The engine compares it with revision C, and re-runs only the four checks touched by the changes. The north upper tier is in, bringing the bowl to 92,760 seats. The tribune is wider, the east stand has wheelchair positions, and the full lighting grid is in. All four now pass.",
  },
  {
    title: "Design freeze passed",
    run: () => {
      go("twin");
      window.WNSTwin && window.WNSTwin.play([6]);
      return ".tw-panel";
    },
    say: "The design freeze gate passes, because every critical and high check is backed by evidence. The open green roof question rides along as a tracked condition. If it lapses, it escalates and blocks the next gate.",
  },
  {
    title: "Assurance, not reporting",
    run: () => {
      go("readiness");
      return "#aiExec";
    },
    say: "That is the difference. Readiness questions answered with a confidence level. Designs checked before they are built. Status earned by evidence. Gates that hold. Escalation that runs itself. And proof for FIFA at any moment. This is the compliance backbone of the programme control tower.",
  },
];
const EXEC = [
  ...RR_STEPS,
  {
    title: "The gate holds",
    run: () => {
      go("gates");
      requestGatePass("JED");
      return "#gate-JED";
    },
    say: "Jeddah asks to pass construction complete. The engine checks every critical obligation and the evidence behind it. It refuses the pass, and names each blocker. The standard is enforced, not just reported.",
  },
  {
    title: "Escalation runs itself",
    run: () => {
      go("issues");
      advance();
      return ".ladder";
    },
    say: "Every failure becomes an action with an owner and a deadline. Miss the deadline, and it climbs automatically, all the way to ministerial steering.",
  },
  {
    title: "Designs checked before they are built",
    run: () => {
      go("twin");
      window.WNSTwin && window.WNSTwin.play([3]);
      return ".tw-main";
    },
    say: "The same discipline starts at design. This is King Salman International Stadium, home of the opening match and the final. The engine reads the design model, generates the checks, and shows each failure in place. Seats short in the north stand. A media tribune that is too small. No wheelchair positions in the east stand.",
  },
  {
    title: "Fixed, re-checked, passed",
    run: () => {
      go("twin");
      window.WNSTwin && window.WNSTwin.play([5, 6]);
      return ".tw-main";
    },
    say: "Six days later the design team resubmits. The engine re-runs only the four affected checks. All of them pass, and the design freeze gate clears, with one tracked condition.",
  },
  {
    title: "When FIFA changes the rules",
    run: () => {
      ui.selChange = "lux";
      go("change");
      if (!(S.applied || []).includes("lux")) applyChange();
      return ".tablewrap";
    },
    say: "When FIFA changes a requirement, the engine re-tests all past evidence at once, and reopens anything that no longer complies.",
  },
  {
    title: "Proof on demand",
    run: () => {
      ui.dossierVenue = "KHO";
      go("dossier");
      return "#dossierDoc";
    },
    say: "And when FIFA inspects, the dossier is ready in one click, built from validated evidence and a full audit trail.",
  },
  {
    title: "One control tower",
    run: () => {
      go("readiness");
      return "#aiExec";
    },
    say: "One control tower. Every readiness question answered with a confidence level. Every requirement owned, proven and enforced, from the first drawing to the final whistle. We propose a twelve-week proof of concept to deliver it.",
  },
];

/** Full guided demo and the 3-minute executive demo. */
export { TOUR, EXEC };
