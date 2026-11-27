# A workflow redeploy deploys the new versions before it drains the old ones, and a signal follows a version replaced during delivery

- **Status:** Accepted
- **Revisions:** v1 2026-10-29 (initial)
- **Deciders:** anuj-kumary
- **Guard:** WorkflowRedeploySignalIT (entity created during redeploys, suspended workflow redeployed), WorkflowSignalDispatcherTest
- **Related:** #36522, #36523

## Context
Every update of a workflow definition redeploys it. The redeploy deleted the workflow's old Flowable
deployments before deploying the new ones. The version that held the trigger's start-signal
subscription was deleted last, Flowable removed the subscription, and until the new versions
existed the workflow had no live trigger. The signal dispatcher also skipped a deleted version as if
it were suspended. An entity event handled in that window started no workflow and left no trace: a
glossary term stayed in Draft with no approval task. With the fix reverted, 23 of 30 entities
created during redeploys never started their workflow.

## Decision
- A redeploy deploys the new main and trigger versions first and drains the old ones afterwards.
- The drain spares, for each process key just deployed, every version at or above the deployed
  one, so an overlapping redeploy's newer version survives. Versions with running instances are
  kept as before; keys the new deployment no longer contains are drained.
- A suspended workflow's new trigger versions are suspended by entity in the transaction that
  deploys them, so no signal ever sees them active.
- The signal dispatcher skips a suspended definition, but treats a deleted one as replaced: it
  reads the subscriptions again and delivers only to the not yet attempted start subscriptions with
  the same start-event activity id. It re-reads at most 3 times per signal, one per redeploy that
  lands during the delivery; past that, or when no replacement exists, it logs a warning naming the
  signal and the entity instead of dropping silently.

## Consequences
A workflow keeps a live trigger through every redeploy, and a signal is never dropped without a log
line. Old versions now live slightly longer, until the drain after the new deploy. The 3 re-read
budget means a fourth consecutive redeploy during one delivery still drops that event, with a
warning; raise it only if workflow definitions are edited far faster than events are delivered.
Two truly simultaneous updates of one definition can still be rejected by Flowable with a
duplicate-version error; that is a separate limit, not covered here.
