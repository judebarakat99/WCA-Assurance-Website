# WFA Assurance Website

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
npm start
```

After the first installation, use `npm ci` for reproducible installs from the lockfile.
For hosting, set the project root to `frontend`, build with `npm run build`, and
start with `npm start`.

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

## Migration scope

The page now runs through Next.js and React. The existing interactive views still
use imperative DOM rendering, hash navigation, and browser localStorage. They
remain separate browser scripts to preserve current behavior, including the 3D
stadium and guided demos. This is a framework migration, not a complete rewrite
of every view as a React component. Use full reloads when editing legacy scripts;
Fast Refresh does not reinitialize scripts already loaded by Next.js.

For future React work, migrate one view at a time and remove its corresponding
legacy DOM rendering and event handlers. Do not render React children inside a
root still owned by the legacy scripts. Sample data is stored per browser origin;
existing data from a `file://` version does not transfer to localhost automatically.
