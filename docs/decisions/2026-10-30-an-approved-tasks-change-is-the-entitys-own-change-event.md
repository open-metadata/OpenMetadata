# An approved task's change to an entity is that entity's own change event, by the approver

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `TaskWorkflowHandlerTest` (the `saveChange` cases); `TaskResourceIT` (exactly one
  `entityUpdated` event by the approver for each approved description, column description, column
  tag, owner, domain and suggestion change, a topic case, and the audit log entry)
- **Related:** #36556; PR #36682; ADR:2026-10-09-bulk-edits-compose-single-entity-writes

## Context

Approving a task can change the entity the task is about: its description, a column's
description, tags, tier, owners, domains, or an accepted suggestion. That write runs inside the
task's own request, and the response of that request is the task. The REST response filter records
the change event of the entity in the response, so it records the task's event and never the
changed entity's.

Tag and tier updates recorded the entity's event themselves. Description, owner, domain and
suggestion updates did not. The entity's version went up, but alerts on the entity, the audit log
and the activity feed never saw the change. In 1.13 an approved description did record it.

## Decision

- When an approved task changes its entity, the entity gets the change event a PATCH by the
  approver would get: one event per write, with the approver as its user. An agent-authored
  suggestion keeps `ChangeSource.SUGGESTED` on the change.
- The task form's actions (description, tags, tier, owners, domains, suggestions) save through
  `TaskWorkflowHandler.saveChange`. It diffs the changed entity against its snapshot into a JSON
  patch, saves it with `EntityRepository.patch`, and records the event built by
  `ChangeEventHandler.entityChangeEvent`, the builder the response filter uses.
- An empty patch saves nothing. A patch that changes nothing, or that an approval workflow holds
  for review, records no event.
- Approvals that set an entity field (`PATCH_ENTITY_FIELD`, such as a glossary term approval)
  already record the event in `EntityFieldUtils.setEntityField` and stay there. A change request's
  review publishes through its workflow's commit step and records nothing here.

## Consequences

- Alerts, the audit log, the activity feed and anything else read from change events see an
  approved change exactly as they see the same edit made directly by the approver.
- Entity-event governance workflows run after such an approval as they would after the
  approver's direct edit. Approved tag updates already behaved this way.
- A new task action that changes its entity must save through `saveChange`. Calling
  `repository.patch` directly saves the change but loses its event.
- As in ADR:2026-10-09-bulk-edits-compose-single-entity-writes, the event is written by the caller
  after the save, not by the write path in the entity's transaction. Moving events into the write
  path (an outbox) would replace this rule for every caller at once.
