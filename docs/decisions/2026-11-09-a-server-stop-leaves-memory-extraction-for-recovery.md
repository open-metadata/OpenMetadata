# A server stop leaves memory extraction for recovery instead of failing it

- **Status:** Accepted
- **Revisions:** v1 2026-11-09 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `GenericBackgroundWorkerTest`, `ContextFileProcessingServiceTest`, `PageContextProcessingEngineTest`, `InterruptionsTest`
- **Related:** ADR:2026-09-29-context-file-memory-reuse

## Context

Every rollout is a normal stop. `GenericBackgroundWorker.stop()` interrupts the jobs in flight, and
the LLM clients turn the interrupt into an `LLMCompletionException`. The asset service's own
shutdown hook also closes object storage under running text extraction. So files and articles
being extracted were stamped Failed and their jobs FAILED, and nothing retried them. A crash left
the same work in progress, and the existing recovery resumed it:
- the startup scan resubmits files left Uploaded, Analyzing or ExtractingContext;
- the stale-job reaper requeues a RUNNING memory extraction job that nobody has heartbeated for
  five minutes.

## Decision

- **Left as a crash leaves it.** A memory extraction run that a server stop cuts short stays in
  progress:
  - a file stays Analyzing or ExtractingContext;
  - an article keeps its status;
  - its job stays RUNNING.

  The stale-job reaper and the startup scan then resume it.
- **One rule, shared by the engines and the worker** (`Interruptions.isStopInterruption`). A run
  is cut short by a stop when any of these holds:
  - `ServerStopping` is set;
  - the thread was interrupted;
  - an `InterruptedException` caused the failure.
- **The flag is raised before object storage closes.** The asset service's shutdown hook sets
  `ServerStopping` itself and only then closes the client. A read that the close breaks always
  sees the stop, whichever JVM shutdown hook starts first.
- **Other job types are still marked FAILED on a stop.** Nothing requeues them, and Collate's
  admin-ops jobs depend on it: a RUNNING one blocks new jobs of its type.
- **A real failure still fails.** With no stop and no interrupt, it marks the document Failed and
  the job FAILED.

## Consequences

- An interrupted run resumes within the reaper's stale window, about five to ten minutes after the
  restart.
- A failure that coincides with a stop costs one more run after the restart.
- A job type that should survive a stop needs both the reaper's requeue and the worker's check.
