# The Inbox task list sorts only by creation time, newest or oldest first

- **Status:** Accepted
- **Revisions:** v1 2026-10-28 (initial)
- **Deciders:** Ram Narayan Balaji, Karthick Sharan
- **Guard:** `InboxTaskListToolbar.test.tsx` ("names the sort order on the trigger and reports a
  change"), `TasksTab.test.tsx` ("lists oldest first, under its own cache key, once asked to"),
  `useUserTasks.test.ts` ("merges oldest first when asked for ascending order"),
  `taskList.utils.test.ts` ("orders the groups by urgency, not by first appearance")
- **Related:** #36393, #36395, #36439, ADR:2026-10-28-task-lists-page-newest-first-by-creation-time

## Context
The design for the Inbox task list's sort menu offered five orders: newest first, oldest first,
recently updated, severity, and assignee A–Z. The list loads one cursor page at a time, and the
task list endpoints page only by the `(createdAt, id)` keyset, in either direction through
`sortOrder`. Sorting the loaded pages on any other field would be wrong across pages: a task on
page two that sorts first would show below page one. Assignee order needs a join and a rule for
tasks with several assignees or none, and the Inbox mostly holds the viewer's own tasks anyway.
Priority cannot be set from the UI yet (it defaults to Medium), so ordering by it would change
little.

## Decision
The task list offers **Newest first** and **Oldest first** only. The choice is sent to the server
as `sortOrder` and is part of the list's cache key. It is never applied by re-sorting loaded
pages. A user's Tasks tab merges its assigned and created sources in the same direction. Under
**Group: Type**, groups keep their urgency order and the chosen order applies within each group.
Under **Group: None**, the list is in date order throughout.

## Consequences
The order holds across "Load more", because the server decides it. Recently updated, priority and
assignee sorts wait until the endpoints can page by a keyset on that field. Add them when customers
ask for them, not as a client-side sort. Revisit the grouping rule if a sort should also reorder the
groups.
