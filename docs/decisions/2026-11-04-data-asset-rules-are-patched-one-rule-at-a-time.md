# Data Asset Rules are changed one rule at a time, by name, through a JSON Patch on that rule

- **Status:** Accepted
- **Revisions:** v1 2026-11-04 (initial)
- **Deciders:** Shailesh Parmar
- **Guard:** `SystemResourceIT` (`test_patchEntityRule_*`: one rule changes and the rest are kept, a
  rule added by another writer survives, unknown rule 404, rename/add/remove 400);
  `SystemSettingItemPatchTest`; `settingConfigAPI.test.ts` (request path, body and content type)
- **Related:** #35639, #35651

## Context
Toggling a Data Asset Rule rebuilt the whole rule list from the client's last-fetched copy and sent it
to `PUT /v1/system/settings`, which replaced the stored document. A rule another writer added or
edited after that copy was read was silently dropped and stopped being enforced (#35639).

A first fix added `PUT /settings/entityRulesSettings/rules/{ruleName}/enabled`. Review rejected that
shape: it changes one field, so every later per-rule edit would need another narrow endpoint or fall
back to the racy whole-list PUT, and once in OpenAPI and the generated SDKs the path is hard to change.

## Decision
A single Data Asset Rule is changed by name with a JSON Patch on that rule:

- **REST:** `PATCH /v1/system/settings/entityRulesSettings/rules/{ruleName}`, admin-only,
  `Content-Type: application/json-patch+json`. `ruleName` is URL-encoded (spaces as `%20`).
- **Body:** RFC 6902 operations whose paths are relative to the rule — the toggle sends
  `[{"op": "replace", "path": "/enabled", "value": false}]`. A path that is not a JSON Pointer
  (non-empty and not starting with `/`) is a `400`.
- **Guards:** the patch may not rename, add or remove rules (`400`); the patched settings must still
  validate against `entityRulesSettings` (`400`). An unknown rule is a `404`.
- **Concurrency:** the server finds the rule's position and the compare-and-set expectation in the
  same read, rebases the patch onto that position, and writes only if the stored row is unchanged.
  A concurrent write is a `412`; the caller re-reads and retries. It is never a lost update or a
  patch applied to whichever rule has moved into that position.
- **Server helper:** `SystemRepository.patchSettingItem(type, listPointer, itemName, patch)` is the
  one way to patch an item of a list inside a setting. New per-item endpoints call it rather than
  adding another read-find-write path.

The whole-list `PUT /v1/system/settings` for `entityRulesSettings` is legacy. Rules move off it.

## Consequences
A rule toggle can no longer drop rules the caller never read. Any later per-rule field edit reuses the
same endpoint with a different patch.

Known remaining work, each a separate change:
- Add, edit and delete on the legacy Data Asset Rules page still send the whole list through
  `PUT /v1/system/settings`. A stale save there can still drop newer rules or undo a patch. They move
  to `POST /rules` and `DELETE /rules/{name}` plus this PATCH; then the whole-list PUT for this
  setting is removed.
- Glossary term relation types (`/settings/glossaryTermRelationSettings/relationTypes/{name}`) read
  the setting twice and report a concurrent change as `400`. They move onto `patchSettingItem`.
