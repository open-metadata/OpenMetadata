/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.apps.bundles.searchIndex.distributed;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchIndexJobDAO;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchIndexJobDAO.JobSnapshot;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchIndexJobDAO.RecordCounts;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchIndexJobDAO.SearchIndexJobRecord;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchIndexPartitionDAO;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchIndexPartitionDAO.AggregatedStatsRecord;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchIndexPartitionDAO.SearchIndexPartitionRecord;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchReindexLockDAO;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class JobRecoveryManagerTest {

  @Mock private CollectionDAO collectionDAO;
  @Mock private SearchIndexJobDAO jobDAO;
  @Mock private SearchIndexPartitionDAO partitionDAO;
  @Mock private SearchReindexLockDAO lockDAO;
  @Mock private CollectionDAO.AppExtensionTimeSeries appRuns;

  private JobRecoveryManager recoveryManager;
  private MockedStatic<ServerIdentityResolver> serverIdentityMock;
  private ServerIdentityResolver mockServerIdentityResolver;

  private static final String TEST_SERVER_ID = "test-server-1";
  private static final String ABANDONED_JOB_ERROR = "Job abandoned due to server crash or shutdown";

  @BeforeEach
  void setUp() {
    mockServerIdentityResolver = mock(ServerIdentityResolver.class);
    when(mockServerIdentityResolver.getServerId()).thenReturn(TEST_SERVER_ID);

    serverIdentityMock = mockStatic(ServerIdentityResolver.class);
    serverIdentityMock
        .when(ServerIdentityResolver::getInstance)
        .thenReturn(mockServerIdentityResolver);

    when(collectionDAO.searchIndexJobDAO()).thenReturn(jobDAO);
    when(collectionDAO.searchIndexPartitionDAO()).thenReturn(partitionDAO);
    when(collectionDAO.searchReindexLockDAO()).thenReturn(lockDAO);
    when(collectionDAO.appExtensionTimeSeriesDao()).thenReturn(appRuns);

    recoveryManager = new JobRecoveryManager(collectionDAO);
  }

  @AfterEach
  void tearDown() {
    if (serverIdentityMock != null) {
      serverIdentityMock.close();
    }
  }

  @Test
  void testStartupRecovery_NoOrphanedJobs() {
    when(lockDAO.cleanupExpiredLocks(anyLong())).thenReturn(0);
    when(jobDAO.findByStatusesWithLimit(any(), eq(10))).thenReturn(List.of());

    JobRecoveryManager.RecoveryResult result = recoveryManager.performStartupRecovery();

    assertEquals(0, result.expiredLocksCleanedUp());
    assertEquals(0, result.orphanedJobsFound());
    assertEquals(0, result.jobsRecovered());
    assertEquals(0, result.jobsMarkedFailed());
    assertFalse(result.hasError());
  }

  @Test
  void testStartupRecovery_CleansExpiredLocks() {
    when(lockDAO.cleanupExpiredLocks(anyLong())).thenReturn(3);
    when(jobDAO.findByStatusesWithLimit(any(), eq(10))).thenReturn(List.of());

    JobRecoveryManager.RecoveryResult result = recoveryManager.performStartupRecovery();

    assertEquals(3, result.expiredLocksCleanedUp());
    verify(lockDAO).cleanupExpiredLocks(anyLong());
  }

  @Test
  void testStartupRecovery_RecoverRunningJobWithPendingPartitions() {
    UUID jobId = UUID.randomUUID();
    UUID partitionId = UUID.randomUUID();

    SearchIndexJobRecord jobRecord = createJobRecord(jobId, IndexJobStatus.RUNNING);
    when(jobDAO.findByStatusesWithLimit(any(), eq(10))).thenReturn(List.of(jobRecord));
    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);

    when(lockDAO.cleanupExpiredLocks(anyLong())).thenReturn(0);
    when(lockDAO.getLockInfo(anyString())).thenReturn(null);
    when(lockDAO.tryAcquireLock(anyString(), anyString(), anyString(), anyLong(), anyLong()))
        .thenReturn(true);

    SearchIndexPartitionRecord pendingPartition =
        createPartitionRecord(jobId, partitionId, PartitionStatus.PENDING);
    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.PENDING.name()))
        .thenReturn(List.of(pendingPartition));
    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.PROCESSING.name()))
        .thenReturn(List.of());

    JobRecoveryManager.RecoveryResult result = recoveryManager.performStartupRecovery();

    assertEquals(1, result.orphanedJobsFound());
    assertEquals(1, result.jobsRecovered());
    assertEquals(0, result.jobsMarkedFailed());
  }

  @Test
  void testStartupRecovery_FailVeryOldJob() {
    UUID jobId = UUID.randomUUID();

    long twoHoursAgo = System.currentTimeMillis() - TimeUnit.HOURS.toMillis(2);
    SearchIndexJobRecord jobRecord =
        createJobRecordWithStartTime(jobId, IndexJobStatus.RUNNING, twoHoursAgo);
    when(jobDAO.findByStatusesWithLimit(any(), eq(10))).thenReturn(List.of(jobRecord));
    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);

    when(lockDAO.cleanupExpiredLocks(anyLong())).thenReturn(0);
    when(lockDAO.getLockInfo(anyString())).thenReturn(null);
    when(lockDAO.tryAcquireLock(anyString(), anyString(), anyString(), anyLong(), anyLong()))
        .thenReturn(true);
    stubFailIfUnchanged(1);

    AggregatedStatsRecord stats = new AggregatedStatsRecord(10000, 5000, 4900, 100, 2, 1, 1, 0, 0);
    when(partitionDAO.getAggregatedStats(jobId.toString())).thenReturn(stats);

    JobRecoveryManager.RecoveryResult result = recoveryManager.performStartupRecovery();

    assertEquals(1, result.orphanedJobsFound());
    assertEquals(0, result.jobsRecovered());
    assertEquals(1, result.jobsMarkedFailed());

    verify(jobDAO)
        .failIfUnchanged(
            eq(
                new JobSnapshot(
                    jobId.toString(), IndexJobStatus.RUNNING.name(), jobRecord.updatedAt())),
            eq(new RecordCounts(5000, 4900, 100)),
            anyLong(),
            eq(ABANDONED_JOB_ERROR));
    verify(partitionDAO).cancelPendingPartitions(jobId.toString());
    verify(lockDAO).releaseLock("SEARCH_REINDEX_LOCK", jobId.toString());
  }

  @Test
  void testStartupRecovery_TerminalizesFinishedOrphanAsCompletedWithErrors() {
    UUID jobId = UUID.randomUUID();

    // A RUNNING job whose partitions all finished but whose coordinator died before promotion was
    // confirmed. It must be terminalized as COMPLETED_WITH_ERRORS (data processed, promotion
    // unverified), never failed as "abandoned due to server crash or shutdown".
    SearchIndexJobRecord jobRecord = createJobRecord(jobId, IndexJobStatus.RUNNING);
    when(jobDAO.findByStatusesWithLimit(any(), eq(10))).thenReturn(List.of(jobRecord));
    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);

    when(lockDAO.cleanupExpiredLocks(anyLong())).thenReturn(0);
    when(lockDAO.getLockInfo(anyString())).thenReturn(null); // no live lock -> orphaned
    when(lockDAO.tryAcquireLock(anyString(), anyString(), anyString(), anyLong(), anyLong()))
        .thenReturn(true); // finalizer takes the lock

    SearchIndexPartitionRecord completed =
        createPartitionRecord(jobId, UUID.randomUUID(), PartitionStatus.COMPLETED);
    when(partitionDAO.findByJobId(jobId.toString())).thenReturn(List.of(completed));
    when(partitionDAO.getAggregatedStats(jobId.toString()))
        .thenReturn(new AggregatedStatsRecord(226306, 226306, 226306, 0, 1, 1, 0, 0, 0));

    JobRecoveryManager.RecoveryResult result = recoveryManager.performStartupRecovery();

    assertEquals(1, result.orphanedJobsFound());
    assertEquals(0, result.jobsMarkedFailed());
    assertEquals(1, result.jobsRecovered());

    verify(jobDAO)
        .update(
            eq(jobId.toString()),
            eq(IndexJobStatus.COMPLETED_WITH_ERRORS.name()),
            anyLong(),
            anyLong(),
            anyLong(),
            any(),
            anyLong(),
            anyLong(),
            anyLong(),
            any());
    verifyNeverFailed();
  }

  @Test
  void testStartupRecovery_TerminalizesOrphanedPromotingJob() {
    UUID jobId = UUID.randomUUID();

    // A job stuck in PROMOTING (its coordinator died during the promotion sweep). It finished
    // processing, so it must be terminalized as COMPLETED_WITH_ERRORS to unblock future reindexes -
    // never left hanging non-terminal and never failed as abandoned.
    SearchIndexJobRecord jobRecord = createJobRecord(jobId, IndexJobStatus.PROMOTING);
    when(jobDAO.findByStatusesWithLimit(any(), eq(10))).thenReturn(List.of(jobRecord));
    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);

    when(lockDAO.cleanupExpiredLocks(anyLong())).thenReturn(0);
    when(lockDAO.getLockInfo(anyString())).thenReturn(null);
    when(lockDAO.tryAcquireLock(anyString(), anyString(), anyString(), anyLong(), anyLong()))
        .thenReturn(true);
    when(partitionDAO.getAggregatedStats(jobId.toString()))
        .thenReturn(new AggregatedStatsRecord(945, 945, 945, 0, 1, 1, 0, 0, 0));

    JobRecoveryManager.RecoveryResult result = recoveryManager.performStartupRecovery();

    assertEquals(1, result.orphanedJobsFound());
    assertEquals(0, result.jobsMarkedFailed());
    verify(jobDAO)
        .update(
            eq(jobId.toString()),
            eq(IndexJobStatus.COMPLETED_WITH_ERRORS.name()),
            anyLong(),
            anyLong(),
            anyLong(),
            any(),
            any(),
            any(),
            anyLong(),
            any());
  }

  @Test
  void testStartupRecovery_FailInitializingJob() {
    UUID jobId = UUID.randomUUID();

    SearchIndexJobRecord jobRecord = createJobRecord(jobId, IndexJobStatus.INITIALIZING);
    when(jobDAO.findByStatusesWithLimit(any(), eq(10))).thenReturn(List.of(jobRecord));
    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);

    // No lock at all: the coordinator that was building this job's partitions has stopped.
    when(lockDAO.cleanupExpiredLocks(anyLong())).thenReturn(0);
    when(lockDAO.getLockInfo(anyString())).thenReturn(null);
    when(lockDAO.tryAcquireLock(anyString(), anyString(), anyString(), anyLong(), anyLong()))
        .thenReturn(true);
    stubFailIfUnchanged(1);

    AggregatedStatsRecord stats = new AggregatedStatsRecord(0, 0, 0, 0, 0, 0, 0, 0, 0);
    when(partitionDAO.getAggregatedStats(jobId.toString())).thenReturn(stats);

    JobRecoveryManager.RecoveryResult result = recoveryManager.performStartupRecovery();

    assertEquals(1, result.orphanedJobsFound());
    assertEquals(0, result.jobsRecovered());
    assertEquals(1, result.jobsMarkedFailed());
  }

  @Test
  void testStartupRecovery_DoesNotFailJobWrittenAfterTheSweepReadIt() {
    // Between this sweep's read and its write, the job's coordinator, a worker or another server
    // wrote the row. The compare-and-swap misses, and nothing else is torn down: no partitions
    // cancelled and no app run ended.
    UUID jobId = UUID.randomUUID();
    SearchIndexJobRecord jobRecord = createJobRecord(jobId, IndexJobStatus.INITIALIZING);
    when(jobDAO.findByStatusesWithLimit(any(), eq(10))).thenReturn(List.of(jobRecord));
    when(lockDAO.cleanupExpiredLocks(anyLong())).thenReturn(0);
    when(lockDAO.getLockInfo(anyString())).thenReturn(null);
    when(lockDAO.tryAcquireLock(anyString(), anyString(), anyString(), anyLong(), anyLong()))
        .thenReturn(true);
    stubFailIfUnchanged(0);

    JobRecoveryManager.RecoveryResult result = recoveryManager.performStartupRecovery();

    assertEquals(1, result.orphanedJobsFound());
    assertEquals(0, result.jobsMarkedFailed());
    verify(partitionDAO, never()).cancelPendingPartitions(anyString());
    verify(appRuns, never())
        .markRunningEntriesInterrupted(any(), anyString(), anyLong(), anyLong());
    verify(lockDAO).releaseLock("SEARCH_REINDEX_LOCK", jobId.toString());
  }

  @Test
  void testStartupRecovery_EndsOnlyAppRunsThatStartedBeforeTheAbandonedJob() {
    // The run that created the job started before it. A run that started afterwards, such as the
    // one whose start ran this sweep, is not the abandoned one and keeps running.
    UUID jobId = UUID.randomUUID();
    SearchIndexJobRecord jobRecord = createJobRecord(jobId, IndexJobStatus.INITIALIZING);
    when(jobDAO.findByStatusesWithLimit(any(), eq(10))).thenReturn(List.of(jobRecord));
    when(lockDAO.cleanupExpiredLocks(anyLong())).thenReturn(0);
    when(lockDAO.getLockInfo(anyString())).thenReturn(null);
    when(lockDAO.tryAcquireLock(anyString(), anyString(), anyString(), anyLong(), anyLong()))
        .thenReturn(true);
    stubFailIfUnchanged(1);

    recoveryManager.performStartupRecovery();

    verify(appRuns)
        .markRunningEntriesInterrupted(
            eq(List.of("SearchIndexingApplication")),
            anyString(),
            anyLong(),
            eq(jobRecord.createdAt()));
  }

  @Test
  void testStartupRecovery_ResetsProcessingPartitions() {
    UUID jobId = UUID.randomUUID();
    UUID processingPartitionId = UUID.randomUUID();

    SearchIndexJobRecord jobRecord = createJobRecord(jobId, IndexJobStatus.RUNNING);
    when(jobDAO.findByStatusesWithLimit(any(), eq(10))).thenReturn(List.of(jobRecord));
    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);

    when(lockDAO.cleanupExpiredLocks(anyLong())).thenReturn(0);
    when(lockDAO.getLockInfo(anyString())).thenReturn(null);
    when(lockDAO.tryAcquireLock(anyString(), anyString(), anyString(), anyLong(), anyLong()))
        .thenReturn(true);

    SearchIndexPartitionRecord processingPartition =
        createPartitionRecord(jobId, processingPartitionId, PartitionStatus.PROCESSING);
    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.PENDING.name()))
        .thenReturn(List.of());
    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.PROCESSING.name()))
        .thenReturn(List.of(processingPartition));

    recoveryManager.performStartupRecovery();

    verify(partitionDAO)
        .update(
            eq(processingPartitionId.toString()),
            eq(PartitionStatus.PENDING.name()),
            anyLong(),
            anyLong(),
            anyLong(),
            anyLong(),
            eq(null),
            eq(null),
            eq(null),
            eq(null),
            anyLong(),
            eq("Reset for recovery after server crash"),
            eq(1));
  }

  @Test
  void testCheckForBlockingJob_NoActiveJobs() {
    when(jobDAO.findByStatusesWithLimit(any(), eq(1))).thenReturn(List.of());

    Optional<SearchIndexJob> result = recoveryManager.checkForBlockingJob();

    assertFalse(result.isPresent());
  }

  @Test
  void testCheckForBlockingJob_ActiveJobExists() {
    UUID jobId = UUID.randomUUID();
    SearchIndexJobRecord jobRecord = createJobRecord(jobId, IndexJobStatus.RUNNING);
    when(jobDAO.findByStatusesWithLimit(any(), eq(1))).thenReturn(List.of(jobRecord));
    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);

    long now = System.currentTimeMillis();
    SearchReindexLockDAO.LockInfo lockInfo =
        new SearchReindexLockDAO.LockInfo(
            "SEARCH_REINDEX_LOCK",
            jobId.toString(),
            "other-server",
            now - 1000,
            now - 500,
            now + TimeUnit.MINUTES.toMillis(5));
    when(lockDAO.getLockInfo(anyString())).thenReturn(lockInfo);

    Optional<SearchIndexJob> result = recoveryManager.checkForBlockingJob();

    assertTrue(result.isPresent());
    assertEquals(jobId, result.get().getId());
  }

  @Test
  void testCheckForBlockingJob_OrphanedJobRecovered() {
    UUID jobId = UUID.randomUUID();
    UUID partitionId = UUID.randomUUID();

    SearchIndexJobRecord jobRecord = createJobRecord(jobId, IndexJobStatus.RUNNING);
    when(jobDAO.findByStatusesWithLimit(any(), eq(1)))
        .thenReturn(List.of(jobRecord))
        .thenReturn(List.of());
    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);

    when(lockDAO.getLockInfo(anyString())).thenReturn(null);
    when(lockDAO.tryAcquireLock(anyString(), anyString(), anyString(), anyLong(), anyLong()))
        .thenReturn(true);

    SearchIndexPartitionRecord pendingPartition =
        createPartitionRecord(jobId, partitionId, PartitionStatus.PENDING);
    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.PENDING.name()))
        .thenReturn(List.of(pendingPartition));
    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.PROCESSING.name()))
        .thenReturn(List.of());

    Optional<SearchIndexJob> result = recoveryManager.checkForBlockingJob();

    assertFalse(result.isPresent());
  }

  @Test
  void testCheckForBlockingJob_StaleStoppingJobIsForceCompleted() {
    UUID jobId = UUID.randomUUID();
    long staleUpdateTime = System.currentTimeMillis() - TimeUnit.MINUTES.toMillis(1);
    SearchIndexJobRecord jobRecord =
        createJobRecordWithUpdateTime(jobId, IndexJobStatus.STOPPING, staleUpdateTime);

    when(jobDAO.findByStatusesWithLimit(any(), eq(1))).thenReturn(List.of(jobRecord));
    when(partitionDAO.getAggregatedStats(jobId.toString()))
        .thenReturn(new AggregatedStatsRecord(100, 40, 35, 5, 1, 0, 0, 0, 0));
    stubFailIfUnchanged(1);

    Optional<SearchIndexJob> result = recoveryManager.checkForBlockingJob();

    assertFalse(result.isPresent());
    verify(jobDAO)
        .failIfUnchanged(
            eq(new JobSnapshot(jobId.toString(), IndexJobStatus.STOPPING.name(), staleUpdateTime)),
            eq(new RecordCounts(40, 35, 5)),
            anyLong(),
            eq("Force-completed: stuck in STOPPING state"));
    verify(lockDAO).releaseLock("SEARCH_REINDEX_LOCK", jobId.toString());
  }

  @Test
  void testCheckForBlockingJob_StoppingJobThatFinishedMeanwhileKeepsItsOutcome() {
    // The coordinator finished stopping after this check read the job. The force-complete write
    // misses, so neither the job's outcome nor its lock is touched.
    UUID jobId = UUID.randomUUID();
    SearchIndexJobRecord jobRecord =
        createJobRecordWithUpdateTime(
            jobId,
            IndexJobStatus.STOPPING,
            System.currentTimeMillis() - TimeUnit.MINUTES.toMillis(1));
    when(jobDAO.findByStatusesWithLimit(any(), eq(1))).thenReturn(List.of(jobRecord));
    stubFailIfUnchanged(0);

    recoveryManager.checkForBlockingJob();

    verify(partitionDAO, never()).cancelPendingPartitions(anyString());
    verify(lockDAO, never()).releaseLock(anyString(), anyString());
  }

  @Test
  void testCheckForBlockingJob_RecentStoppingJobStillBlocks() {
    UUID jobId = UUID.randomUUID();
    long now = System.currentTimeMillis();
    SearchIndexJobRecord jobRecord =
        createJobRecordWithUpdateTime(jobId, IndexJobStatus.STOPPING, now - 1000);

    when(jobDAO.findByStatusesWithLimit(any(), eq(1))).thenReturn(List.of(jobRecord));
    when(lockDAO.getLockInfo(anyString()))
        .thenReturn(
            new SearchReindexLockDAO.LockInfo(
                "SEARCH_REINDEX_LOCK",
                jobId.toString(),
                TEST_SERVER_ID,
                now - TimeUnit.MINUTES.toMillis(5),
                now - 1000,
                now + TimeUnit.MINUTES.toMillis(5)));

    Optional<SearchIndexJob> result = recoveryManager.checkForBlockingJob();

    assertTrue(result.isPresent());
    assertEquals(jobId, result.get().getId());
    verifyNeverFailed();
  }

  @Test
  void testJobOrphaned_NoLock() {
    UUID jobId = UUID.randomUUID();
    SearchIndexJobRecord jobRecord = createJobRecord(jobId, IndexJobStatus.RUNNING);
    when(jobDAO.findByStatusesWithLimit(any(), eq(10))).thenReturn(List.of(jobRecord));
    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);

    when(lockDAO.cleanupExpiredLocks(anyLong())).thenReturn(0);
    when(lockDAO.getLockInfo(anyString())).thenReturn(null);

    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.PENDING.name()))
        .thenReturn(List.of());
    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.PROCESSING.name()))
        .thenReturn(List.of());

    AggregatedStatsRecord stats = new AggregatedStatsRecord(10000, 10000, 9900, 100, 2, 2, 0, 0, 0);
    when(partitionDAO.getAggregatedStats(jobId.toString())).thenReturn(stats);

    JobRecoveryManager.RecoveryResult result = recoveryManager.performStartupRecovery();

    assertEquals(1, result.orphanedJobsFound());
  }

  @Test
  void testStartupRecovery_LeavesOrphanForALaterSweepWhileTheReindexLockIsHeld() {
    // #38016: failing an orphan took no lock, unlike recovering or terminalizing one. While another
    // server's sweep or a running reindex holds the reindex lock, the sweep must not fail the job
    // under it; the next sweep checks the job again.
    UUID jobId = UUID.randomUUID();
    SearchIndexJobRecord jobRecord = createJobRecord(jobId, IndexJobStatus.INITIALIZING);
    long now = System.currentTimeMillis();

    when(jobDAO.findByStatusesWithLimit(any(), eq(10))).thenReturn(List.of(jobRecord));
    when(lockDAO.cleanupExpiredLocks(anyLong())).thenReturn(0);
    when(lockDAO.getLockInfo(anyString()))
        .thenReturn(
            new SearchReindexLockDAO.LockInfo(
                "SEARCH_REINDEX_LOCK",
                UUID.randomUUID().toString(),
                "coordinator-server",
                now - TimeUnit.MINUTES.toMillis(4),
                now - TimeUnit.MINUTES.toMillis(4),
                now + TimeUnit.MINUTES.toMillis(1)));
    when(lockDAO.tryAcquireLock(anyString(), anyString(), anyString(), anyLong(), anyLong()))
        .thenReturn(false);

    JobRecoveryManager.RecoveryResult result = recoveryManager.performStartupRecovery();

    assertEquals(1, result.orphanedJobsFound());
    assertEquals(0, result.jobsMarkedFailed());
    verifyNeverFailed();
    verify(partitionDAO, never()).cancelPendingPartitions(anyString());
    verify(appRuns, never())
        .markRunningEntriesInterrupted(any(), anyString(), anyLong(), anyLong());
  }

  @Test
  void testJobOrphaned_ExpiredLock() {
    UUID jobId = UUID.randomUUID();
    SearchIndexJobRecord jobRecord = createJobRecord(jobId, IndexJobStatus.RUNNING);
    when(jobDAO.findByStatusesWithLimit(any(), eq(10))).thenReturn(List.of(jobRecord));
    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);

    when(lockDAO.cleanupExpiredLocks(anyLong())).thenReturn(0);

    long now = System.currentTimeMillis();
    SearchReindexLockDAO.LockInfo expiredLock =
        new SearchReindexLockDAO.LockInfo(
            "SEARCH_REINDEX_LOCK",
            jobId.toString(),
            TEST_SERVER_ID,
            now - TimeUnit.HOURS.toMillis(1),
            now - TimeUnit.MINUTES.toMillis(30),
            now - TimeUnit.MINUTES.toMillis(20));
    when(lockDAO.getLockInfo(anyString())).thenReturn(expiredLock);

    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.PENDING.name()))
        .thenReturn(List.of());
    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.PROCESSING.name()))
        .thenReturn(List.of());

    AggregatedStatsRecord stats = new AggregatedStatsRecord(10000, 10000, 9900, 100, 2, 2, 0, 0, 0);
    when(partitionDAO.getAggregatedStats(jobId.toString())).thenReturn(stats);

    JobRecoveryManager.RecoveryResult result = recoveryManager.performStartupRecovery();

    assertEquals(1, result.orphanedJobsFound());
  }

  @Test
  void testStartupRecovery_TreatsStaleUpdatedJobAsOrphaned() {
    UUID jobId = UUID.randomUUID();
    long now = System.currentTimeMillis();
    SearchIndexJobRecord jobRecord =
        createJobRecordWithUpdateTime(
            jobId, IndexJobStatus.RUNNING, now - TimeUnit.MINUTES.toMillis(11));

    when(jobDAO.findByStatusesWithLimit(any(), eq(10))).thenReturn(List.of(jobRecord));
    when(lockDAO.cleanupExpiredLocks(anyLong())).thenReturn(0);
    // A genuinely crashed coordinator: its lock expired (no refresh) before updatedAt could go this
    // stale — the lock TTL (5 min) is shorter than the 10 min staleness threshold by design.
    when(lockDAO.getLockInfo(anyString()))
        .thenReturn(
            new SearchReindexLockDAO.LockInfo(
                "SEARCH_REINDEX_LOCK",
                jobId.toString(),
                TEST_SERVER_ID,
                now - TimeUnit.MINUTES.toMillis(20),
                now - TimeUnit.MINUTES.toMillis(16),
                now - TimeUnit.MINUTES.toMillis(11)));
    when(lockDAO.tryAcquireLock(anyString(), anyString(), anyString(), anyLong(), anyLong()))
        .thenReturn(true);
    stubFailIfUnchanged(1);
    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.PENDING.name()))
        .thenReturn(List.of());
    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.PROCESSING.name()))
        .thenReturn(List.of());
    when(partitionDAO.getAggregatedStats(jobId.toString()))
        .thenReturn(new AggregatedStatsRecord(100, 90, 80, 10, 1, 1, 0, 0, 0));

    JobRecoveryManager.RecoveryResult result = recoveryManager.performStartupRecovery();

    assertEquals(1, result.orphanedJobsFound());
    assertEquals(1, result.jobsMarkedFailed());
  }

  @Test
  void testStartupRecovery_LiveLockKeepsStaleLongRunningJobAlive() {
    // Regression: a large-catalog reindex running for ~2h whose updatedAt write lagged (15 min
    // stale) while its coordinator is alive — the lock was refreshed 30s ago, still well within its
    // 5-min TTL. The old code marked it orphaned and, being older than the 1h recovery window,
    // failed it with "Job abandoned due to server crash or shutdown". A live lock must keep it
    // alive.
    UUID jobId = UUID.randomUUID();
    long now = System.currentTimeMillis();
    SearchIndexJobRecord jobRecord =
        createJobRecordWithStartTime(
            jobId, IndexJobStatus.RUNNING, now - TimeUnit.HOURS.toMillis(2));

    when(jobDAO.findByStatusesWithLimit(any(), eq(10))).thenReturn(List.of(jobRecord));
    when(lockDAO.cleanupExpiredLocks(anyLong())).thenReturn(0);
    when(lockDAO.getLockInfo(anyString()))
        .thenReturn(
            new SearchReindexLockDAO.LockInfo(
                "SEARCH_REINDEX_LOCK",
                jobId.toString(),
                TEST_SERVER_ID,
                now - TimeUnit.HOURS.toMillis(2),
                now - TimeUnit.SECONDS.toMillis(30),
                now + TimeUnit.MINUTES.toMillis(4) + TimeUnit.SECONDS.toMillis(30)));

    JobRecoveryManager.RecoveryResult result = recoveryManager.performStartupRecovery();

    assertEquals(0, result.orphanedJobsFound());
    assertEquals(0, result.jobsMarkedFailed());
  }

  @Test
  void testJobNotOrphaned_ValidLockAndRecentUpdate() {
    UUID jobId = UUID.randomUUID();
    long now = System.currentTimeMillis();

    SearchIndexJobRecord jobRecord =
        createJobRecordWithUpdateTime(jobId, IndexJobStatus.RUNNING, now - 1000);
    when(jobDAO.findByStatusesWithLimit(any(), eq(10))).thenReturn(List.of(jobRecord));
    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);

    when(lockDAO.cleanupExpiredLocks(anyLong())).thenReturn(0);

    SearchReindexLockDAO.LockInfo validLock =
        new SearchReindexLockDAO.LockInfo(
            "SEARCH_REINDEX_LOCK",
            jobId.toString(),
            "other-server",
            now - TimeUnit.MINUTES.toMillis(5),
            now - 1000,
            now + TimeUnit.MINUTES.toMillis(5));
    when(lockDAO.getLockInfo(anyString())).thenReturn(validLock);

    JobRecoveryManager.RecoveryResult result = recoveryManager.performStartupRecovery();

    assertEquals(0, result.orphanedJobsFound());
  }

  @Test
  void testCheckForBlockingJob_ReturnsJobWhenRecoveryCannotAcquireLock() {
    UUID jobId = UUID.randomUUID();
    UUID partitionId = UUID.randomUUID();
    SearchIndexJobRecord jobRecord = createJobRecord(jobId, IndexJobStatus.RUNNING);

    when(jobDAO.findByStatusesWithLimit(any(), eq(1)))
        .thenReturn(List.of(jobRecord))
        .thenReturn(List.of(jobRecord));
    when(lockDAO.getLockInfo(anyString())).thenReturn(null);
    when(lockDAO.tryAcquireLock(anyString(), anyString(), anyString(), anyLong(), anyLong()))
        .thenReturn(false);
    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.PENDING.name()))
        .thenReturn(List.of(createPartitionRecord(jobId, partitionId, PartitionStatus.PENDING)));
    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.PROCESSING.name()))
        .thenReturn(List.of());

    Optional<SearchIndexJob> result = recoveryManager.checkForBlockingJob();

    assertTrue(result.isPresent());
    assertEquals(jobId, result.get().getId());
  }

  @Test
  void testStartupRecovery_FailsStoppingJobWhenNoForceCompletePathApplies() {
    UUID jobId = UUID.randomUUID();
    SearchIndexJobRecord jobRecord = createJobRecord(jobId, IndexJobStatus.STOPPING);

    when(jobDAO.findByStatusesWithLimit(any(), eq(10))).thenReturn(List.of(jobRecord));
    when(lockDAO.cleanupExpiredLocks(anyLong())).thenReturn(0);
    when(lockDAO.getLockInfo(anyString())).thenReturn(null);
    when(lockDAO.tryAcquireLock(anyString(), anyString(), anyString(), anyLong(), anyLong()))
        .thenReturn(true);
    stubFailIfUnchanged(1);
    when(partitionDAO.getAggregatedStats(jobId.toString()))
        .thenReturn(new AggregatedStatsRecord(50, 10, 8, 2, 1, 0, 0, 0, 0));

    JobRecoveryManager.RecoveryResult result = recoveryManager.performStartupRecovery();

    assertEquals(1, result.orphanedJobsFound());
    assertEquals(1, result.jobsMarkedFailed());
    verify(lockDAO).releaseLock("SEARCH_REINDEX_LOCK", jobId.toString());
  }

  @Test
  void testRecoveryResult_Builder() {
    JobRecoveryManager.RecoveryResult result =
        JobRecoveryManager.RecoveryResult.builder()
            .expiredLocksCleanedUp(5)
            .orphanedJobsFound(2)
            .incrementRecovered()
            .incrementFailed()
            .error("Test error")
            .build();

    assertEquals(5, result.expiredLocksCleanedUp());
    assertEquals(2, result.orphanedJobsFound());
    assertEquals(1, result.jobsRecovered());
    assertEquals(1, result.jobsMarkedFailed());
    assertEquals("Test error", result.error());
    assertTrue(result.hasError());
  }

  @Test
  void testStartupRecovery_RecoverReadyJob() {
    UUID jobId = UUID.randomUUID();

    SearchIndexJobRecord jobRecord = createJobRecord(jobId, IndexJobStatus.READY);
    when(jobDAO.findByStatusesWithLimit(any(), eq(10))).thenReturn(List.of(jobRecord));
    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);

    when(lockDAO.cleanupExpiredLocks(anyLong())).thenReturn(0);
    when(lockDAO.getLockInfo(anyString())).thenReturn(null);
    when(lockDAO.tryAcquireLock(anyString(), anyString(), anyString(), anyLong(), anyLong()))
        .thenReturn(true);

    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.PROCESSING.name()))
        .thenReturn(List.of());

    JobRecoveryManager.RecoveryResult result = recoveryManager.performStartupRecovery();

    assertEquals(1, result.orphanedJobsFound());
    assertEquals(1, result.jobsRecovered());
    assertEquals(0, result.jobsMarkedFailed());

    verifyNeverFailed();
  }

  private void stubFailIfUnchanged(int rowsUpdated) {
    when(jobDAO.failIfUnchanged(any(), any(), anyLong(), anyString())).thenReturn(rowsUpdated);
  }

  private void verifyNeverFailed() {
    verify(jobDAO, never()).failIfUnchanged(any(), any(), anyLong(), anyString());
  }

  private SearchIndexJobRecord createJobRecord(UUID jobId, IndexJobStatus status) {
    EventPublisherJob jobConfig = new EventPublisherJob().withEntities(Set.of("table"));
    long now = System.currentTimeMillis();
    return new SearchIndexJobRecord(
        jobId.toString(),
        status.name(),
        JsonUtils.pojoToJson(jobConfig),
        "staged_123_",
        null, // stagedIndexMapping
        10000,
        0,
        0,
        0,
        "{}",
        "admin",
        now - TimeUnit.MINUTES.toMillis(30),
        status == IndexJobStatus.RUNNING ? now - TimeUnit.MINUTES.toMillis(29) : null,
        null,
        now - TimeUnit.MINUTES.toMillis(15),
        null,
        now - TimeUnit.MINUTES.toMillis(28),
        2);
  }

  private SearchIndexJobRecord createJobRecordWithStartTime(
      UUID jobId, IndexJobStatus status, long startTime) {
    EventPublisherJob jobConfig = new EventPublisherJob().withEntities(Set.of("table"));
    return new SearchIndexJobRecord(
        jobId.toString(),
        status.name(),
        JsonUtils.pojoToJson(jobConfig),
        "staged_123_",
        null, // stagedIndexMapping
        10000,
        0,
        0,
        0,
        "{}",
        "admin",
        startTime,
        startTime,
        null,
        System.currentTimeMillis() - TimeUnit.MINUTES.toMillis(15),
        null,
        startTime + 5000,
        2);
  }

  private SearchIndexJobRecord createJobRecordWithUpdateTime(
      UUID jobId, IndexJobStatus status, long updateTime) {
    EventPublisherJob jobConfig = new EventPublisherJob().withEntities(Set.of("table"));
    long now = System.currentTimeMillis();
    return new SearchIndexJobRecord(
        jobId.toString(),
        status.name(),
        JsonUtils.pojoToJson(jobConfig),
        "staged_123_",
        null, // stagedIndexMapping
        10000,
        5000,
        4900,
        100,
        "{}",
        "admin",
        now - TimeUnit.MINUTES.toMillis(30),
        now - TimeUnit.MINUTES.toMillis(29),
        null,
        updateTime,
        null,
        now - TimeUnit.MINUTES.toMillis(28),
        2);
  }

  private SearchIndexPartitionRecord createPartitionRecord(
      UUID jobId, UUID partitionId, PartitionStatus status) {
    return new SearchIndexPartitionRecord(
        partitionId.toString(),
        jobId.toString(),
        "table",
        0,
        0,
        5000,
        5000,
        7500,
        50,
        status.name(),
        0,
        0,
        0,
        0,
        status == PartitionStatus.PROCESSING ? TEST_SERVER_ID : null,
        status == PartitionStatus.PROCESSING ? System.currentTimeMillis() : null,
        status == PartitionStatus.PROCESSING ? System.currentTimeMillis() : null,
        null,
        System.currentTimeMillis(),
        null,
        0,
        0L); // claimableAt
  }
}
