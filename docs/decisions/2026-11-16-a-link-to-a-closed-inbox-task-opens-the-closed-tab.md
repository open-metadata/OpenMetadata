# A link to a closed Inbox task opens the Closed tab

- **Status:** Accepted
- **Revisions:** v1 2026-11-16 (initial)
- **Deciders:** Harsh Vador
- **Guard:** `TasksTab.test.tsx` ("opens a linked closed task on the Closed tab, once", "opens a
  second linked closed task on the Closed tab while mounted", "keeps the Open tab for a linked open
  task"), `TaskDetailPanel.test.tsx` ("reports the full task once it loads")
- **Related:** #37885, #37886

## Context
Links into the Inbox name a task with `?taskId=`. The Triage tab opens on Open, and the link's task
shows in the detail pane whatever its status. A closed task therefore showed beside an Open list
that could never hold its row, with nothing selected. The list can't know the status before the
task loads: the task may sit past the loaded pages, and the link carries only its id.

## Decision
When the detail pane loads a linked task that is closed while the list is on Open, the list moves to
Closed and keeps the task selected. Only the first load of each link decides: once moved, the viewer
may go to any tab, and later reloads of the same task (after a comment, say) don't move it back. A
link followed while the tab stays mounted opens its task and gets its own first load. An open task,
or a link that lands on All or Closed, leaves the tab as it is.

## Consequences
The list and the detail agree for closed links. The tab can change a moment after the page opens,
once the task loads. If a link should land on a tab of its own choosing, it would need to name that
tab in the URL.
