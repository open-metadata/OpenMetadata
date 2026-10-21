# Alert forms and views read only the capabilities answer

- **Status:** Accepted
- **Revisions:** v1 2026-10-20 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `EventSubscriptionResourceIT` (the `Deprecation` and `Link` headers on both
  `/resources` lists); `EventSubscriptionResourceTest` (the `Link` keeps a configured base
  path); `watchPerSourceListRequests` in `AiAlertSeveralSources.spec.ts`,
  `AlertSeveralSources.spec.ts` and `ProfileNotificationTab.spec.ts` (no page asks for the
  per-source list)
- **Related:** #20504, PR #35782, PR #33970

## Context
The server says what an alert's sources support in two ways, both built from `AlertCatalog.json`:

- `GET /v1/events/subscriptions/{alertType}/resources` lists every source with its own filters,
  triggers and event types. It dates from when an alert had one source.
- `POST /v1/events/subscriptions/capabilities`, added for alerts on several sources (PR #33970),
  answers for the chosen sources together: the filters all of them support, the triggers any of
  them supports and for which, the recipients, and why a source cannot join. It applies the rules
  the save applies.

The forms took source names from the per-source list and, until the combined answer arrived, used
the first source's rules. One view read only the first source. An alert on several sources could
therefore show rules that only its first source has, and the UI kept a second copy of rules the
server already applies.

## Decision
- Every alert form and view, in both modes and for both alert types, takes the source list,
  filters, triggers, recipients, containers and event types only from `POST /capabilities`.
- Until the first answer for an alert's sources arrives, it shows a loader instead of guessing.
  After that the loader never comes back: a later question keeps the previous answer on screen
  while it loads, and a failure shows an inline error with Retry.
- While what the sources support is unknown, the rules an alert already holds are shown by name,
  and no rule can be added.
- `GET /{alertType}/resources` is deprecated. It still answers as before, adds
  `Deprecation: @1792454400` (RFC 9745, 2026-10-20) and a `Link` to `/capabilities` with
  `rel="alternate"`, and is marked deprecated in its OpenAPI description. The link is a path under
  the one the server is served at, `</api/v1/events/subscriptions/capabilities>` without a base
  path. A later release, named in its release notes, removes it.

## Consequences
One endpoint decides what the UI offers, so a catalog or rule change reaches every form at once and
the UI never offers what the save would reject. A form or view waits for one request before it
renders. API clients of the per-source list keep working until the removal release, and a
one-source selection sent to `/capabilities` gives them the same answer. Revisit only if a client
needs something about a source that `/capabilities` cannot say.
