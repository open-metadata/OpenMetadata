# Each appConfiguration key is owned by one settings page and written by merge

- **Status:** Accepted
- **Revisions:** v1 2026-10-09 (initial)
- **Deciders:** Chirag Madlani
- **Guard:** `settingConfigAPI.test.ts` (`patchAppConfiguration` keeps unrelated keys);
  `AppConfigurationSettingTest` (`defaultColumnOrder` round-trips, unknown values are rejected)
- **Related:** #29573, #34994

## Context
`appConfiguration` is one settings document that several Platform Settings pages share. Default
App Mode owns `defaultAppMode`, and Table & Schema owns `defaultColumnOrder`. The generic
`PUT /system/settings` replaces the whole document. A page that wrote only its own value would
silently erase the keys the other pages own.

Table & Schema adds `defaultColumnOrder`. Every existing install has no value stored, and their
table schema views sort columns alphabetically today.

## Decision
- The UI writes `appConfiguration` only through `patchAppConfiguration` (`rest/settingConfigAPI.ts`).
  It reads the stored document, overlays the caller's keys, and writes the result. A settings page
  passes only the keys it owns.
- `defaultColumnOrder` is `alphabetical | sourceOrder | null`, and it defaults to `null`. `null`
  means no tenant default is set, so columns sort by name, as before. `sourceOrder` sorts the
  schema table by `ordinalPosition`. The setting applies to tables only.
- The per-page Sort menu still overrides the tenant default for the current view. That choice is
  not saved.

## Consequences
Adding a key to `appConfiguration` needs no migration, as long as `null` keeps today's behavior.
A new writer must go through `patchAppConfiguration` and must not send the full document.

The read-then-write is not atomic. If two admins save different keys at the same moment, the
later write can drop the earlier one. That race is acceptable for settings that rarely change.
Revisit this if the pages move to the backend JSON-patch endpoint, or if `appConfiguration`
starts changing often.

Extending column order to other assets means adding to this enum and recording it here.
