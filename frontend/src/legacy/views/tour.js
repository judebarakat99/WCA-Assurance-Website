// ---------- guided demo (executive & full tours) ----------
import {
  esc,
  fmtD,
  pct,
  dd,
  sn,
  venueMeta,
  decMeta,
  SAMPLE_CLAUSE,
  CHANGES,
} from "@/lib/domain/data";
import { S, ui, resetS, tour, goView } from "@/lib/store/state";
import { scores } from "@/lib/domain/scoring";
import { forecasts } from "@/lib/domain/forecast";
import {
  decide,
  decRec,
  advance,
  toast,
  changeImpact,
  decompose,
  applyChange,
  requestGatePass,
  escalateGateBlockers,
} from "@/lib/domain/actions";
import { openDrawer, closeDrawer, runValidation } from "@/lib/drawer";

const $ = (s) => document.querySelector(s);
// ---------- guided demo ----------

const hasVoice =
  typeof window !== "undefined" &&
  typeof window.speechSynthesis !== "undefined" &&
  typeof window.SpeechSynthesisUtterance !== "undefined";
function go(h) {
  goView(h);
}

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
let tourList = null;
const TL = () => tourList || TOUR;
const tourName = () => (tourList === EXEC ? "Executive demo" : "Guided demo");
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
function sentences(t) {
  return t.match(/[^.!?]+[.!?]+/g) || [t];
}
function clearTimers() {
  tour.timers.forEach(clearTimeout);
  tour.timers = [];
}
function stopVoice() {
  clearTimers();
  tour.gen++;
  if (hasVoice)
    try {
      speechSynthesis.cancel();
    } catch (e) {}
}
// Narrator voice: prefer Saudi or Gulf English where the browser has one, then the presenter's own choice, then British English.
const GULF_EN = /^en[-_](SA|AE|QA|KW|BH|OM)/i,
  ARAB_NAME =
    /saudi|arab|hamed|naayf|zariyah|fatima|hamdan|shakir|maged|tarik|laila/i;
function voiceList() {
  if (!hasVoice) return [];
  try {
    return speechSynthesis.getVoices().filter((x) => /^(en|ar)/i.test(x.lang));
  } catch (e) {
    return [];
  }
}
function pickVoice() {
  if (!hasVoice) return null;
  const v = voiceList();
  if (tour.voiceName) {
    const c = v.find((x) => x.name === tour.voiceName);
    if (c) return c;
  }
  return (
    v.find((x) => GULF_EN.test(x.lang)) ||
    v.find((x) => /^en/i.test(x.lang) && ARAB_NAME.test(x.name)) ||
    v.find(
      (x) =>
        /en-GB/i.test(x.lang) &&
        /natural|google|daniel|serena|libby|ryan/i.test(x.name),
    ) ||
    v.find((x) => /en-GB/i.test(x.lang)) ||
    v.find((x) => /^en/i.test(x.lang)) ||
    null
  );
}
function voiceLabel(x) {
  const ar = /^ar/i.test(x.lang),
    gulf =
      GULF_EN.test(x.lang) || (/^en/i.test(x.lang) && ARAB_NAME.test(x.name));
  return `${x.name.replace(/^Microsoft |^Google /, "")} · ${x.lang}${gulf ? " · Saudi/Gulf English" : ar ? " · Arabic voice reading English" : ""}`;
}
function voiceOptions() {
  const v = voiceList(),
    cur = pickVoice();
  if (!v.length) return "";
  const rank = (x) =>
    GULF_EN.test(x.lang) || (/^en/i.test(x.lang) && ARAB_NAME.test(x.name))
      ? 0
      : /^ar-SA/i.test(x.lang)
        ? 1
        : /^ar/i.test(x.lang)
          ? 2
          : 3;
  return v
    .slice()
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
    .map(
      (x) =>
        `<option value="${esc(x.name)}" ${cur && cur.name === x.name ? "selected" : ""}>${esc(voiceLabel(x))}</option>`,
    )
    .join("");
}
// React pages render after navigation, so a step's target may not exist yet.
// Watch the DOM briefly and highlight it as soon as it appears.
let targetWatch = null;
function waitForTarget(sel, scroll) {
  if (targetWatch) targetWatch.disconnect();
  const obs = new MutationObserver(() => {
    if (tour.sel !== sel || !tour.active) return stop();
    if (document.querySelector(sel)) {
      stop();
      applyHL(scroll);
    }
  });
  const timer = setTimeout(stop, 3000);
  function stop() {
    obs.disconnect();
    clearTimeout(timer);
    if (targetWatch === obs) targetWatch = null;
  }
  targetWatch = obs;
  obs.observe(document.body, { childList: true, subtree: true });
}

