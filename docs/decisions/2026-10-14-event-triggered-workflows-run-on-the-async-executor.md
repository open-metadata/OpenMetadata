# Event-triggered workflows run on the Flowable async executor, and approval supersede only replaces older tasks

- **Status:** Accepted
- **Revisions:** v1 2026-10-14 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `EventBasedEntityTriggerTest`, `FreshReadJobRunnableFactoryTest`, `CreateTaskTest` (isSupersededBy), `MetricResourceIT.rapidCreateThenUpdateLeavesExactlyOneOpenApprovalTask`, `WorkflowDefinitionResourceIT.test_NewApprovalRunSupersedesStalePendingTask`
- **Related:** #17837 (original async trigger), #18664 (async dropped in the CallActivity refactor), #18744 (async-leave on the periodic trigger), #32335 (seeded MetricApprovalWorkflow)

## Context
`WorkflowEventConsumer` is a single Quartz job: one thread delivers every change event's signal.
With a synchronous signal start, `signalEventReceived` ran the filter and the whole workflow body
inline, so every event waited behind the previous workflow. #32335 seeded an approval workflow on
every metric create and update; the consumer fell minutes behind and unrelated approval ITs timed
out. Locally the consumer spent 62.4s on 749 signals synchronously and 34.3s with an async start
(glossary term creates 520ms to 50ms average).

## Decision
1. Every signal start event of an event-based trigger leaves asynchronously
   (`setAsynchronousLeave(true)`), as the periodic trigger already does. The signal commits the
   instance, its start listener and one job; the body runs on the async executor.
2. Every Flowable async job runs inside a `FreshReadScope` (`FreshReadJobRunnableFactory`), so
   workflow gates read the database on executor threads as they did on the consumer thread.
3. Runs for the same entity may now overlap, so an approval task supersedes only tasks created
   before it, ordered by the task-ID sequence (`TASK-n`, one database sequence for the cluster).
   Without the order, two concurrent runs could close each other's task and leave none open.

## Consequences
- One workflow type can no longer delay every other entity's workflow.
- Failures of the body are retried by Flowable (3 attempts, then a dead-letter job) instead of by
  the consumer. A retry keeps the process business key, which is the OM task ID, so it updates the
  task the failed attempt created instead of adding a second one.
- Creating the instance still happens on the consumer thread (about 45ms per signal locally).
  Removing that cost means not signalling at all for events that cannot matter, which is a
  separate decision.
