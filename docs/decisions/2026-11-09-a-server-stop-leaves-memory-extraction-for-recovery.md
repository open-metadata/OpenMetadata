# A server stop leaves memory extraction for recovery instead of failing it

- **Status:** Accepted
- **Revisions:** v1 2026-11-09 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `GenericBackgroundWorkerTest`, `ContextFileProcessingServiceTest` (including the text-stage sweep), `ContextFileRecoverySchedulerTest`, `PageContextProcessingEngineTest`, `InterruptionsTest`, `AssetServiceFactoryTest`
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
  progress, and existing recovery resumes it:
  - **A file left Uploaded or Analyzing has no job.** The startup scan resubmits it at boot. So
    does a periodic sweep on every live server (`ContextFileRecoveryScheduler`), once the file
    has been idle for 30 minutes. The sweep covers a surge-first rollout, where the new server
    scanned before the old one stopped.
  - **A file left ExtractingContext, and an article, keep a RUNNING job.** Only the stale-job
    reaper requeues it; the startup scan skips a file whose job is RUNNING.
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

- **Memory stage.** A run resumes once its RUNNING job has gone five minutes without a heartbeat,
  on the reaper's next pass. The reaper runs every five minutes, the first time 30 seconds after
  boot, so this is about five to ten minutes after the stop.
- **Text stage.** A file resumes at the next startup scan. Failing that, it resumes within five
  minutes of reaching the sweep's 30-minute idle window: about 30 to 35 minutes after its last
  update.
  - Text extraction has no timeout of its own, so the window sits far above any legitimate run.
  - The sweep looks back one day and takes 50 files per pass; anything older waits for a startup
    scan.
  - A peer still extracting a file the sweep resubmits is unharmed: writes are conditional, both
    runs write the same result, and the memory job is enqueued once. The cost is a second parse.
- A failure that coincides with a stop costs one more run after the restart.
- A job type that should survive a stop needs both the reaper's requeue and the worker's check.
