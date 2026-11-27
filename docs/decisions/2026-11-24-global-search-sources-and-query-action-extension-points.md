# Downstream builds extend AI-mode search through `app-mode.globalSearch.sources` and `app-mode.globalSearch.queryAction`

- **Status:** Accepted
- **Revisions:** v1 2026-11-24 (initial)
- **Deciders:** Rohit0301
- **Guard:** `GlobalSearchModal.test.tsx` (contributed sources and query action), `GlobalSearch.utils.test.ts` (`getUsableSources`)
- **Related:** #38564, open-metadata/openmetadata-collate#8916

## Context
The AI-mode global search (⌘K) lists OpenMetadata's own types: data assets, tasks and every
entity type the search API counts. Collate adds chats as a result type and an "Ask Collate AI"
row on the typed query. OSS must not import Collate code or ship assistant or chat wording.

## Decision
- `app-mode.globalSearch.sources` (`EXTENSION_POINTS.APP_MODE_GLOBAL_SEARCH_SOURCES`) takes
  `GlobalSearchSourceContribution`s, one per result type. `key` is the type's
  `GlobalSearchCategory` and its tab id. It must differ from `all`, `assets`, `tasks`, every
  `EntityType` and every other source's key; `useGlobalSearchSources` drops a contribution that
  breaks this (the first one with a key wins).
  - `search(query, signal)` returns its section; `labelKey` names its tab.
  - Optional: `recent(signal)` rows shown before typing under `recentLabelKey` (falls back to
    `labelKey`); `placeholderKey` for the input when search opens scoped to it;
    `hasScopeShortcut` (⌥⌘K opens search scoped to it); `footer` (`labelKey`, `path`).
  - A row may carry `addon` (e.g. an avatar stack) and `enterLabel` (what Enter does on it).
  - A source whose `search` or `recent` throws (even synchronously) or rejects counts as a failed
    source: its results are left out, and the error card shows if what the user is looking at
    comes back empty. Sources are not timed out, so a slow source delays the results it is
    fetched with; a plugin should honour `signal` and keep its search fast.
- `app-mode.globalSearch.queryAction` (`EXTENSION_POINTS.APP_MODE_GLOBAL_SEARCH_QUERY_ACTION`)
  takes a `GlobalSearchQueryActionContribution`; the last contribution wins. Once the user has
  typed, and unless the search failed, OSS renders its `component` above the results on every tab,
  keeps it keyboard reachable as the first option, and navigates to `getPath(query)` on select or
  ⌘↵. `hintLabelKey` names it in the footer key hints; `emptyHintKey` replaces the no-results hint.
- Any surface opens the search through `useGlobalSearchStore.getState().openSearch(key)`:
  `'all'` for everything, or a source's `key` to open scoped to that source (Collate's chat
  search buttons call `openSearch('chats')`).
- Contributors supply every i18n key for their copy (labels, placeholders, hints). OSS ships no
  assistant or chat wording.

## Consequences
Without contributions the search covers OpenMetadata's types only. Renaming either id or changing
a contribution's shape breaks downstream builds silently, so change them only together with the
consumers and amend this record.
