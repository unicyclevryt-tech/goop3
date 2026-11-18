# Goop — Vercel 404 fix

This package preserves Goop's page and assets, builds Scramjet/BareMux/Libcurl into `dist/`, and explicitly tells Vercel to publish **dist**, not the source `public` folder.

## Apply
1. Replace the matching files at the root of your `unicyclevryt-tech/Gooprelease` repository. `vercel.json` must be **in the repository root** next to `package.json`. Keep the folders `public/` and `scripts/`.
2. In Vercel, choose the repository root as Root Directory, then Redeploy (clear build cache if offered).
3. Watch the Build Logs: `npm run build` must complete, showing `OK scram/scramjet.all.js`, `OK baremux/index.js` and `OK libcurl/index.mjs`.
4. Visit `https://gooprelease.vercel.app/runtime-health.json` and check `ready: true`.
5. Test `https://gooprelease.vercel.app/scram/scramjet.all.js`, `/baremux/index.js`, and `/libcurl/index.mjs`: each must serve JavaScript, not a 404 page.
6. Clear old service workers for the site (DevTools > Application > Service Workers > Unregister; then reload). Browser cache can retain old broken paths.

## Important
This fixes the **missing static runtime** issue, not every possible Scramjet problem.
Vercel static hosting does not expose the persistent local `/wisp/` WebSocket server from Node. Select an accessible **external `wss://` Wisp relay** in Goop Settings or use a separately hosted Wisp server. A WebSocket handshake alone does not guarantee proxy support.

`Failed to save file to disk` may refer to browser cache/storage or a separate Vercel build error. If this persists, inspect the *first* occurrence in DevTools Network/Console or Vercel's Build Logs.

## Local checks
```
npm install
npm run build
```
Look inside `dist/scram/`, `dist/baremux/` and `dist/libcurl/`.
