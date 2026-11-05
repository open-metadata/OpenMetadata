# The UI build stays on a Rolldown-based Vite, groups the entry graph into one shell chunk, and keeps /silent-callback off it

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial)
- **Deciders:** karanh37
- **Guard:** `openmetadata-ui/src/main/resources/ui/scripts/check-bundle-chunks.mjs` (`MAX_HTML_BOOTSTRAP_JS_FILES`, boot packages, `MAX_SILENT_CALLBACK_JS_BYTES`), the `no-enum-only-chunks` build plugin; reviewer for group priorities
- **Related:** #36838, open-metadata/openmetadata-collate#7819

## Context
`rolldown-vite` stopped at 7.3.1 and gets no security releases, so the UI moved to Vite 8. Vite 8 is
built on Rolldown 1.x, which no longer folds modules that the entry and lazy routes share into the
entry chunk. Each shared set becomes its own chunk: `index.html` went from 7 JS files to 43, and
enum modules landed in chunks of their own. Rolldown chunk groups capture their members'
dependencies, and whichever group claims a module first keeps it. So a shell group placed below
nothing else swallows React, the router and react-aria. And the few modules `/silent-callback`
shares with the app are under the 50 KiB `minSize`, so their group is dropped and the shell captures
them, which loads the whole shell (3.3 MB) in the silent-refresh iframe.

## Decision
- The UI build uses a Rolldown-based Vite. `vite@7.3.x` was rejected because it builds with
  Rollup, and the chunk config, the enum-chunk guard and the bundle budgets are tuned for Rolldown.
- `vite/chunks.ts` assigns every module that only the main entry reaches statically to `app-shell`,
  except the entry module and its direct children, which keep the entry chunk non-empty. Modules
  that `/silent-callback` also reaches go to `app-auth-shared`.
- The groups in `vite.config.ts` run in this priority order: vendor buckets (priority 2), then
  `app-auth-shared` (priority 1, `minSize: 0`), then `app-shell`.
- The JS that `silent-callback.html` loads is capped at 320 KiB. It was 292,290 B when this was
  decided, almost all of it `oidc-client`, so the cap leaves about 10% headroom.

## Consequences
The bootstrap keeps the rolldown-vite layout: 7 files, about 691 KB Brotli, and the same packages in
each vendor chunk. Reordering the group priorities or dropping `minSize: 0` breaks either the vendor
cache keys or the iframe. `bundle:check` catches the iframe case, but only review catches a vendor
package moving into `app-shell`. Raise the 320 KiB cap only if `oidc-client` or the token storage
grows. Revisit the whole arrangement if Rolldown merges shared modules into the entry chunk again, or
if the config moves to `codeSplitting` and the group semantics change.
