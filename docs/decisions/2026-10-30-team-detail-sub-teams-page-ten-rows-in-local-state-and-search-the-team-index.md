# Team detail sub-teams page 10 rows in local state and search the team index

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** Vansh0310
- **Guard:** `MembersTeamDetail.test.tsx` ('loads ten sub-teams at a time and labels the tab with the full count', 'finds a sub-team that is not on the loaded page through the team index', 'pages search results by number on the backend'); `reviewer` for the local page state and the table height
- **Related:** PR #36678

## Context

The Teams tab of the team detail page loaded every sub-team at once (768 on one local instance),
showed about four rows, and filtered them in the browser. Paging alone would break that filter:
`GET /v1/teams` has no name filter, so filtering one cursor page misses sub-teams on the others.
`usePaging` keeps its page in URL params the Users tab already uses, and most team types show both
tabs, so sharing it would let one tab drive the other's page.

## Decision

- Sub-teams load 10 rows a page (`PAGE_SIZE`), with 25 and 50 offered (`TEAMS_PAGE_SIZE_OPTIONS`).
- The table is at most 149 spacing units tall (`TEAMS_TABLE_SCROLL`): a 9-unit header and ten
  14-unit rows. Longer pages scroll inside it, so the search bar and header stay in place.
- The page and page size are local state in `MembersTeamDetail`, not `usePaging`.
- Browsing reads `/teams` cursors and steps one page at a time, so no jump is offered.
- A search runs over all of the team's sub-teams on the team index, with a `term` filter on
  `parents.id` for the team's id, as `TeamDetailsV1` does, so only direct children match. It pages
  by number, so any result page can be opened.
- Changing the team, the page size or the deleted filter restarts from the first page.

## Consequences

- A reload or a shared link opens the first page with no search term.
- Search is only as complete as the team index. A team missing from it still appears while
  browsing but cannot be found until a reindex; one local index held 79 of 781 teams.
- This view depends on `parents.id` staying a `keyword` in `team_index_mapping.json`, which the
  search layer owns.
- Search rows show 0 sub-teams and no expand arrow. `childrenCount` is computed on read, and
  neither the mapping nor `TeamIndex.getRequiredReindexFields()` names it, so a reindex does not
  fill it. Showing the real count needs a backend change that puts it in the index.
- Page params scoped to each tab would be the reason to move the page into the URL, and a name
  filter on `/teams` would be the reason to take search off the index. Either needs a new record.
