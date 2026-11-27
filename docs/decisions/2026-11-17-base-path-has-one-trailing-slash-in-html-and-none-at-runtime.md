# The base path has one trailing slash in rendered HTML and none at UI runtime

- **Status:** Accepted
- **Revisions:** v1 2026-11-17 (initial)
- **Deciders:** Sweta Agarwalla (review of open-metadata/OpenMetadata#37460)
- **Guard:** `IndexResourceTest` (`testPrefixesWithAndWithoutTrailingSlashRenderTheSameAssets`,
  `testEmptyAndRootPrefixesRenderRootAssets`); `HistoryUtils.test.tsx`
- **Related:** open-metadata/OpenMetadata#36320, open-metadata/OpenMetadata#37460

## Context
`conf/openmetadata.yaml` sets `basePath: ${BASE_PATH:-/}`, so `BASE_PATH=/openmetadata` reaches the
server without a trailing slash, while a hand-written config may carry one. The server and the UI
each assumed the slash was present: the server rendered `${basePath}assets/...` as
`/openmetadataassets/...`, and `getBasePath()` ran `slice(0, -1)`, yielding `/openmetadat` as the
router basename and API prefix.

## Decision
- The server renders `${basePath}` in HTML shells (`index.html`, `silent-callback.html`) as the
  configured base path with all trailing slashes removed plus exactly one `/`; `null`, empty and
  root render `/`. ETag cache keys use the same form.
- The UI derives its runtime prefix by removing all trailing slashes from `window.BASE_PATH`; root
  becomes the empty string. Every UI consumer (router, REST, auth, SSE, WebSocket) reads it only
  through `getBasePath()`.
- Interior characters, case and percent-encoding are left unchanged on both sides.

## Consequences
Either form of a configured prefix works without touching deployment config. Neither side may
assume the other's form: a template must write `${basePath}assets/`, never `${basePath}/assets/`,
and UI code must join paths as `${getBasePath()}/...`, never read `window.BASE_PATH` directly.
