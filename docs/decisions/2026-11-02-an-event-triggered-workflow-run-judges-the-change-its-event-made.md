# An event-triggered workflow run judges the change its event made

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial)
- **Deciders:** yan-3005
- **Guard:** `FilterEntityImplTest#eventPath_judgesTheChangeOfTheVersionTheEventProduced`
- **Related:** `TriggeringChange`, `WorkflowRedeployMigration` (v210)

## Context

An `eventBasedEntity` trigger filters on the fields an edit changed, and a `checkChangeDescription`
node tests the same change. Both used to reload the entity and read its stored `changeDescription`.
The workflow event consumer polls `change_event`, so another edit can be stored between an event and
the run it starts. When that edit is not merged into the first, the stored change is the later
edit's, and the first edit is judged on a change it did not make.

## Decision

The event consumer puts the entity version the event produced on the trigger signal as
`global_triggeringVersion`. The trigger passes it to the main workflow. The trigger filter and the
`checkChangeDescription` node read the change of that version (`TriggeringChange.of`): the entity's
own change while it is still at that version, otherwise the change stored with that version in the
entity's history. A run that carries no version, or whose version is no longer in the history, reads
the entity's current change as before. Change-request runs keep judging the revision they review.

Deployed workflows keep the BPMN they were deployed with, so the 2.1.0 migration redeploys every
governance workflow once (`WorkflowRedeployMigration`).

## Consequences

- Only the version number travels with a run, not the change itself, so Flowable variables stay
  small; reading an older version costs one history lookup when the entity has moved on.
- Batch-triggered runs judge each entity's current change, as before: they have no triggering event.
- Until a workflow is redeployed, its main-workflow nodes do not receive the version and read the
  current change; the trigger filter, which runs Java code, uses the version at once.