export function applyHL(scroll) {
  document
    .querySelectorAll(".tour-hl")
    .forEach((e) => e.classList.remove("tour-hl"));
  if (!tour.active || !tour.sel) return;
  const el = document.querySelector(tour.sel);
  if (!el) {
    waitForTarget(tour.sel, scroll);
    return;
  }
  el.classList.add("tour-hl");
  if (scroll)
    try {
      el.scrollIntoView({
        block: "center",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    } catch (e) {
      el.scrollIntoView();
    }
}
export function renderTour() {
  const r = $("#tourRoot");
  document.body.classList.toggle("touring", tour.active);
  if (!tour.active) {
    r.innerHTML = "";
    return;
  }
  const st = TL()[tour.i],
    txt = typeof st.say === "function" ? st.say() : st.say;
  tour.text = txt;
  const ss = sentences(txt);
  r.innerHTML = `<section class="tour dock" role="region" aria-label="${tourName()}" aria-live="polite">
   <div class="tour-head"><span class="chip">${tourName()} · ${tour.i + 1} of ${TL().length}</span><h3>${esc(st.title)}</h3></div>
   <p class="cap">${ss.map((x, k) => `<span class="${k < tour.sent ? "done" : k === tour.sent && tour.playing ? "now" : ""}">${esc(x)}</span>`).join("")}</p>
   <div class="tour-prog"><i style="width:${(((tour.i + 1) / TL().length) * 100).toFixed(1)}%"></i></div>
   <div class="tour-ctl"><button data-tour="back" ${tour.i === 0 ? "disabled" : ""}>Back</button><button class="primary" data-tour="play">${tour.playing ? "Pause" : "Play"}</button><button data-tour="next">${tour.i === TL().length - 1 ? "Finish" : "Next"}</button>
   <label for="tourVoice"><input type="checkbox" id="tourVoice" ${tour.voice && hasVoice ? "checked" : ""} ${hasVoice ? "" : "disabled"}> Voice</label>
   ${hasVoice && voiceList().length ? `<select id="tourVoiceSel" aria-label="Narrator voice">${voiceOptions()}</select>` : ""}
   <button class="ghost" data-tour="exit">Exit</button></div>
   ${hasVoice ? "" : `<div class="tour-note">This browser has no speech voice, so the demo plays with captions only.</div>`}
  </section>`;
}
function markSentence(k) {
  tour.sent = k;
  const sp = document.querySelectorAll("#tourRoot .cap span");
  const cap = document.querySelector("#tourRoot .cap");
  if (cap && sp[Math.min(k, sp.length - 1)])
    cap.scrollTop = sp[Math.min(k, sp.length - 1)].offsetTop - cap.offsetTop;
  sp.forEach((e, j) => {
    e.className = j < k ? "done" : j === k && tour.playing ? "now" : "";
  });
}
function narrate() {
  stopVoice();
  const gen = tour.gen;
  const ss = sentences(tour.text);
  tour.sent = 0;
  const done = () => {
    if (gen !== tour.gen) return;
    markSentence(ss.length);
    tour.timers.push(
      setTimeout(() => {
        if (gen === tour.gen && tour.playing) step(1);
      }, 1100),
    );
  };
  const say = (k) => {
    if (gen !== tour.gen || !tour.playing) return;
    if (k >= ss.length) {
      done();
      return;
    }
    markSentence(k);
    const words = ss[k].split(/\s+/).length,
      est = words * 390 + 700;
    if (tour.voice && hasVoice) {
      let fired = false;
      const next = () => {
        if (fired) return;
        fired = true;
        say(k + 1);
      };
      const u = new SpeechSynthesisUtterance(ss[k].trim());
      const v = pickVoice();
      if (v) u.voice = v;
      u.lang = v ? v.lang : "en-GB";
      u.rate = /^ar/i.test(u.lang) ? 0.92 : 0.97;
      u.onend = next;
      u.onerror = next;
      tour.timers.push(setTimeout(next, est * 2 + 3000));
      try {
        speechSynthesis.speak(u);
      } catch (e) {
        next();
      }
    } else tour.timers.push(setTimeout(() => say(k + 1), est));
  };
  say(0);
}
function runStep() {
  const st = TL()[tour.i];
  tour.sel = st.run() || null;
  tour.sent = 0;
  renderTour();
  setTimeout(() => applyHL(true), 120);
  if (tour.playing) narrate();
}
function step(d) {
  stopVoice();
  const n = tour.i + d;
  if (n >= TL().length) {
    endTour(true);
    return;
  }
  if (n < 0) return;
  tour.i = n;
  runStep();
}
export function startTour(list) {
  tourList = list || null;
  stopVoice();
  resetS();
  closeDrawer();
  window.WNSTwin && window.WNSTwin.reset();
  ui.filters = { venue: "all", family: "all", state: "all", q: "" };
  ui.decoOut = null;
  tour.active = true;
  tour.i = 0;
  tour.playing = true;
  if (hasVoice)
    try {
      speechSynthesis.getVoices();
    } catch (e) {}
  runStep();
}
export function endTour(finished) {
  stopVoice();
  window.WNSTwin && window.WNSTwin.stop();
  tour.active = false;
  tour.playing = false;
  tour.sel = null;
  applyHL(false);
  renderTour();
  if (finished)
    toast(
      "Demo finished. The app stays in the state the demo left it; use Reset demo to start fresh.",
    );
}
if (hasVoice && speechSynthesis.addEventListener)
  speechSynthesis.addEventListener("voiceschanged", () => {
    if (tour.active) {
      const sel = document.getElementById("tourVoiceSel");
      if (sel) sel.innerHTML = voiceOptions();
      else renderTour();
    }
  });

// ---------- wiring helpers used by lib/engine.js ----------
export { EXEC };
export function handleTourClick(a) {
  if (a === "exit") {
    endTour(false);
    return;
  }
  if (a === "next") {
    step(1);
    return;
  }
  if (a === "back") {
    step(-1);
    return;
  }
  if (a === "play") {
    if (tour.playing) {
      tour.playing = false;
      stopVoice();
      renderTour();
    } else {
      tour.playing = true;
      renderTour();
      narrate();
    }
    return;
  }
}
export function setTourVoice(c) {
  tour.voice = c;
  if (tour.playing) narrate();
}
export function setTourVoiceName(v) {
  tour.voiceName = v;
  if (tour.playing) narrate();
}
