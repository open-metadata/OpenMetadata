# The Studio Tasks drawer reads 25 rows a page and keeps page 1 in a 40-cursor Previous history

- **Status:** Accepted
- **Revisions:** v1 2026-10-29 (initial)
- **Deciders:** Harsha
- **Guard:** `OntologyTasksDrawer.test.tsx` ('returns to page 1 with Previous after paging past the kept cursor history', 'replaces after-only queue pages and resets the cursor when changing tabs')
- **Related:** ADR:2026-10-26-approve-and-publish-chains-two-writes-for-an-editall-final-reviewer, PR #36188

## Context

The Tasks drawer pages through two lists. The review queue, `GET /v1/ontologies/reviews` (server
default 25, maximum 100), pages by offset and returns both cursors: `after` for the next page and
`before` for the previous one. A release's events, `GET /v1/ontologyReleases/{id}/events` (server
default 50, maximum 1000), page by keyset and return only `after`, so Previous on that list needs
the client to remember the cursor of each page it has read. The drawer keeps that client history
for both lists, so First, Previous and Next behave the same on either tab and share one code path.
Every client-side cache in this repository must be bounded, so that history needs a cap. The first version dropped the oldest entry once the cap
was reached. That entry was page 1, so after 40 pages Previous stopped at the oldest kept page and
only First returned to page 1.

## Decision

Both lists ask for 25 rows a page (`PAGE_SIZE` in `OntologyTasksDrawer.tsx`). That is the review
queue's own default, and one size for both lists keeps their paging alike.

Each list keeps at most 40 cursors (`CURSOR_HISTORY_LIMIT`). Page 1, which has no cursor, is always
the first entry, followed by the 39 newest cursors. When older cursors are dropped, Previous from
the oldest kept page goes straight to page 1. First always goes to page 1. The history resets when
the account, the selected task, or the queue tab changes.

## Consequences

Previous walks back one page at a time through the last 39 pages, 975 rows at 25 a page. Past that
it jumps to page 1 and skips the dropped pages. This holds on the review queue too, although its
`before` cursor could step back past the window. Both values are UI-only, and the review queue
refuses a page larger than 100. A `before` cursor on the events list would let both lists page
back from the server and drop the client history, and would be the reason to revisit this record.
Using the queue's `before` alone would split the two lists' paging rules and also needs a new
record.
