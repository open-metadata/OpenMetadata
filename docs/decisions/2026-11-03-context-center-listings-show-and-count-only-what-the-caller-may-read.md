# Context Center listings show and count only what the caller may read

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `ContextMemoryVisibilityTest`, `ContextMemorySearchVisibilityTest`,
  `ContextMemoryResourceTest`
- **Related:** ADR:2026-10-15-search-admits-a-subjects-own-pending-memories-on-request;
  ADR:2026-10-15-a-memory-cites-its-supporting-queries-and-their-retirement-holds-it-for-review;
  ADR:ai-platform/2026-10-11-explicit-memory-delete-searches-every-status

## Context

Release testing found the Context Center Memories page showing a reader another user's Shared
memory still awaiting reconciliation. The listing asks search for every stage it shows, and search
admitted any requested stage to whoever could see the memory, or to every admin. The plain list
endpoint also reported the database's `paging.total`, which counted memories the caller cannot
see, both on a count-only call (`limit=0`) and on any page that hid none itself.

## Decision

- A listing shows an `Unprocessed` memory that a person wrote to its owners only, admins included.
  Until reconciliation decides it, it is its author's. A pill extracted from a document
  (`FileExtraction`, `PageExtraction`) has no author awaiting review, so it follows the share rules
  in every stage, as its document does. The rule is `ContextMemoryVisibility.isListedToOwnersOnly`
  on the plain list. The search-backed listing (`statuses=`) applies the same rule through the
  three-argument `ContextMemorySearchVisibility.buildVisibilityFilter`.
- `Draft` and every other stage keep the share rules. Draft is the review queue: an evidence hold
  opens no task, so admins and the memory's readers must keep finding it in the list.
- A direct read by id follows the share rules in every stage.
- The plain list's `paging.total` stands only when the page shows every row the database counted.
  Otherwise the rows the caller may list are recounted over at most `MAX_VISIBLE_COUNT_SCAN`
  (10,000) rows, and the total is never less than the page. Past that bound the total is a lower
  bound, never a count of hidden rows.

## Consequences

- An admin no longer lists or counts another user's `Unprocessed` memories: reconciliation, not a
  person, decides them. The sidebar badge and dashboard count the caller's own.
- AskCollate's explicit delete looks memories up through this listing, so it finds the caller's
  own `Unprocessed` memories, not another user's.
- A plain-list page that does not show every counted row costs one bounded extra read.
