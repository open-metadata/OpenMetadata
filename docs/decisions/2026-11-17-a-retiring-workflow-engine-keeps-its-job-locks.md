# A workflow engine replaced on a settings save keeps its job locks

- **Status:** Accepted
- **Revisions:** v1 2026-11-17 (initial)
- **Deciders:** Governance workflows team
- **Guard:** `WorkflowEngineRetireTest`
- **Related:** #37972, #20421, #20984

## Context
Saving workflow settings rebuilds the Flowable engine on every server and closes the old one. The
old job executor runs on the engine's shared thread pool, so its shutdown does not wait for
running jobs: with Flowable's default `unlockOwnedJobs=true` it clears the lock on every job it
owns at once. The new engine or another server then acquires a job that is still running and runs
it a second time. Job locks last 15 days (#20421), so a lock is the only thing keeping a long job
from running twice.

## Decision
`WorkflowHandler.retireEngine` sets `unlockOwnedJobs=false` on the outgoing engine's job and
history executors before closing it. Their running jobs finish on the old engine's threads, and
the close waits for them. A real server shutdown keeps the default, so a stopping server still
hands its jobs to the others. `unlockJobsOnStartup` stays unwired: it clears every lock in the
cluster, including those of jobs running on healthy servers (#20984).

## Consequences
A settings save no longer runs a job twice. It still blocks until jobs running on the old engine
commit, as it did before, because closing the engine clears its process-instance locks. A server
that dies mid-job leaves that job locked until its lock expires or an administrator terminates the
instance.
