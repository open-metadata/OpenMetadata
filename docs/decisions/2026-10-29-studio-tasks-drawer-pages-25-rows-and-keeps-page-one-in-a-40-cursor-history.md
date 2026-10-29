# The Studio Tasks drawer reads 25 rows a page and keeps page 1 in a 40-cursor Previous history

- **Status:** Accepted
- **Revisions:** v1 2026-10-29 (initial)
- **Deciders:** Harsha
- **Guard:** `OntologyTasksDrawer.test.tsx` ('returns to page 1 with Previous after paging past the kept cursor history', 'replaces after-only queue pages and resets the cursor when changing tabs')
- **Related:** ADR:2026-10-26-approve-and-publish-chains-two-writes-for-an-editall-final-reviewer, PR #36188

## Context

The Tasks drawer lists two after-only cursor reads: the review queue, `GET /v1/ontologies/reviews`
(server default 25, maximum 100), and a release's events, `GET /v1/ontologyReleases/{id}/events`
(server default 50, maximum 1000). Neither returns a `before` cursor, so Previous needs the client
to remember the cursor of each page it has read. Every client-side cache in this repository must
be bounded, so that history needs a cap. The first version dropped the oldest entry once the cap
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
it jumps to page 1 and skips the dropped pages. Both values are UI-only, and the review queue
refuses a page larger than 100. A `before` cursor from the server would remove the need for a
client history, and would be the reason to revisit this record.
