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

- `frontend/app/`: one App Router page per view — `/readiness`, `/control-tower`
  (with `/control-tower/register`, `/control-tower/gates`, and a
  `/control-tower/[venueId]` detail page per venue), `/decisions-actions`,
  `/design-review`, `/requirements-evidence`, and `/dossiers`. The home page
  shows the Readiness Room and redirects legacy `#hash` bookmarks.
- `frontend/app/layout.jsx`: document metadata, shared header, and overlay roots.
- `frontend/app/globals.css`: original styling, with local font files.
- `frontend/lib/`: shared modules split from the original `assurance.js` —
  `data.js` (reference data and helpers), `state.js` (store with localStorage
  persistence), `scoring.js`, `forecast.js` (Monte Carlo), `actions.js`
  (validation, escalation, decisions, change impact), and `engine.js`
  (client runtime: rendering, routing bridge, delegated events).
- `frontend/components/Header.jsx`: shared navigation header with route tabs.
- `frontend/components/AppView.jsx` / `Home.jsx`: client mount points per page.
- `frontend/components/views/`: page-specific view modules (tower, readiness,
  register, gates, venue detail, actions, requirements, dossier) plus shared
  cards, the obligation drawer, the guided demos, and the AI assistant.
- `frontend/components/LegacyScripts.jsx`: ordered browser-only script loading
  for the 3D twin.
- `frontend/public/scripts/`: stadium twin and menu logic.
- `frontend/public/vendor/`: original Three.js r128 and OrbitControls, retaining licenses.
- `frontend/public/fonts/`: fonts extracted from the original HTML; original SIL Open Font License notice retained in CSS.
- `frontend/public/Assets/`: images, served at `/Assets/...`.
- `Archive/`: historical standalone HTML snapshots.

