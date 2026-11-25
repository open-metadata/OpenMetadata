# The UI computes a column deep link's page by mirroring the server's column sort

- **Status:** Accepted
- **Revisions:** v1 2026-11-24 (initial)
- **Deciders:** UI maintainers
- **Guard:** `getColumnPageForFqn` cases in `openmetadata-ui/.../src/utils/TablePureUtils.test.ts`, and reviewer for the backend side
- **Related:** open-metadata/openmetadata-collate#7404, PR #38594

## Context
A column link (`/table/{column-fqn}`) carries no page. The schema tab pages columns from the server
(`GET /tables/name/{fqn}/columns`), so a linked column past page 1 never rendered and its row was
never highlighted. No endpoint returns a column's position in the paged list, but the table entity
the page already holds carries every column.

## Decision
`getColumnPageForFqn` (`TablePureUtils.ts`) sorts `table.columns` with the same order as
`TableRepository.columnComparator`: `name` case-insensitive or `ordinalPosition`, nulls last, the
whole comparator reversed for `desc`. The column's index in that order gives the page. Any change to
the server's column paging order (a tie-breaker, a new sort field, different null handling) must
update both together.

## Consequences
No extra request and no new API. In exchange the server order is a contract the UI has to match:
if they drift, a deep link opens on the wrong page and the row is not highlighted, though the
detail panel still opens. A server endpoint that returns a column's offset would remove this
coupling and make it worth revisiting.
