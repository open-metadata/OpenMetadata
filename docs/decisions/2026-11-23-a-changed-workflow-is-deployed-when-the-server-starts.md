# A changed workflow is deployed when the server starts, so a migration only changes its row

- **Status:** Accepted
- **Revisions:** v1 2026-11-23 (initial)
- **Deciders:** Adrià Manero, Shreyansh Verma
- **Guard:** `WorkflowStartupDeployIT`, `WorkflowBpmnStableAcrossJvmsTest`, `MigrationArchitectureTest`
- **Related:** ADR:2026-11-11-a-data-migration-carries-its-own-logic, ADR:2026-10-29-a-workflow-redeploy-deploys-before-it-drains, ADR:2026-11-20-suggestion-tasks-fall-back-through-every-owner-to-the-admins

## Context

Flowable runs the BPMN a workflow was deployed with. A workflow is deployed when it is created or
updated through its repository, and seeding skips a workflow that already exists, so a release that
changes a stored workflow, or changes how a workflow is built, reached Flowable only through a
migration step that deployed it (1.13.1, 2.0.8, 2.0.9, and 2.1.1 before this record). Such a step
builds the workflow with the code of whatever release the upgrade ends on, from a row shaped by the
release the step was written for, so a later change to the workflow schema or its builders fails
the upgrade, and a later step that edits the same row leaves the earlier deploy stale.

## Decision

On every start, after its seed data, the workflow definition resource builds the BPMN of each
stored, non-deleted workflow with the running code and compares it, byte for byte, with the latest
Flowable deployment of the same name, for the main and the trigger workflow. A workflow whose BPMN
differs, or that has no deployment, is deployed through `WorkflowHandler.deploy`; one that matches is
not touched, so its versions, timers and running instances stay as they are. Like a deploy in a
migration, this deploy does not drain the old versions, which can take hours on a large Flowable
history; the next deploy through the API drains them. A workflow that cannot be built or deployed
is logged at error and keeps its deployment; the server still starts.

A migration step that changes a stored workflow changes only its row; it does not deploy it.

## Consequences

A release's change to a workflow or to its builders reaches every existing workflow on the first
start after the upgrade, whichever migrations ran, with no manual redeploy. Each start costs one
BPMN build and two deployment reads per workflow. Several servers starting at once can each deploy
the same changed workflow, which leaves one extra version; overlapping deploys are already safe
(ADR:2026-10-29-a-workflow-redeploy-deploys-before-it-drains).

The comparison relies on the BPMN built from a stored definition being the same in every JVM. A
builder writes collections into the BPMN in a fixed order, from a `List` or a `LinkedHashMap`:
`Set.of` and `Map.of` iterate in an order that changes from one JVM to the next, so a builder that
iterates one, or that writes a random or time-based value, would deploy its workflows on every
start. A save through the API deploys the definition as it was sent, and the database may return
the keys of a map in it, such as a trigger filter for several entity types, in another order; such
a workflow is deployed once more on the next start, and is left alone after that.
