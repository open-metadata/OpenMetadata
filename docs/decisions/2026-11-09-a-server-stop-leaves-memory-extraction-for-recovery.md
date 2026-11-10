# A server stop leaves memory extraction for recovery instead of failing it

- **Status:** Accepted
- **Revisions:** v1 2026-11-09 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `GenericBackgroundWorkerTest`, `ContextFileProcessingServiceTest`, `PageContextProcessingEngineTest`, `InterruptionsTest`, `AssetServiceFactoryTest`
- **Related:** ADR:2026-09-29-context-file-memory-reuse

## Context

Every rollout is a normal stop. `GenericBackgroundWorker.stop()` interrupts the jobs in flight, and
the LLM clients turn the interrupt into an `LLMCompletionException`. The asset service's own
shutdown hook also closes object storage under running text extraction.

So files and articles being extracted were stamped Failed with an error that did not name the stop,
and their jobs FAILED, and nothing retried them. A crash left the same work in progress, and the
existing recovery resumed it:
- the startup scan resubmits files left Uploaded, Analyzing or ExtractingContext;
- the stale-job reaper requeues a RUNNING memory extraction job that nobody has heartbeated for
  five minutes.

## Decision

- **The memory stage is left as a crash leaves it.** A memory extraction run that a server stop
  cuts short stays in progress:
  - a file keeps ExtractingContext;
  - an article keeps its status;
  - its job stays RUNNING.

  Only the stale-job reaper requeues the job; the startup scan skips a file whose job is RUNNING.
- **The text stage is stamped Failed with `Interrupted by a server stop`.** Text extraction
  (Uploaded or Analyzing) has no job, and it is the cheap stage.
  - It gets no automatic retry. Its owner or an admin recovers it with Retry (#37479).
  - A failure the run determines itself keeps its own message, such as no object storage or an
    empty read.
  - A crash still leaves no stamp, so the startup scan resumes the file as before.
- **One rule says what a stop cut short** (`Interruptions.isStopInterruption`). It holds when any
  of these does:
  - `ServerStopping` is set;
  - the thread was interrupted;
  - an `InterruptedException` caused the failure.
- **The flag is raised before object storage closes.** The asset service's shutdown hook sets
  `ServerStopping` itself and only then closes the client. A read that the close breaks always
  sees the stop, whichever JVM shutdown hook starts first.
- **Other job types are still marked FAILED on a stop.** Nothing requeues them, and Collate's
  admin-ops jobs depend on it: a RUNNING one blocks new jobs of its type.
- **A real failure still fails.** With no stop and no interrupt, it marks the document Failed with
  its own message, and the job FAILED.

## Consequences

- **Memory stage.** A run resumes once its RUNNING job has gone five minutes without a heartbeat,
  on the reaper's next pass. The reaper runs every five minutes, the first time 30 seconds after
  boot, so this is about five to ten minutes after the stop. A failure that coincides with a stop
  costs one more run after the restart.
- **Text stage.** A file a stop cuts short reads Failed until someone retries it.
- **Merge order.** Until #37479 merges, that file reads Failed with that reason and has no Retry
  button, so its owner uploads it again.
- **New job types.** A job type that should survive a stop needs both the reaper's requeue and the
  worker's check.
