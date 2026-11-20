# Closing a workflow-managed task ends only the process holding it

- **Status:** Accepted
- **Revisions:** v1 2026-11-17 (initial)
- **Deciders:** Governance workflows team
- **Guard:** `WorkflowDefinitionResourceIT.test_closingApprovalTaskCancelsItsWorkflowRun`, `WorkflowDefinitionResourceIT.test_closingTheApprovalTaskOfAPeriodicBatchEndsItsProcessesAndLetsTheRunFinish`, `WorkflowDefinitionResourceIT.test_closingOneOfParallelApprovalsClosesItsSibling`
- **Related:** #37972

## Context
`POST /v1/tasks/{id}/close` and the bulk `Cancel` operation marked the task Cancelled and left its
Flowable process waiting forever. Ending it through the task's `terminateProcess` message is not
safe: that message reaches a terminate end event with `terminateAll`, which deletes the root
process instance. A periodic batch runs one main-workflow process per entity under one trigger
root and one shared run, and its approval steps share the run's task, so the message would tear
down the whole trigger, including batches it has yet to fetch. Parallel approval branches share
one process, so their other tasks would be left open with nothing behind them.

## Decision
A user's close of a workflow-managed task ends each process holding a Flowable task of it. A run
that is not a periodic batch belongs to that task alone, so its whole process tree is deleted from
its root, and the run is recorded as CANCELLED only after the delete succeeded. In a periodic batch
only the process holding the task is deleted, never the trigger root: Flowable completes the call
that started it, so the batch's trigger carries on, and the run's status is left to the trigger.
The tasks still open in a deleted process, and an ended run's other open tasks about the same
entity, are then closed. A close made from inside a running workflow command (supersede, expiry,
the terminator) keeps using `TaskRepository.closeTask`, which does not touch Flowable.

## Consequences
No process waits on a closed task, and a close never tears down a periodic batch's trigger root.
Closing a task in a batch-sink workflow, which runs every entity in one process, ends that batch's process.
A refused delete, because a job of the process is executing, leaves the process running and the
run's status unchanged, and is logged. `ChangeRequestTasks.closeTask` still uses the
`terminateAll` message.
