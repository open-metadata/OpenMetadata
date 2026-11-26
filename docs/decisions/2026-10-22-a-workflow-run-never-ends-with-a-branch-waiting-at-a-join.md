# AutoPilot joins its branches before a failure edge, and a throwing branch ends its run

- **Status:** Accepted
- **Revisions:** v1 2026-10-22 (initial)
- **Deciders:** Shreyansh Verma
- **Guard:** `MainWorkflowTest`, `AutoPilotWorkflowTest`, `WorkflowDefinitionResourceIT`
  (`test_sinkExceptionInOneForkBranchEndsTheEventBasedInstance`,
  `test_sinkExceptionInOneForkBranchEndsThePeriodicBatchInstance`)
- **Related:** `MainWorkflow`, `AutoPilotWorkflow.json`, `AutoPilotApp`

## Context

A parallel gateway that joins branches waits until every incoming edge has delivered a token, and
Flowable keeps the process alive while it waits. A plain end event ends only the branch that
reaches it. So when one branch of a fork reached an end event while a sibling branch waited at the
join, the process never ended, the trigger's end listener never ran, and the WorkflowInstance stayed
`RUNNING` forever. For AutoPilot that also blocked every later run on the same service, because the
UI refuses a trigger while the latest instance is running.

Two exits did this:

- AutoPilot's `RunUsageIngestion -failure-> WorkflowFailure` ran inside `FirstGateway`'s fork,
  while Data Insights and Lineage joined at `SyncGateway`.
- Every main workflow's runtime-exception exit, the `Error` end event, which every AutoPilot step
  reaches when it throws: creating or running an ingestion pipeline, or running an app, with the
  pipeline service unreachable.

## Decision

- **AutoPilot runs a node with a failure edge only after every branch forked before it has
  joined.** Data Insights and Lineage join at a new `FirstSyncGateway`, and Usage runs after it.
  Usage keeps its failure edge, so a Usage failure still skips AutoClassification, Profiler and the
  final Data Insights run, as before.
- **The runtime-exception exit terminates the run.** The `Error` end event
  (`MainWorkflow.ERROR_END_EVENT_ID`) carries a terminate event definition with `terminateAll`
  false. In a main workflow started by a trigger's call activity, Flowable copies the call
  activity's output parameters, deletes only that run and resumes the call activity, so the failure
  still reaches the trigger and a periodic batch's other runs go on. `terminateAll` true is not
  used: it would end the trigger process, and with it the whole batch. User end events stay plain:
  terminating them would set a delete reason on every successful run, which
  `WorkflowHandler.taskResolutionOutcome` reads as a failed process.
- **No migration repairs the stored graph.** Every server start installs the AutoPilot app again
  (`AppResource.loadDefaultApplications`), and `AutoPilotApp.install` writes the packaged graph over
  the stored one and redeploys it. The first start after an upgrade therefore runs the joined graph.

## Consequences

- AutoPilot's Usage now waits for Data Insights and Lineage. It costs no wall-clock time: the
  forked subprocesses are asynchronous and exclusive, so the branches of one run already execute
  one after another.
- Nothing rejects a failure edge inside an open fork in a definition written through the API; only
  the packaged AutoPilot graph is shaped this way. The workflow builder cannot create a fork.
- The terminating `Error` exit reaches a stored workflow when it is next deployed. Every server
  start deploys AutoPilot; another forked workflow, written through the API, gets it
  on its next save.
- In such a fork whose other branch waits at a user approval task, a throw now ends the run with
  that task's Flowable task, and the OpenMetadata task stays open with no run to resolve against.
  Before, the run waited forever. AutoPilot and the seeded workflows have no approval task in a
  fork.
- When the throw ends a sibling branch whose step had already started, that step's stage row stays
  `RUNNING` with no end time, since deleting a branch runs no end listeners. The instance itself
  ends `EXCEPTION`, which is what the AutoPilot UI reads before it allows the next run.
- A run already stuck before the upgrade, or still in flight during it, keeps its old process
  definition and can stay `RUNNING`. An admin ends it with
  `POST /v1/governance/workflowInstances/{id}/terminate`.
