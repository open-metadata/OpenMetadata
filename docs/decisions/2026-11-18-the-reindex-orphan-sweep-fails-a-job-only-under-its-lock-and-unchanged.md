# The reindex orphan sweep fails a job only under the reindex lock, and only if the job is unchanged

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `DistributedSearchIndexExecutorTest#createJobRenewsTheJobsOwnLockWhileItsPartitionsAreBuilt`,
  `JobRecoveryManagerTest#testStartupRecovery_LeavesOrphanForALaterSweepWhileTheReindexLockIsHeld`,
  `JobRecoveryManagerTest#testStartupRecovery_DoesNotFailJobWrittenAfterTheSweepReadIt`,
  `SearchReindexOrphanSweepIT`
- **Related:** open-metadata/OpenMetadata#38016, open-metadata/OpenMetadata#29547

## Context
`OrphanJobMonitor` runs `JobRecoveryManager` on every server every two minutes. The sweep treats a
distributed reindex job as alive while its `updatedAt` is under ten minutes old, or while the
reindex lock is held, unexpired, under the job's own id. A coordinator building a job's partitions
held the lock under a placeholder id and renewed neither signal until it finished. On a large
catalog the sweep therefore failed the live job as "abandoned". Its write took no lock and checked
nothing, so it also cancelled partitions and ended the app run of a job that kept running.

## Decision
- A coordinator moves the reindex lock onto the job's own id as soon as the job row exists. It
  renews the lock and the job's `updatedAt` while it builds partitions
  (`DistributedSearchIndexExecutor#createJob`) and while it runs the job (`execute()`). If the
  partitions fail to build, it marks the job FAILED with the cause instead of leaving it
  INITIALIZING.
- The sweep fails an orphaned job only while holding the reindex lock, as it does to recover or
  terminalize one, so it never acts alongside another server's sweep or a running reindex. The
  FAILED write is a compare-and-swap on the status and `updatedAt` the sweep read. Partitions are
  cancelled and the app run is ended only when that write lands, and only runs that started before
  the job was created are ended.
- Force-completing a job stuck in STOPPING (`checkForBlockingJob`) uses the same compare-and-swap
  but not the lock, which its stuck coordinator may still hold.
- A coordinator marks a job READY only while it is still INITIALIZING.

## Consequences
A sweep acting on an old read never overwrites a live coordinator or another server's sweep. A job
orphaned while a different job holds the lock waits until that lock is released. Any new long step
in creating or running a job must keep one of the two signals fresh, or the sweep fails the job
after ten minutes. Moving the lock handoff after partition building brings #38016 back. The
staged-index creation between `createJob()` and `execute()` is not renewed. Nothing stops the
executor if the run fails there, so a renewal spanning that gap would keep the lock alive forever.
