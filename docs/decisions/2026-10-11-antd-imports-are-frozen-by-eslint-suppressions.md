# Ant Design imports are frozen by ESLint suppressions and migrated components cannot return

- **Status:** Accepted
- **Revisions:** v1 2026-10-11 (initial)
- **Deciders:** Harshit Shah
- **Guard:** `openmetadata-ui/src/main/resources/ui/eslint-rules/openmetadata-antd.test.mjs`
- **Related:** open-metadata/openmetadata-collate#6884, open-metadata/openmetadata-collate#6890

## Context
Ant Design is being replaced by `@openmetadata/ui-core-components`. `scripts/tw-deprecation-guard.js`
blocks new antd imports in a diff, but only at commit and CI time, and it cannot stop a component
that reached zero usage from coming back through a file that still imports other antd symbols.

## Decision
Two ESLint rules in `eslint-rules/openmetadata-antd.mjs` run on `src/**`:

- `openmetadata-antd/no-antd-import` reports every symbol imported from `antd`, `antd/*` or
  `@ant-design/icons` (including type, re-export, dynamic and `require` imports). The existing
  backlog is stored per file in `eslint-suppressions.json`, ESLint's native bulk suppressions.
  Adding a symbol exceeds the file's count and fails; removing one leaves an unused suppression
  that fails until `yarn lint:src:suppressions` prunes it. The total suppressed count is pinned in
  the guard test, so regenerating suppressions cannot absorb new usage silently.
- `openmetadata-antd/no-migrated-antd-import` reports components listed in
  `MIGRATED_ANTD_COMPONENTS` in `eslint.config.mjs`. It is never suppressed. A component is added
  there in the PR that removes its last import.

## Consequences
A PR that removes antd usage must prune the suppressions and lower the pinned total. Counts are
per file and per rule, so replacing one antd symbol with another in the same file is not caught
unless the new symbol belongs to a migrated component. To retire the mechanism, delete both rules
once `no-antd-import` has no suppressions left.
