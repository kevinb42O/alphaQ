# AQx website

Premium graphite-and-gold one-page website leading with Gold Session Control, plus the v5.1.2 loader, a six-tab menu gallery, release notes and Discord delivery.

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

Import the repository with its root as Root Directory. Framework: Other. Build command: `npm run build`. Output directory: `dist`. The included `vercel.json` configures hosting. The public page requires no secrets; online licensing requires the production environment variables documented in [licensing operations](docs/online-licensing.md). `npm run dev` previews static files; use the production `/admin/` for the deployed license API.

## Access

1 day €5.00 / 3 days €7.50 / 7 days €10.00 / 30 days €15.00 / lifetime €65.00. Keys and builds are delivered manually through [Discord](https://discord.gg/VzHWpB7uG). Online licensing uses Vercel and Supabase; the private management page is `/admin/`. Payment processing remains manual. See [online licensing operations](docs/online-licensing.md).

Prices live in `dist/index.html`. `dist/app.js` updates the selected duration and price.

## Assets

Custom artwork uses black and champagne gold: a precision sculpture, macro keycaps and the AQx emblem rising behind obsidian mountains. Built-in imagegen prompts are recorded in `art-direction.json`. All artwork and fonts are self-hosted; font licenses are included.

The lossless WebP files in `dist/assets/release-5-1-2/` come from two local build sources. What’s new displays the loader opening view from `build/aqx-v5.1.2-20261124T193707Z/ui-fixture/renders/`. The five baseline menu views come from `ui-preview/aqx-gameplay-lifecycle-20261124-r1/`, the direct parent of v5.1.2. The release notes summarise all 18 update groups in the packaged loader.

This repository contains website source and public assets only. Application binaries, license keys and backend credentials are excluded.

## Gold Session Control announcement

The hero, dedicated Session Control showcase, Gameplay gallery, release update, FAQ and social metadata introduce the manual crash action and optional saved keyboard shortcut. The existing six-tab order and Discord access flow are retained.

`dist/assets/session-control/gameplay.webp` is a lossless conversion of `build/aqx-transition-crash-self-20261125-r4/preview/gameplay/premium-tab.png`, with the complete preset sidebar visible. Only this new Gameplay image is used; no compact or sidebar-hidden variant is published. `social-card.jpg` places the same complete screenshot beside typeset launch copy. Other gallery tabs and the loader retain their documented baseline provenance. `dist/app.js` selects the image and provenance per tab.

Loot retention was reported by the owner on the underlying native r5 action. The merged Gold Session Control build has offline control and preview checks; live acceptance is separate. The site describes the manual action and player-tested outcome without promising protection against every death or disconnect.
