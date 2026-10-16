# Toggling a Data Asset Rule uses a named compare-and-set endpoint, not a whole-list PUT

- **Status:** Accepted
- **Revisions:** v1 2026-10-16 (initial)
- **Deciders:** detail-app
- **Guard:** `SystemResourceIT` (`toggleEntityRuleEnabled` CAS round-trip, unknown-rule 404, stale-write 412);
  `settingConfigAPI.test.ts` (request body and URL-encoding)
- **Related:** #35639, #35651

## Context
Toggling a Data Asset Rule rebuilt the entire rule list from the client's last-fetched snapshot and
submitted it to `PUT /v1/system/settings`, which blind-replaced the stored document. If another writer
added or edited a rule since the snapshot was fetched, that rule was silently deleted and stopped being
enforced. Adjacent settings paths already had compare-and-set protection; the toggle path bypassed it.

## Decision
Toggling a single rule's `enabled` flag goes through a dedicated endpoint, not the whole-list PUT.

- **REST path:** `PUT /v1/system/settings/entityRulesSettings/rules/{ruleName}/enabled`. `ruleName` is
  URL-encoded by the caller (e.g. spaces become `%20`). Admin-only.
- **Request body:** a bare JSON boolean — `true` or `false` — with `Content-Type: application/json`. The
  client never sends the rule list, so rules the caller never saw are preserved.
- **Response:** `200` with the updated `Settings` on success. `404` when the setting or the named rule
  does not exist. `412 Precondition Failed` when the stored `entityRulesSettings` row changed between the
  server's read and its write — the caller should re-read and retry.
- **Server logic:** `SystemRepository.toggleEntityRuleEnabled` reads the current stored JSON, finds the
  rule by name, sets `enabled`, and writes via `replaceSettingIfCurrent` (CAS). A zero-row update throws
  `PreconditionFailedException` (412).

The add, edit, and delete flows on the legacy Data Asset Rules page still use the whole-list
`PUT /v1/system/settings` and are unchanged.

## Consequences
A concurrent rule add, edit, or delete between the server's read and its write inside the toggle can no
longer be silently lost; the toggle caller gets a 412 and must retry. The endpoint is specific to the `enabled`
flag — toggling any other field still requires the whole-list PUT, which retains its existing race
window. Adding a new toggle target means a new path on this endpoint or a new CAS method.
