# Task lists page newest first by creation time

- **Status:** Accepted
- **Revisions:** v1 2026-10-28 (initial) · v2 2026-11-19 (opt-in update-time paging)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `TaskListOrderTest`; `TaskResourceIT#testListPagesNewestFirstBothWays`,
  `#testListSearchPagesNewestFirstBothWays`, `#testScopedListsReturnNewestFirst`,
  `#testListRejectsNameCursorAndUnknownSortOrder`, `#testListPagesRecentTaskUpdates`
- **Related:** `TaskListOrder`, `FeedDAOs.TaskDAO`

## Context
`GET /v1/tasks` and its scoped variants (`/assigned`, `/visible`, `/owned`, `/created`) paged by
the generic `(name, id)` keyset, so the Inbox Triage queue and the notification bell showed the
oldest tasks first. Reversing the name order would not fix it. Task names are `TASK-%05d` strings
compared as text, so `TASK-100000` sorts before `TASK-99999`. The 2.0 migration also numbered every
migrated suggestion before any thread task, so on upgraded installs name order is not creation
order. The UI cannot re-sort either, because it loads the list one cursor page at a time.

## Decision
Those five endpoints page by the `(createdAt, id)` keyset. They take `sortOrder=asc|desc`, which
defaults to `desc`, newest first. The order is opt-in on the `ListFilter`: a resource applies it
with `TaskListOrder.applyTo`. The cursor carries `createdAt` in the slot the name cursor uses.
Listings that do not apply it, the search reindex among them, keep the `(name, id)` keyset and
the name cursor that `getCursorAtOffset` seeds. The keyset bound is written as
`createdAt <op>= c AND (createdAt <op> c OR id <op> i)` so it stays a range on the `createdAt`
index. Free-text search (`q`) keeps its filter-first plan.

## Consequences
New tasks surface first wherever the UI lists tasks, without a UI change. A name cursor issued
before this change is rejected with 400 instead of being misread as a timestamp, so a client
that held one across the upgrade must list again from the first page. A new caller of
`TaskRepository.listAfter` gets name order unless it applies `TaskListOrder`. Changing the
repository-wide default instead would break reindex cursor seeding. Revisit this if tasks gain a
numeric sequence column that can be sorted directly.

## Amendment

v2 2026-11-19: `GET /v1/tasks` accepts `sortBy=updatedAt` to page by `(updatedAt, id)` and
`updatedSince` as an inclusive lower bound in epoch milliseconds. Clients reuse the same sort
field across a cursor walk: cursors contain a timestamp without the field name, so switching
fields interprets the old timestamp in the new order and can skip or repeat tasks. Start a new walk
when changing the field. Rows updated during a walk can move above its cursor and be skipped;
this is a live feed, not a snapshot. Inbox refreshes start from the first page with the same
`updatedSince` window, so the next refresh can recover those rows. Inbox task mentions use the updated-time bound because a new comment
can arrive on a task created outside the Inbox window. The client still filters individual
comments by their own timestamps, since task edits can also advance `updatedAt`.
