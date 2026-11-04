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

- `frontend/app/page.jsx`: React page shell and demo mount points.
- `frontend/app/layout.jsx`: document metadata and viewport.
- `frontend/app/globals.css`: original styling, with local font files.
- `frontend/components/LegacyScripts.jsx`: ordered browser-only script loading.
- `frontend/public/scripts/`: stadium twin, assurance application, and menu logic.
- `frontend/public/vendor/`: original Three.js r128 and OrbitControls, retaining licenses.
- `frontend/public/fonts/`: fonts extracted from the original HTML; original SIL Open Font License notice retained in CSS.
- `frontend/public/Assets/`: images, served at `/Assets/...`.
- `Archive/`: historical standalone HTML snapshots.

