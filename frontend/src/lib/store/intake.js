// Contractor documents and progress checks, held in this browser (lib/store/intakeLocal). This module keeps
// the latest copy for the Evidence, Project progress and Review queue pages, and calls notify() on every change
// so useProgramme() components re-render.
import {
  localCheck,
  localClear,
  localDecide,
  localFileAndSync,
  localIngest,
  localRemove,
  localSeed,
  localState,
} from "@/lib/store/intakeLocal";
import { notify } from "@/lib/store/state";

export const MAX_UPLOAD = 10 * 1024 * 1024;

export const intake = {
  loaded: false,
  loading: false,
  error: null,
  stadiums: [],
  elements: [],
  documents: [],
  checks: {},
  uploads: [], // added files: { key, batch, name, stage, error, document }
  batch: null, // the latest batch of added files
  running: {}, // stadium id -> true while a check runs
  runs: {}, // stadium id -> { steps, shown } while a check's steps play back
  errors: {}, // stadium id -> last check error
  seeding: false,
  busy: {}, // document id -> true while filing or removing
};

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

// Pacing for the agent's visible progress, so its stages and steps can be followed. Instant when the system
// asks for reduced motion.
const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, reducedMotion() ? 0 : ms));

/** The pipeline every added file moves through, in order; the last stage means the agent has finished. */
export const UPLOAD_STAGES = ["Received", "Classified", "Matched to requirements", "Validated"];

// Reload without the loading guard, so results appear as each file finishes.
const reload = () => apply(localState());

/** Load (or reload) everything. */
export async function refreshIntake() {
  if (intake.loading) return;
  intake.loading = true;
  notify();
  try {
    apply(localState());
  } catch (error) {
    intake.error = error.message;
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
let batchSeq = 0;
/**
 * Add files, two at a time: each moves through UPLOAD_STAGES while the agent reads it and proposes how to file it.
 * Returns the batch: [{ key, name, stage, error, document }], document being the proposal (or the existing row).
 */
export async function uploadFiles(files, context = {}) {
  const batch = ++batchSeq;
  const queue = [...files].map((file) => ({ key: ++uploadSeq, batch, name: file.name, file, error: null, document: null }));
  intake.batch = batch;
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
    try {
      stage(0);
      await wait(700);
      stage(1);
      await wait(700);
      stage(2);
      item.document = await localIngest(item.file, context);
      await wait(700);
      stage(3);
      await wait(500);
      reload();
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
  return queue;
}

export function dismissUpload(key) {
  intake.uploads = intake.uploads.filter((u) => u.key !== key);
  notify();
}

/** The files of the latest batch, as they move through the pipeline. */
export const currentBatch = () => intake.uploads.filter((u) => u.batch === intake.batch);

/** Start again: forget the finished batch, so the Evidence page is ready for the next documents. */
export function clearBatch() {
  intake.uploads = intake.uploads.filter((u) => u.batch !== intake.batch);
  intake.batch = null;
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
export const fileDocument = (id, filing) => withBusy(id, async () => localFileAndSync(id, filing));

/** Remove a document from intake (and from Nabd's search). */
export const removeDocument = (id) => withBusy(id, async () => localRemove(id));

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
    await wait(600);
    const check = localCheck(stadiumId);
    run.steps = check.steps;
    notify();
    for (let i = 1; i <= run.steps.length; i++) {
      await wait(650);
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
      [stadiumId]: localDecide(stadiumId, decision, note),
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
    apply(localSeed());
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

/** Remove every document and check (part of Reset demo). */
export async function clearIntake() {
  localClear();
  intake.uploads = [];
  intake.errors = {};
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
  evidence: "Evidence document",
  other: "Other",
};
