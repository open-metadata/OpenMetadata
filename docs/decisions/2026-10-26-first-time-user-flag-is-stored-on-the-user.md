# Whether a user is accessing the product for the first time is a flag on the user, not in the browser

- **Status:** Accepted
- **Revisions:** v1 2026-10-26 (initial)
- **Deciders:** Karan Hotchandani
- **Guard:** `UserResourceIT#test_isFirstTimeUserPersistsAcrossSessionsAndPut`;
  `FirstTimeUserMigrationIT`; `RdfOntologyContractTest`; `WelcomeScreenGate.test.tsx`;
  `WelcomeScreen.spec.ts` (the second-browser step)
- **Related:** #36260; ADR:2026-10-09-theme-and-sidebar-preferences-are-per-device;
  ADR:2026-10-09-data-migration-backfills-walk-ids-in-batches

## Context
The home route shows a welcome screen on a user's first login. Who had seen it was kept only in
the browser's `localStorage['loggedInUsers']`, so a new browser, profile or cleared storage showed
it again to users who had used the product for months. Unlike theme and sidebar preferences, this
is a fact about the user, not a per-device choice. It is stored as a general "first time in the
product" flag rather than a welcome-screen field, so other first-run experiences can read it.

## Decision
- `User.isFirstTimeUser` (boolean, default `true`) says whether the user is accessing the product
  for the first time. A new user starts as `true`. The UI shows the welcome screen only while it is
  `true`, and sets it to `false` with a self `PATCH /users/{id}` on the first home visit.
- Clearing it never bumps the user's version or emits a change event. A `PUT /users` keeps the
  stored value, because the CreateUser body does not carry it.
- It is not projected to RDF (`RdfPropertyMapper.NON_GRAPH_PROPERTIES`): it is per-user UI state
  with no metadata meaning.
- The 2.1.0 data migration (`FirstTimeUserMigration`) sets it to `false` for every user with a
  login or activity time and no stored value yet. It walks user ids in batches and skips users who
  already have it, so an interrupted run resumes.
- The legacy `loggedInUsers` list is only read, never written. A user it covers is set to `false`
  on the server instead of being shown the screen. That covers users the migration had no time for.

## Consequences
The screen now shows once per user across browsers and devices. A user who signed in before 2.1.0
but has neither time stored and no legacy entry in the current browser sees it once more. Dropping
the legacy `loggedInUsers` read is safe once no supported upgrade path starts below 2.1.0.
