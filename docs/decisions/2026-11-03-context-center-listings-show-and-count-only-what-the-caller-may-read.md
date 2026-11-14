# Context Center listings show and count only what the caller may read

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial) · v2 2026-11-11 (file listings count the same way)
- **Deciders:** Pere Miquel Brull
- **Guard:** `ContextMemoryVisibilityTest`, `ContextMemorySearchVisibilityTest`,
  `ContextMemoryResourceTest`, `ContextFileIT.testListingCountsOnlyFilesTheCallerMaySee`,
  `ContextFileIT.testCountsAgreeWithTheListingForEverySharing`,
  `ListRowAuthorizationIT.aFileListingOrderedByUpdateTimeLeavesOutAndDoesNotCountRowsADenyRuleRefuses`,
  `ListRowAuthorizationIT.aFolderContentsLeavesOutAndDoesNotCountFilesADenyRuleRefuses`,
  `ListRowAuthorizationIT.aFolderContentsLeavesOutSubfoldersADenyRuleRefuses`,
  `FolderResourceIT#test_folderSearchDocumentCarriesNoChildrenCount`
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
the files the caller may see are recounted, never less than the page. A folder's `childrenCount`,
which the Documents page shows as the folder's badge, counts the same files. Both counts are exact:
files have no scan bound.

- `context_file.visibility` is a stored column generated from `shareConfig.visibility`, with an
  index (2.1.0 migration). A file whose visibility is unset or `Entity` is visible to everyone a
  policy allows; any other value only to its user owners and, when `Shared`, the principals it
  names (`ContextFileVisibility`).
- For a caller no rule could refuse a file the listing allowed (`RowDecisionGate`), the count is
  SQL over that column: the open files, plus the restricted files the caller owns (the `OWNS`
  relationship), plus the `Shared` files they do not own whose `sharedWith` names them, the only
  files read, without their extracted text.
- For a caller a rule could refuse (a deny rule or a conditional allow), every file in scope is
  read in batches and passes the listing's row check and the sharing rules. Policy conditions are
  evaluated by the policy engine, never in SQL, so this cost grows with the folder for those
  callers only.

The listing ordered by update time (`orderBy`) applies the same row check to its page, so the page
and its total agree; it does not refill, and its cursors are sealed when rows are checked.

A folder's contents (`/folders/{id}/contents`) list the subfolders and files the folder and file
listings would return to the caller, with the same row checks, and each subfolder's
`childrenCount` is counted as above. The folder search document carries no `childrenCount`, since
no single value is right for every reader.
