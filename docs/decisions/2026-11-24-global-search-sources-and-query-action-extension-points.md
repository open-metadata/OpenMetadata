# Downstream builds extend AI-mode search through `app-mode.globalSearch.sources` and `app-mode.globalSearch.queryAction`

- **Status:** Accepted
- **Revisions:** v1 2026-11-24 (initial)
- **Deciders:** Rohit0301
- **Guard:** `GlobalSearchModal.test.tsx` (contributed sources and query action)
- **Related:** #38564, open-metadata/openmetadata-collate#8916

## Context
The AI-mode global search (⌘K) lists OpenMetadata's own types: data assets, tasks and every
entity type the search API counts. Collate adds chats as a result type and an "Ask Collate AI"
row on the typed query. OSS must not import Collate code or ship assistant or chat wording.

## Decision
- `app-mode.globalSearch.sources` (`EXTENSION_POINTS.APP_MODE_GLOBAL_SEARCH_SOURCES`) takes
  `GlobalSearchSourceContribution`s, one per result type. `key` is the type's
  `GlobalSearchCategory` and its tab id; it must differ from `assets`, `tasks` and every entity type.
  `search(query, signal)` returns its section; `recent`, `placeholderKey`, `hasScopeShortcut`
  (⌥⌘K opens search scoped to it) and `footer` are optional.
- `app-mode.globalSearch.queryAction` (`EXTENSION_POINTS.APP_MODE_GLOBAL_SEARCH_QUERY_ACTION`)
  takes a `GlobalSearchQueryActionContribution`; the last contribution wins. OSS renders its
  `component` first in the list on every tab, keeps it keyboard reachable, and navigates to
  `getPath(query)` on select or ⌘↵.
- Contributors supply every i18n key for their copy (labels, placeholders, hints). OSS ships no
  assistant or chat wording.

## Consequences
Without contributions the search covers OpenMetadata's types only. Renaming either id or changing
a contribution's shape breaks downstream builds silently, so change them only together with the
consumers and amend this record.
