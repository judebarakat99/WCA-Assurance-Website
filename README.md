# WCA Assurance Website

The active application is a Next.js App Router project in `frontend/`.

## Run locally

Install Node.js 20.9 or newer (a supported LTS release is recommended), then:

```sh
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. No environment variables are required, and the
whole site, Nabd included, runs in the browser. The Evidence page uses the bundled
sample documents (see `data/progress/README.md` and `data/evidence/README.md`).
The requirements, and the compliance status every page starts from, come from the
register CSVs in `data/register/` (built into the app by `npm run register:build`,
which also runs before `dev` and `build`).
"Load sample data" on the map loads sample assessments and files and checks the
sample documents.

## Check and build

```sh
cd frontend
npm run lint
npm test
npm run build
```

After the first installation, use `npm ci` for reproducible installs from the lockfile.
The build produces a static site in `frontend/out`; serve that directory with a
static web server. `npm start` is not supported with static export.

Local development and default builds use `/`. The GitHub Pages workflow sets
`NEXT_PUBLIC_BASE_PATH=/WCA-Assurance-Website` at build time so the deployed site
and its assets use the repository path. To reproduce that build locally:

```sh
cd frontend
NEXT_PUBLIC_BASE_PATH=/WCA-Assurance-Website npm run build
```

## Structure

Application code lives in `frontend/src/` and is imported through the `@/`
alias (`frontend/jsconfig.json`). Components follow atomic design; routes stay
thin.

- `src/app/`: App Router routes only — `page.jsx` files with metadata, plus
  `layout.jsx`. `/` is the assurance map, with a toggle to the national
  portfolio (`/?view=portfolio`), `/review` the review queue,
  `/evidence` contractor documents (add, agent checks, confirm; evidence joins
  the review queue), `/project-progress` project progress (delivery Gantt,
  schedule, cost performance and progress-check findings), `/reports` report
  export (Word, Excel, PDF), `/compliance` the requirements (FIFA source library and facility register)
  and `/facilities/[facilityId]` a stadium's assessments.
- `src/components/atoms/` → `molecules/` → `organisms/` → `templates/` →
  `pages/`: React components from smallest to a whole screen. A route renders
  one page component. `PageTemplate` waits for hydration (assessments live in
  localStorage). `FifaLibrary` and `FacilityRegister` are Server Components
  rendered at build time.
- `src/components/providers/AppRuntime`: loads the assessments once and
  connects tour navigation to the Next router.
- `src/lib/domain/`: assurance logic — the sourced FIFA catalogue and its
  versions, the facility register, applicability and evaluation
  (`assessment.mjs`), city and programme roll-ups, the review queue,
  requirement-change impact and the labelled sample assessments.
- `src/lib/store/`: `assessments.js` (assessment records and applied
  requirement changes, persisted to localStorage) and `state.js` (shared UI
  state for the map, queue, tour and assistant), exposed to React through
  `useProgramme()` (`useSyncExternalStore`).
- `src/lib/tour/`: guided demo steps, player, voice selection and highlight.
- `src/lib/assistant/`: Nabd's chat state (`chat.js`) and its answers
  (`localChat.js`), worked out in the browser from the same stores the pages
  use: status, stadiums, requirements, the review queue, requirement changes,
  project progress and cost, progress claims, owners and documents.
- `src/lib/register/`: the compliance register (built from `data/register/*.csv`)
  and its CSV extracts; every page reads requirements and the starting
  statuses from here.
- `src/lib/store/intake.js` (with `intakeLocal.js`): documents, progress checks
  and filing, all in the browser; `src/lib/intake/` reads PDFs and runs the
  evidence agent; `alerts.js`: owner alerts.
- `src/lib/domain/delivery.mjs`: project progress per stadium (earned schedule
  and earned value) from the sample `data/progress/programme.json`, using a
  checked progress report's recalculated figure where there is one.
- `src/lib/reports/` builds one format-neutral report model from the same
  stores (`data.js`, `model.mjs`); the preview and the Word, Excel and PDF
  writers (docx, JSZip, pdf-lib, loaded on first export) render it, entirely in
  the browser.

## Azure-backed assistant (backend)

`backend/` holds an Azure OpenAI version of Nabd with document search (see
[backend/README.md](backend/README.md)). The frontend does not call it: Nabd
answers in the browser, so the demo needs no Azure credits.
