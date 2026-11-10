# WCA Assurance Website

The active application is a Next.js App Router project in `frontend/`.

## Run locally

Install Node.js 20.9 or newer (a supported LTS release is recommended), then:

```sh
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. No environment variables or backend are required.

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
  `layout.jsx`. Routes: `/` and `/overview`, `/readiness`, `/control-tower`
  (with `/register`, `/gates` and `/[venueId]`), `/decisions-actions`,
  `/design-review`, `/requirements-evidence`, `/dossiers`, `/compliance`.
- `src/components/atoms/` → `molecules/` → `organisms/` → `templates/` →
  `pages/`: React components from smallest to a whole screen. A route renders
  one page component. `PageTemplate` waits for the programme store (it lives in
  localStorage, so pages render after hydration). `FifaLibrary` is a Server
  Component rendered at build time.
- `src/components/providers/`: `AppRuntime` (boots the store, connects
  navigation to the Next router) and `TwinScripts` (loads Three.js and the 3D
  twin).
- `src/lib/domain/`: programme logic — reference data, scoring, the Monte
  Carlo forecast, actions (validation, escalation, decisions, change impact),
  readiness analysis, intake, the dossier and the sourced FIFA catalogue.
- `src/lib/store/`: the programme model (`state.js`, persisted to
  localStorage) exposed to React as an external store through
  `useProgramme()` (`useSyncExternalStore`). Domain actions mutate the model
  and call `rerender()`; UI state changes go through `updateUi()`.
- `src/lib/tour/`: guided demo script, player, voice selection and highlight.
- `src/lib/assistant/`: Nabd chat state, API client and context builder.
- `src/lib/runtime.js`, `navigation.js`, `drawer.js`: view-key routing,
  navigation helpers and the obligation drawer actions.
- `src/styles/`: `tokens.css` (Saudi 2034 brand, light and dark), `base.css`
  (elements, layout, controls) and `components.css` (component styles; class
  names are shared with the tour's selectors).
- `public/scripts/stadium-twin.js`, `public/vendor/`: the imperative 3D twin,
  Three.js r128 and OrbitControls (licenses retained).
- Fonts: Barlow (brand typeface) from `@fontsource/barlow`; IBM Plex Mono in
  `public/fonts/` (SIL Open Font License).
- `public/Assets/`: images, including the Saudi 2034 logo.
- `tests/`: Vitest + React Testing Library (`npm test`).
- `Archive/`: historical standalone HTML snapshots.


## Azure-backed assistant

See [backend/README.md](backend/README.md) for Poetry installation, local API
startup, document upload limits, and the data flow. Run the backend on port 8000
alongside Next.js on port 3000. The chatbot no longer substitutes canned answers
when the backend is unavailable; it displays an actionable error instead.
`NEXT_PUBLIC_API_BASE_URL` is the public backend URL only, never an API key.
