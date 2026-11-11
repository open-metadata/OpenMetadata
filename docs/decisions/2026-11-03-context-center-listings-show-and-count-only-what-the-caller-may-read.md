# Context Center listings show and count only what the caller may read

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial) · v2 2026-11-11 (file listings count the same way)
- **Deciders:** Pere Miquel Brull
- **Guard:** `ContextMemoryVisibilityTest`, `ContextMemorySearchVisibilityTest`,
  `ContextMemoryResourceTest`, `ContextFileIT.testListingCountsOnlyFilesTheCallerMaySee`,
  `ListRowAuthorizationIT.aFileListingOrderedByUpdateTimeLeavesOutAndDoesNotCountRowsADenyRuleRefuses`
- **Related:** ADR:2026-10-15-search-admits-a-subjects-own-pending-memories-on-request;
  ADR:2026-10-15-a-memory-cites-its-supporting-queries-and-their-retirement-holds-it-for-review;
  ADR:ai-platform/2026-10-11-explicit-memory-delete-searches-every-status

## Context

Release testing found the Context Center Memories page showing a reader another user's Shared
memory still awaiting review. The listing asks search for every stage it shows, and search admitted
any requested stage to whoever could see the memory. The plain list endpoint also reported the
database's `paging.total`, which counted memories the caller cannot see. That happened both on a
count-only call (`limit=0`) and on any page that hid none itself.

## Decision

- A memory awaiting review (`Unprocessed` or `Draft`) is listed to its owners and to admins only,
  never to another reader. This holds for the search-backed listing (`statuses=`, the
  three-argument `ContextMemorySearchVisibility.buildVisibilityFilter`), the plain list, and the
  per-document cards (`ContextMemoryVisibility.filterListed`). Every other stage keeps the share
  rules.
- A document's pills are written by the extractor (`FileExtraction`, `PageExtraction`), so the
  person who uploaded the document owns none of them. The plain list therefore also shows a
  document's pending pill to the document's owners. Search cannot check who owns each pill's
  document, so the search-backed listing shows a pending pill only to its owner and admins. A
  document's owners find its pending pills on the document's card.
- A direct read by id keeps the share rules in every stage, which is how a review task's
  assignees open the memory.
- Bots get no special case: no server-side caller lists memories as a bot. ai-platform impersonates
  the user on every memory call, and Collate reads memories through the DAO and search.
- The plain list's `paging.total` stands only when the page shows every row the database counted.
  Otherwise the rows the caller may list are recounted over at most `MAX_VISIBLE_COUNT_SCAN`
  (10,000) rows, and the total is never less than the page. Past that bound it is a lower bound,
  never a count of hidden rows.

## Consequences

- Draft, the review queue, belongs to the memory's owners and to admins. That includes an evidence
  hold, which opens no review task.
- The sidebar badge and dashboard count only the caller's own pending memories; an admin's count
  includes everyone's.
- A plain-list page that does not show every counted row costs one bounded extra read, plus one
  ownership lookup per document whose pending pills are on it.

## Amendment

### v2 2026-11-11 — file listings count the same way

The plain file listing (`/v1/contextCenter/drive/files`) reports its `paging.total` by the same
rule as the plain memory list: it stands only when the page shows every counted row, and otherwise
the files the caller may see are recounted over at most `MAX_VISIBLE_COUNT_SCAN` rows, never less
than the page. The recount reads the rows straight from the repository and applies the listing's
row check and the file sharing rules; the caller's teams and domains are resolved once per list.
The listing ordered by update time (`orderBy`) applies the same row check to its page, so the page
and its total agree; it does not refill, and its cursors are sealed when rows are checked.
