# Topic schema-field search returns each match as its own childless row

- **Status:** Accepted
- **Revisions:** v1 2026-11-16 (initial) · v2 2026-11-16 (explicit `sortBy=schema` for stored order; Name sort kept in the URL)
- **Deciders:** Rohit Jain
- **Guard:** `TopicResourceIT.schemaFieldSearch_matchesNestedFieldsAndPages`, `TopicResourceIT.schemaFieldSearch_sortsByNameBeforePaging`, `TopicResourceIT.schemaFieldPage_schemaSortKeepsStoredOrder`
- **Related:** #30677, #37862

## Context
The topic Schema tab rendered every schema field at once and froze on topics with hundreds of
fields, so it now pages fields from the server. Searching has to find nested fields, and the UI
keys rows by `fullyQualifiedName`. If a matched parent kept its children while a matched child was
also returned, the same FQN would render twice and corrupt expand and highlight state.

## Decision
`GET /v1/topics/name/{fqn}/columns/search` (`q`, `limit` 1–1000 default 50, `offset`, `fields`,
`include`, `sortBy`, `sortOrder`) authorizes with `VIEW_BASIC` like `/columns`. It:
- matches `name`, `displayName` or `description` case-insensitively at every nesting level;
- returns each match as its own row with no `children`;
- orders matches in schema order, or by name when `sortBy=name`;
- pages by offset after filtering and sorting.

The stored topic is never modified; rows are copies.

## Consequences
- Search results never repeat an FQN, and paging counts each match once.
- A matched parent does not show its non-matching children in search mode. Clearing the search
  restores the nested view from `/columns`.
- This shape differs from the table and data-model search endpoints, which return matches with
  their children.
- Tag and glossary filters are not part of this endpoint. Adding them means filtering here, before
  paging.

## Amendment
v2: `/columns` sorts by name by default, and v1 kept stored order by asking for `sortBy=ordinalPosition`.
That only worked because topic fields have no ordinal position, so every field tied under a
stable sort. Both topic field endpoints now accept **`sortBy=schema`**, which skips sorting and
returns fields in stored order. The Schema tab always sends either `sortBy=schema` or
`sortBy=name`, never relying on a tie. Its Name sort is kept in the URL (`fieldSort=asc|desc`)
with the page and search, so a reload returns the same rows. The `/columns` default stays `name`
for existing API clients.
