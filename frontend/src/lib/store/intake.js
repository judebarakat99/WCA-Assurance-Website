// Document intake and progress checks, held by the backend. This module keeps
// the latest copy for the Intake page, stadium pages and the review queue, and
// calls notify() on every change so useProgramme() components re-render.
// When the backend is not running (or has no Azure configuration) it switches
// to the offline demo in intakeLocal.js, which has the same behaviour for the
// bundled sample documents.
import { assistantRequest } from "@/lib/assistant/api";
import {
  localCheck,
  localClear,
  localDecide,
  localFile,
  localRemove,
  localSeed,
  localState,
  localUpload,
} from "@/lib/store/intakeLocal";
import { notify } from "@/lib/store/state";

export const MAX_UPLOAD = 10 * 1024 * 1024;

export const intake = {
  mode: null, // "online" (backend) or "offline" (bundled sample readings)
  loaded: false,
  loading: false,
  error: null,
  stadiums: [],
  elements: [],
  documents: [],
  checks: {},
  uploads: [], // in flight or failed: { key, name, stage, error }
  running: {}, // stadium id -> true while a check runs
  runs: {}, // stadium id -> { steps, shown } while a check's steps play back
  errors: {}, // stadium id -> last check error
  seeding: false,
  busy: {}, // document id -> true while filing or removing
};

const post = (path, body) =>
  assistantRequest(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });

function apply(state) {
  Object.assign(intake, {
    stadiums: state.stadiums,
    elements: state.elements,
    documents: state.documents,
    checks: state.checks,
    loaded: true,
    error: null,
  });
}

const offline = () => intake.mode === "offline";

// Pacing for the agent's visible progress. Online, the stages run while the
// backend works and its real steps play back once it answers; offline, the
// same stages and steps play back from the bundled readings. Instant when the
// system asks for reduced motion.
const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, reducedMotion() ? 0 : ms));

/** What the agent is doing with an uploaded file, in order. */
export const UPLOAD_STAGES = ["Uploading", "Reading the text", "Identifying the document"];

// Reload without the loading guard, so results appear as each file finishes.
async function reload() {
  apply(offline() ? localState() : await assistantRequest("/intake"));
}

// Online when the backend answers and has Azure configured; otherwise offline.
async function detectMode() {
  try {
    const health = await assistantRequest("/health");
    intake.mode = health?.azure_configured ? "online" : "offline";
  } catch {
    intake.mode = "offline";
  }
}

/** Load (or reload) everything, from the backend or the offline demo. */
export async function refreshIntake() {
  if (intake.loading) return;
  intake.loading = true;
  notify();
  try {
    if (!intake.mode) await detectMode();
    if (offline()) apply(localState());
    else apply(await assistantRequest("/intake"));
  } catch (error) {
    if (error.offline) {
      intake.mode = "offline";
      apply(localState());
    } else intake.error = error.message;
  } finally {
    intake.loading = false;
    notify();
  }
}

/** Load once per page load; later calls do nothing. */
export function ensureIntake() {
  if (!intake.loaded && !intake.loading && !intake.error) refreshIntake();
}

let uploadSeq = 0;
/** Upload files two at a time; the agent proposes how to file each one. */
export async function uploadFiles(files) {
  const queue = [...files].map((file) => ({ key: ++uploadSeq, name: file.name, file, error: null }));
  for (const item of queue) {
    if (item.file.size > MAX_UPLOAD) item.error = "Larger than 10 MB.";
    else if (!/\.(pdf|txt|md)$/i.test(item.name)) item.error = "Only PDF, TXT or Markdown.";
  }
  intake.uploads = [...intake.uploads, ...queue];
  notify();
  const send = async (item) => {
    const stage = (n) => {
      item.stage = n;
      notify();
    };
    let request = null;
    try {
      stage(0);
      if (!offline()) {
        const form = new FormData();
        form.append("file", item.file);
        request = assistantRequest("/intake/documents", { method: "POST", body: form });
        request.catch(() => {}); // awaited below; avoid an unhandled rejection meanwhile
      }
      await wait(450);
      stage(1);
      await wait(650);
      stage(2);
      if (offline()) {
        await wait(750);
        localUpload(item.file);
      } else await request;
      intake.uploads = intake.uploads.filter((u) => u.key !== item.key);
      await reload();
    } catch (error) {
      item.error = error.message;
    }
    notify();
  };
  const pending = queue.filter((i) => !i.error);
  const workers = [0, 1].map(async () => {
    while (pending.length) await send(pending.shift());
  });
  await Promise.all(workers);
  await refreshIntake();
}

export function dismissUpload(key) {
  intake.uploads = intake.uploads.filter((u) => u.key !== key);
  notify();
}

async function withBusy(id, work) {
  intake.busy = { ...intake.busy, [id]: true };
  notify();
  try {
    await work();
    await refreshIntake();
  } catch (error) {
    intake.error = error.message;
  } finally {
    const { [id]: _done, ...rest } = intake.busy;
    intake.busy = rest;
    notify();
  }
}

