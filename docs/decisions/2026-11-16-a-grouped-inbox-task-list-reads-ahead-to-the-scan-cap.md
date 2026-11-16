# A grouped Inbox task list reads ahead to the scan cap

- **Status:** Accepted
- **Revisions:** v1 2026-11-16 (initial)
- **Deciders:** Harsh Vador
- **Guard:** `TasksTab.test.tsx` ("reads on past the screen while grouped, up to the scan cap",
  "stops reading on at the scan cap", "stops reading on after a page fails", "marks group counts as
  floors while pages are still unread", "offers a retry for a failed page under a filter that empties
  the list"), `useInboxInfiniteList.test.tsx` ("retries a failed page only once the sentinel comes back
  into view")
- **Related:** #37885, #37886, ADR:2026-10-28-inbox-task-list-sorts-only-by-creation-time

## Context
The Inbox task list groups by type by default and orders the groups by urgency, incidents first.
The task endpoints page by creation time, 25 tasks a page, and the list loaded the next page only
when its end scrolled into view. Groups and the Type menu's counts were built from the pages loaded
so far, so an older incident stayed hidden until the list was scrolled to its end, and then
appeared at the top, out of view. On a queue of 35 tasks of five types, the Type menu offered only
"Custom task 25". The endpoints have no per-type counts and no multi-type filter on the scoped
lists, so the counts can't come from the server.

## Decision
While the list is grouped by type, it fetches its next page by itself, without scrolling, until the
server has no more pages or it holds `MAX_NARROWED_SCAN` (200) tasks, the same cap a type, status or
title filter already scans to. A page that fails stops the read-ahead, and the list shows a Retry
below its rows; scrolling the end back into view retries too. The Retry matters when a filter hides
every loaded row, since an empty list can't scroll. While pages remain, each group's count reads
"N+" and the Type menu hides its counts. With grouping off, the list loads a page at a time on
scroll, as before.

## Consequences
Opening the Triage tab, or changing its status, search or sort, can cost up to eight requests
instead of one. A queue of 200 tasks or fewer groups and counts exactly. A larger one groups its
newest 200 and says its counts are floors. A server-side per-type count, or a filter on several
types, would let the list stop reading ahead.
