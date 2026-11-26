# An incident task leads with its next stage and folds steps back into the menu

- **Status:** Accepted
- **Revisions:** v1 2026-11-20 (initial)
- **Deciders:** Teddy Crepineau, Ram Narayan B
- **Guard:** `taskResolve.utils.test.ts` (`splitTaskActions` › an incident stage), `TaskDetailHeader.test.tsx`, `TaskTabNew.component.test.tsx`, `InboxTaskMatrix.spec.ts`
- **Related:** ADR:2026-11-17-returning-incidents-to-triage-clears-assignees, [PR #37613](https://github.com/open-metadata/OpenMetadata/pull/37613)

## Context

The Inbox task header shows two actions as buttons and the rest in an overflow menu. It promoted
the first two plain transitions in workflow order. Once Assigned incidents could return to New or
Acknowledged, a fresh install listed those first, so an Assigned incident offered New as its main
action and buried Resolve in the menu. An upgraded install appends the same transitions, so the two
installs rendered differently, and the Acknowledged stage has led with New since it was seeded.
Workflow order is not a reliable signal: it differs by install, and each open task keeps the copy
it received when it entered its stage.

## Decision

When a task sits in an incident stage (`new`, `ack`, `assigned`, `resolved`) and every action
targets one, the header ranks actions by the stage they move to: the nearest forward step first,
then further forward steps, then a same-stage action such as Reassign, and steps back last. The
first two ranked actions are the buttons; the rest go to the menu in workflow order. An assignee
action that misses a slot stays a button, since a menu item cannot host its picker.

| Stage | Buttons | Menu |
|---|---|---|
| New | Acknowledge, Assign | Resolve |
| Acknowledged | Assign, Resolve | New |
| Assigned | Resolve, Reassign | New, Acknowledge |

The classic task tab's split button defaults to the first ranked transition for the same reason:
in workflow order an Assigned incident defaulted to New, which needs no comment, so one click sent
it back to triage. Any other task keeps the workflow-order rule.

## Consequences

The layout no longer depends on how a workflow lists its transitions, so no migration reorders
stored definitions or open tasks. A custom incident transition whose target is outside the four
stages turns the ranking off for that task. On Acknowledged the main action is Assign, which renders
as the picker's outlined button rather than a filled one.