/** File a document with the person's confirmed details. */
export const fileDocument = (id, filing) =>
  withBusy(id, async () =>
    offline() ? localFile(id, filing) : post(`/intake/documents/${encodeURIComponent(id)}/file`, filing),
  );

/** Remove a document from intake (and from Nabd's search). */
export const removeDocument = (id) =>
  withBusy(id, async () =>
    offline() ? localRemove(id) : assistantRequest(`/documents/${encodeURIComponent(id)}`, { method: "DELETE" }),
  );

/**
 * Recalculate one stadium's progress from its filed plans. The agent's steps
 * are shown one at a time (intake.runs) before the finding replaces the old one.
 */
export async function runCheck(stadiumId) {
  intake.running = { ...intake.running, [stadiumId]: true };
  const { [stadiumId]: _old, ...errors } = intake.errors;
  intake.errors = errors;
  const run = { steps: [], shown: 0 };
  intake.runs = { ...intake.runs, [stadiumId]: run };
  notify();
  try {
    let check;
    if (offline()) {
      await wait(600);
      check = localCheck(stadiumId);
    } else check = await post(`/intake/checks/${encodeURIComponent(stadiumId)}`);
    run.steps = check.steps;
    notify();
    for (let i = 1; i <= run.steps.length; i++) {
      await wait(offline() ? 650 : 320);
      run.shown = i;
      notify();
    }
    await wait(500);
    intake.checks = { ...intake.checks, [stadiumId]: check };
  } catch (error) {
    intake.errors = { ...intake.errors, [stadiumId]: error.message };
  } finally {
    const { [stadiumId]: _done, ...rest } = intake.running;
    const { [stadiumId]: _run, ...runs } = intake.runs;
    intake.running = rest;
    intake.runs = runs;
    notify();
  }
}

/** Check every stadium that has a progress report filed, one after another. onStart(id) runs before each. */
export async function runAllChecks(onStart) {
  for (const id of checkableStadiums().map((s) => s.id)) {
    onStart?.(id);
    await runCheck(id);
  }
}

/** A reviewer accepts or rejects the agent's finding. */
export async function decideCheck(stadiumId, decision, note = "") {
  try {
    intake.checks = {
      ...intake.checks,
      [stadiumId]: offline()
        ? localDecide(stadiumId, decision, note)
        : await post(`/intake/checks/${encodeURIComponent(stadiumId)}/decision`, { decision, note }),
    };
  } catch (error) {
    intake.error = error.message;
  }
  notify();
}

/** File the preloaded sample documents and check their stadiums. */
export async function seedIntake() {
  intake.seeding = true;
  notify();
  try {
    if (!intake.mode) await detectMode();
    apply(offline() ? localSeed() : await post("/intake/seed"));
  } catch (error) {
    intake.error = error.message;
  } finally {
    intake.seeding = false;
    notify();
  }
}

/** With the map's sample data: file and check the sample documents, unless some are already there. */
export async function loadSampleIntake() {
  if (!intake.loaded) await refreshIntake();
  if (!intake.documents.length && !intake.seeding) await seedIntake();
}

/** Remove every intake document and check, online and offline (part of Reset demo). */
export async function clearIntake() {
  localClear();
  intake.uploads = [];
  intake.errors = {};
  try {
    if (intake.mode === "online") await assistantRequest("/intake", { method: "DELETE" });
  } catch {
    // Backend stopped since: the next refresh switches to offline.
  }
  if (intake.loaded) await refreshIntake();
}

// ---------------------------------------------------------------- selectors

export const filedDocuments = () => intake.documents.filter((d) => d.status === "filed");
export const proposedDocuments = () => intake.documents.filter((d) => d.status === "proposed");

/** Stadiums with a current progress report on file. */
export function checkableStadiums() {
  const ids = new Set(
    filedDocuments()
      .filter((d) => d.kind === "progress-report" && !d.superseded)
      .map((d) => d.stadium_id),
  );
  return intake.stadiums.filter((s) => ids.has(s.id));
}

/** A finding a reviewer still has to decide on. */
export const needsDecision = (check) =>
  !!check && !check.decision && (check.status === "overstated" || check.status === "evidence-missing");

/** A proposal is ready to file when the agent identified everything it needs. */
export function proposalReady(d) {
  if (!d.kind || d.kind === "other" || !d.stadium_id) return false;
  if (d.kind === "detailed-plan" && !d.element) return false;
  return d.confidence !== "low";
}

export const CHECK_STATUS = {
  overstated: { label: "Overstated", tone: "bad" },
  "evidence-missing": { label: "Evidence missing", tone: "warn" },
  "behind-plan": { label: "Behind plan", tone: "warn" },
  supported: { label: "Supported", tone: "good" },
};

export const KIND_LABEL = {
  "progress-report": "Progress report",
  "detailed-plan": "Detailed plan",
  other: "Other",
};
