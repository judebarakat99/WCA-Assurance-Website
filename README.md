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
alias (`frontend/jsconfig.json`). Components follow atomic design.

- `src/app/`: App Router routes only (thin `page.jsx` files, `layout.jsx`,
  metadata). Routes: `/overview`, `/readiness`, `/control-tower` (with
  `/register`, `/gates` and `/[venueId]`), `/decisions-actions`,
  `/design-review`, `/requirements-evidence`, `/dossiers`, `/compliance`.
- `src/components/atoms/`, `molecules/`, `organisms/`, `templates/`: React
  components, smallest to largest. Pages compose templates and organisms.
- `src/lib/domain/`: pure programme logic — reference data, scoring, the
  Monte Carlo forecast, actions (validation, escalation, decisions, change
  impact) and the sourced FIFA catalogue.
- `src/lib/store/`: client state with localStorage persistence.
- `src/lib/assistant/`: assistant API client and context builder.
- `src/legacy/`: the original string-template views and the runtime that
  renders them (`engine.js`). Pages move out of here as they are rebuilt as
  React components; the folder is deleted when the last one moves.
- `src/app/globals.css`: Saudi 2034 brand tokens (light and dark) at the top;
  rules below use tokens, not colour literals. The header toggle saves the
  theme; without a saved choice the site follows the OS setting.
- `public/scripts/`, `public/vendor/`: 3D stadium twin, menu logic, Three.js
  r128 and OrbitControls (licenses retained).
- Fonts: Barlow (brand typeface) from `@fontsource/barlow`; IBM Plex Mono in
  `public/fonts/` (SIL Open Font License).
- `public/Assets/`: images, including the Saudi 2034 logo.
- `tests/`: Node test runner; `tests/resolve.mjs` mirrors the `@/` alias.
- `Archive/`: historical standalone HTML snapshots.


## Azure-backed assistant

See [backend/README.md](backend/README.md) for Poetry installation, local API
startup, document upload limits, and the data flow. Run the backend on port 8000
alongside Next.js on port 3000. The chatbot no longer substitutes canned answers
when the backend is unavailable; it displays an actionable error instead.
`NEXT_PUBLIC_API_BASE_URL` is the public backend URL only, never an API key.
