# AQx website

Premium graphite-and-gold one-page website with custom artwork, the v4.1.2 loader, a feature gallery, a custom key-binding demo and Discord delivery.

## Development

Requires Node.js 20 or newer. No third-party runtime dependencies.

```sh
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. Edit files in `dist/`; the browser refreshes automatically.

```sh
npm run dev -- --port 3000
npm run check
npm run build
npm run preview
```

`build` validates the static production files in `dist/`. `preview` serves them without development auto-refresh.

## Vercel

Import the repository with its root as Root Directory. Framework: Other. Build command: `npm run build`. Output directory: `dist`. The included `vercel.json` configures static hosting. No environment variables are required.

## Access

1 day €5.00 / 3 days €7.50 / 30 days €10.00. Keys and builds are delivered manually through [Discord](https://discord.gg/VzHWpB7uG). No payment processing or licensing backend is connected. Provision matching license durations before fulfilling orders.

Prices live in `dist/index.html`; `dist/app.js` updates the selected purchase label. The interactive preset demo stores browser-local bindings only and does not change the application.

## Assets

Custom artwork uses black and champagne gold: a precision sculpture, macro keycaps and the AQx emblem rising behind obsidian mountains. Built-in imagegen prompts are recorded in `art-direction.json`. All artwork and fonts are self-hosted; font licenses are included.

The v4.1.2 loader image is a rendered interface preview with updated AQx branding. The Gameplay tab uses a user-supplied in-game DMZ screenshot with updated branding. Other UI images are project-rendered layouts. The page makes no measured latency, hit-rate, detection or market-ranking claims.

This repository contains website source and public assets only. Application binaries, license keys and backend credentials are excluded.
