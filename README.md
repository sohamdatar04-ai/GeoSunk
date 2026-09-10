# GeoSunk-AI · Bhu-Suraksha

AI-based early warning dashboard for groundwater-induced land subsidence. Built with React 18, Tailwind CSS, and lucide-react, bundled with Vite. No backend required — everything runs client-side with simulated forecast data, so it deploys as a static site.

## Features

- **Region selector** — Pune–PCMC Corridor, Latur Basin, Mumbai Coastal Pocket, San Joaquin Valley, each with its own simulated zone dataset.
- **Metrics strip** — forecast horizon, pixel resolution, speed metric, accuracy target.
- **GIS map simulation** — toggleable risk / groundwater-extraction / infrastructure layers, zoom & pan controls, color-coded legend.
- **NeuGen AI chat sidebar** — keyword-matched natural-language responses grounded in the active region's zone data.
- **Municipal action table** — sortable-by-risk zone register with a "Trigger Alert / Dispatch Team" action per zone.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview   # optional local check of the dist/ output
```

The static output lands in `dist/`.

## Deploy

**Vercel**
1. Push this folder to a GitHub repo.
2. Import the repo in Vercel — it auto-detects Vite. Build command `npm run build`, output directory `dist`.

**Netlify**
1. Push to GitHub (or drag-and-drop the `dist/` folder after building).
2. Build command `npm run build`, publish directory `dist`.

**GitHub Pages**
1. `npm run build`.
2. Publish the contents of `dist/` to your `gh-pages` branch (e.g. via the `gh-pages` npm package or a GitHub Action), and set `base` in `vite.config.js` to `/<repo-name>/` if you're hosting at a project subpath instead of a custom domain.

## Project structure

```
geosunk-ai/
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
└── src/
    ├── main.jsx
    ├── index.css
    └── App.jsx
```
