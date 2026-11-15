# An event-triggered workflow run judges the change its event made

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial) · v2 2026-11-03 (only a create may carry no change) · v3 2026-11-05 (the redeploy runs in the 2.0.8 migration)
- **Deciders:** yan-3005
- **Guard:** `FilterEntityImplTest#eventPath_judgesTheChangeOfTheVersionTheEventProduced`,
  `FilterEntityImplTest#eventPath_updateThatLeftNoChange_doesNotFire`,
  `WorkflowEventConsumerTest#changesNoTriggerField_followOrVote_true_editOrCreate_false`,
  `WorkflowDefinitionResourceIT#test_updateThatLeavesNoChangeDescriptionIsJudgedNotTreatedAsCreate`,
  `WorkflowRedeployEntryPointTest`
- **Related:** `TriggeringChange`, `WorkflowRedeployMigration` (v208)

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

Deployed workflows keep the BPMN they were deployed with, so the 2.0.8 migration redeploys every
governance workflow once (`WorkflowRedeployMigration`).

## Consequences

- Only the version number travels with a run, not the change itself, so Flowable variables stay
  small; reading an older version costs one history lookup when the entity has moved on.
- Batch-triggered runs judge each entity's current change, as before: they have no triggering event.
- Until a workflow is redeployed, its main-workflow nodes do not receive the version and read the
  current change; the trigger filter, which runs Java code, uses the version at once.

## Amendment

v2 2026-11-03. The trigger filter treated a missing change as a create and passed it without
checking `include`/`exclude`. An `Updated` event can leave no change to judge: an edit undone within
its session makes consolidation revert the entity to a version with no change (and delete the
version the first edit produced), and a follow never stores one. Both started the workflow on an
entity whose tags never changed, so a tag-gated approval opened with only the workflow's own status
change.

The event consumer also puts the event type on the trigger signal as `global_triggeringEventType`.
When the change to judge is missing, the trigger filter passes only a `Created` event, or a run
that carries no event type (one started before this change). The `checkChangeDescription` node is
left as it is: the filter gates every event-triggered run, so no workflow needs redeploying.

An update whose own change names only fields no workflow triggers on (a follow, an unfollow, a
vote) starts no run at all. Such an update produces no version, so its run would read the entity's
stored change, an earlier edit's, judge that edit again, and replace any approval open for it.

v3 2026-11-05: the 2.0 line carries the same change, so the redeploy step moves from the 2.1.0
migration to the 2.0.8 migration, the same step on `main` and `2.0`, and runs after the 2.0.8
negated-list step that redeploys rewritten workflows. An upgrade from 2.0.7 or earlier runs it once.
Two kinds of database do not: one on the 2.0 line that recorded 2.0.8 before the step was added,
whose 2.0.8 is replayed only for new SQL, and one already on a 2.1.0 pre-release, which replays the
previous release train for SQL only. Their workflows keep their deployment until they are saved
again, and the trigger filter uses the event's version meanwhile. The step reads workflow
definitions and deploys to Flowable, and touches nothing the 2.1.0 schema changes add. A workflow
that fails to redeploy is logged at error and keeps its deployment until it is saved again.
