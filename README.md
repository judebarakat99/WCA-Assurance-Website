# WCA Assurance Website

The active application is a Next.js App Router project in `frontend/`.

## Run locally

Install Node.js 20.9 or newer (a supported LTS release is recommended), then:

```sh
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. No environment variables are required. Nabd needs
the backend; without it the Intake page runs as a labelled offline demo of the
sample documents (see `data/progress/README.md`). "Load sample data" on the map
loads sample assessments and files and checks the sample documents.

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
  `/intake` document intake and progress verification, `/reports` report
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
- `src/lib/assistant/`: Nabd chat state, API client and the assurance snapshot
  sent with each question.
- `src/lib/store/intake.js`: intake documents and progress checks, loaded from
  the backend.
- `src/lib/domain/report.mjs` builds one format-neutral report model; the preview
  and `src/lib/export/` (docx, exceljs, jsPDF + AutoTable, loaded on first export)
  render it, entirely in the browser.
- `src/lib/runtime.js`: view-key routing for the tour.
- `src/styles/`: `tokens.css` (Saudi 2034 brand, light and dark), `base.css`
  (elements, layout, controls) and `components.css` (component styles; class
  names are shared with the tour's selectors).
- Map: MapLibre GL JS (BSD-3-Clause, no account or API key) draws
  `data/geo/sa-regions.geo.json` (geoBoundaries / OpenStreetMap, ODbL; the map
  shows the required credit). No basemap tiles are loaded.
- Fonts: Barlow (brand typeface) from `@fontsource/barlow`; IBM Plex Mono in
  `public/fonts/` (SIL Open Font License).
- `public/Assets/`: the Saudi 2034 logo, and `places/` photos for the map's
  hover cards (Wikimedia Commons, CC BY / CC BY-SA, credited on each card;
  sources in `src/lib/placePhotos.json`). Stadiums without a free photo show
  their host city's photo, labelled; NEOM has none.
- `tests/`: Vitest + React Testing Library (`npm test`).
- `data/`: the FIFA catalogue and change scenarios, the facility register,
  region boundaries and the sample contractor documents (each folder has a
  README).
- `Archive/`: historical standalone HTML snapshots.

## Azure-backed assistant

See [backend/README.md](backend/README.md) for Poetry installation, local API
startup, document upload limits, and the data flow. Run the backend on port 8000
alongside Next.js on port 3000. The chatbot no longer substitutes canned answers
when the backend is unavailable; it displays an actionable error instead.
`NEXT_PUBLIC_API_BASE_URL` is the public backend URL only, never an API key.
