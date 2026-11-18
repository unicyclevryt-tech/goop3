# Goop — Scramjet storage repair

## Fast fix for the `NotFoundError: transaction on IDBDatabase` error

1. Replace `public/sw.js` and add `public/repair.html` in your GitHub repository. The ZIP also includes the unchanged Goop site, build script, and `vercel.json`.
2. Redeploy on Vercel (the project must publish the `dist/` build output).
3. Open `https://gooprelease.vercel.app/repair.html` and click **Reset proxy storage**.
4. Close all other Goop tabs, then return to the homepage and hard-refresh (Ctrl+Shift+R).
5. Try one search.

The repair page unregisters service workers and deletes only proxy-related IndexedDB databases. It does not erase Goop's localStorage bookmarks/settings. It can clear login sessions within proxied websites.

## Why this happened
A stale or incompatible Scramjet IndexedDB schema can be missing an object store. `sw.js` previously called `scramjet.loadConfig()` for every request, even a favicon, triggering repeated rejected fetches. The new worker only loads proxy config for requests inside `/scramjet/` and catches storage errors.

## If the error remains
In Chrome: DevTools > Application > IndexedDB, remove Scramjet-related databases; Application > Service Workers > Unregister; refresh. (The browser may need all Goop tabs closed for IndexedDB deletion.)

Check that `/scram/scramjet.all.js`, `/baremux/index.js`, and `/libcurl/index.mjs` all return HTTP 200 after deploy.

`bare-mux: SharedWorker ... retrying` may be a consequence of failed worker startup, but can also be a separate error. Check Chrome's `chrome://inspect/#workers` and the browser console if the IndexedDB error disappears but connectivity still fails.

The change has been syntax-checked but a live Vercel proxy search has not been verified.
