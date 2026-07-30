package org.openmetadata.service.apps.bundles.searchIndex.distributed;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Method;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexJobDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexPartitionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchReindexLockDAO;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class JobRecoveryOrphanDetectionTest {

  @Mock private CollectionDAO collectionDAO;
  @Mock private SearchIndexJobDAO jobDAO;
  @Mock private SearchIndexPartitionDAO partitionDAO;
  @Mock private SearchReindexLockDAO lockDAO;

  private static final UUID JOB_ID = UUID.randomUUID();
  private static final long NOW = System.currentTimeMillis();
  private static final long TEN_MINUTES_MS = TimeUnit.MINUTES.toMillis(10);

  @BeforeEach
  void setUp() {
    when(collectionDAO.searchIndexJobDAO()).thenReturn(jobDAO);
    when(collectionDAO.searchIndexPartitionDAO()).thenReturn(partitionDAO);
    when(collectionDAO.searchReindexLockDAO()).thenReturn(lockDAO);
    lenient().when(jobDAO.findByStatusesWithLimit(any(), anyInt())).thenReturn(List.of());
  }

  private SearchIndexJob buildJob(IndexJobStatus status, long updatedAt) {
    return SearchIndexJob.builder()
        .id(JOB_ID)
        .status(status)
        .totalRecords(1000)
        .processedRecords(500)
        .successRecords(500)
        .failedRecords(0)
        .createdAt(NOW - TimeUnit.MINUTES.toMillis(30))
        .startedAt(NOW - TimeUnit.MINUTES.toMillis(29))
        .updatedAt(updatedAt)
        .createdBy("test")
        .build();
  }

  private boolean invokeIsJobOrphaned(JobRecoveryManager manager, SearchIndexJob job)
      throws Exception {
    Method method =
        JobRecoveryManager.class.getDeclaredMethod("isJobOrphaned", SearchIndexJob.class);
    method.setAccessible(true);
    return (boolean) method.invoke(manager, job);
  }

  @Nested
  @DisplayName("isJobOrphaned - updatedAt freshness check")
  class OrphanDetectionTests {

    @Test
    @DisplayName("Job with fresh updatedAt is NOT orphaned even without a lock")
    void freshUpdatedAtMeansNotOrphaned() throws Exception {
      // Simulate: recovery released the lock, but partitions are actively completing
      // and touching job.updatedAt via touchJobThrottled
      SearchIndexJob job = buildJob(IndexJobStatus.RUNNING, NOW - TimeUnit.MINUTES.toMillis(3));
      when(lockDAO.getLockInfo("SEARCH_REINDEX_LOCK")).thenReturn(null);

      JobRecoveryManager manager = new JobRecoveryManager(collectionDAO);
      boolean orphaned = invokeIsJobOrphaned(manager, job);

      assertFalse(orphaned, "Job with updatedAt 3 min ago should NOT be considered orphaned");
    }

    @Test
    @DisplayName("Job with stale updatedAt and no lock IS orphaned")
    void staleUpdatedAtWithNoLockIsOrphaned() throws Exception {
      // Simulate: no lock, updatedAt is 15 min old — truly abandoned
      SearchIndexJob job = buildJob(IndexJobStatus.RUNNING, NOW - TimeUnit.MINUTES.toMillis(15));
      when(lockDAO.getLockInfo("SEARCH_REINDEX_LOCK")).thenReturn(null);

      JobRecoveryManager manager = new JobRecoveryManager(collectionDAO);
      boolean orphaned = invokeIsJobOrphaned(manager, job);

      assertTrue(orphaned, "Job with stale updatedAt and no lock should be orphaned");
    }

    @Test
    @DisplayName("Job with stale updatedAt but a live (unexpired) lock is NOT orphaned")
    void staleUpdatedAtWithLiveLockIsNotOrphaned() throws Exception {
      // A live coordinator refreshes the lock every 60s (5 min TTL) and touches updatedAt in the
      // same loop. If the updatedAt write lags (touchJob failing while refresh succeeds, or a long
      // single-partition batch), the heartbeat can look stale while the lock stays fresh. Because
      // the lock TTL (5 min) is shorter than the 10 min staleness threshold, a crashed
      // coordinator's
      // lock would already have expired — so a still-valid lock here can only be a live
      // coordinator,
      // and abandoning the job would wrongly fail a healthy reindex.
      SearchIndexJob job = buildJob(IndexJobStatus.RUNNING, NOW - TimeUnit.MINUTES.toMillis(12));
      SearchReindexLockDAO.LockInfo liveLock =
          new SearchReindexLockDAO.LockInfo(
              "SEARCH_REINDEX_LOCK",
              JOB_ID.toString(),
              "live-coordinator",
              NOW - TimeUnit.MINUTES.toMillis(20),
              NOW - TimeUnit.SECONDS.toMillis(30),
              NOW + TimeUnit.MINUTES.toMillis(4) + TimeUnit.SECONDS.toMillis(30));
      when(lockDAO.getLockInfo("SEARCH_REINDEX_LOCK")).thenReturn(liveLock);

      JobRecoveryManager manager = new JobRecoveryManager(collectionDAO);
      boolean orphaned = invokeIsJobOrphaned(manager, job);

      assertFalse(
          orphaned,
          "A still-valid lock proves the coordinator is alive (lock TTL < staleness threshold); "
              + "the job must not be treated as orphaned/abandoned");
    }

    @Test
    @DisplayName("Job with fresh updatedAt and valid lock is NOT orphaned")
    void freshUpdatedAtWithValidLockNotOrphaned() throws Exception {
      SearchIndexJob job = buildJob(IndexJobStatus.RUNNING, NOW - TimeUnit.MINUTES.toMillis(1));
      SearchReindexLockDAO.LockInfo lockInfo =
          new SearchReindexLockDAO.LockInfo(
              "SEARCH_REINDEX_LOCK",
              JOB_ID.toString(),
              "active-server",
              NOW,
              NOW,
              NOW + TimeUnit.MINUTES.toMillis(5));
      when(lockDAO.getLockInfo("SEARCH_REINDEX_LOCK")).thenReturn(lockInfo);

      JobRecoveryManager manager = new JobRecoveryManager(collectionDAO);
      boolean orphaned = invokeIsJobOrphaned(manager, job);

      assertFalse(orphaned, "Job with fresh updatedAt and valid lock should NOT be orphaned");
    }

    @Test
    @DisplayName("Job just inside the threshold is NOT orphaned")
    void updatedAtJustInsideThresholdIsNotOrphaned() throws Exception {
      // updatedAt is 9 min 59 sec ago — inside the 10 min window
      SearchIndexJob job =
          buildJob(IndexJobStatus.RUNNING, NOW - TEN_MINUTES_MS + TimeUnit.SECONDS.toMillis(1));
      when(lockDAO.getLockInfo("SEARCH_REINDEX_LOCK")).thenReturn(null);

      JobRecoveryManager manager = new JobRecoveryManager(collectionDAO);
      boolean orphaned = invokeIsJobOrphaned(manager, job);

      assertFalse(orphaned, "Job just inside threshold should NOT be orphaned");
    }

    @Test
    @DisplayName("Job at or past the threshold IS orphaned")
    void updatedAtAtThresholdIsOrphaned() throws Exception {
      SearchIndexJob job = buildJob(IndexJobStatus.RUNNING, NOW - TEN_MINUTES_MS);
      when(lockDAO.getLockInfo("SEARCH_REINDEX_LOCK")).thenReturn(null);

      JobRecoveryManager manager = new JobRecoveryManager(collectionDAO);
      boolean orphaned = invokeIsJobOrphaned(manager, job);

      assertTrue(orphaned, "Job at threshold should be orphaned");
    }
  }

  @Nested
  @DisplayName("recoverJob - updatedAt refresh")
  class RecoverJobTests {

    @Test
    @DisplayName("recoverJob touches job.updatedAt after resetting partitions")
    void recoverJobTouchesUpdatedAt() throws Exception {
      SearchIndexJob job = buildJob(IndexJobStatus.RUNNING, NOW - TimeUnit.MINUTES.toMillis(15));

      when(lockDAO.tryAcquireLock(anyString(), anyString(), anyString(), anyLong(), anyLong()))
          .thenReturn(true);
      when(partitionDAO.findByJobIdAndStatus(JOB_ID.toString(), "PROCESSING"))
          .thenReturn(List.of());

      Method recoverMethod =
          JobRecoveryManager.class.getDeclaredMethod("recoverJob", SearchIndexJob.class);
      recoverMethod.setAccessible(true);

      JobRecoveryManager manager = new JobRecoveryManager(collectionDAO);
      boolean recovered = (boolean) recoverMethod.invoke(manager, job);

      assertTrue(recovered);
      verify(jobDAO).touchJob(eq(JOB_ID.toString()), anyLong());
    }

    @Test
    @DisplayName("recoverJob does NOT touch updatedAt if lock acquisition fails")
    void recoverJobSkipsIfLockNotAcquired() throws Exception {
      SearchIndexJob job = buildJob(IndexJobStatus.RUNNING, NOW - TimeUnit.MINUTES.toMillis(15));

      when(lockDAO.tryAcquireLock(anyString(), anyString(), anyString(), anyLong(), anyLong()))
          .thenReturn(false);

      Method recoverMethod =
          JobRecoveryManager.class.getDeclaredMethod("recoverJob", SearchIndexJob.class);
      recoverMethod.setAccessible(true);

      JobRecoveryManager manager = new JobRecoveryManager(collectionDAO);
      boolean recovered = (boolean) recoverMethod.invoke(manager, job);

      assertFalse(recovered);
      verify(jobDAO, never()).touchJob(anyString(), anyLong());
    }
  }

  @Nested
  @DisplayName("completePartition - throttled updatedAt touch")
  class CompletePartitionTests {

    @Test
    @DisplayName("completePartition touches job.updatedAt on first call")
    void completePartitionTouchesUpdatedAtOnFirstCall() {
      UUID partitionId = UUID.randomUUID();
      CollectionDAO.SearchIndexPartitionDAO.SearchIndexPartitionRecord record =
          mock(CollectionDAO.SearchIndexPartitionDAO.SearchIndexPartitionRecord.class);
      when(record.jobId()).thenReturn(JOB_ID.toString());
      when(record.entityType()).thenReturn("table");
      when(record.rangeEnd()).thenReturn(100L);
      when(record.assignedServer()).thenReturn("server1");
      when(record.claimedAt()).thenReturn(NOW);
      when(record.startedAt()).thenReturn(NOW);
      when(record.lastError()).thenReturn(null);
      when(record.retryCount()).thenReturn(0);
      when(partitionDAO.findById(partitionId.toString())).thenReturn(record);
      when(partitionDAO.updateIfProcessing(
              anyString(),
              anyString(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyString(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              any(),
              anyInt()))
          .thenReturn(1);

      // Mock job completion check — job still has pending partitions
      when(partitionDAO.findByJobIdAndStatus(JOB_ID.toString(), "PENDING"))
          .thenReturn(List.of(record));
      when(partitionDAO.findByJobIdAndStatus(JOB_ID.toString(), "PROCESSING"))
          .thenReturn(List.of());

      PartitionCalculator calculator = new PartitionCalculator(10000);
      DistributedSearchIndexCoordinator coordinator =
          new DistributedSearchIndexCoordinator(collectionDAO, calculator);

      coordinator.completePartition(partitionId, 100, 0);

      verify(jobDAO, atLeastOnce()).touchJob(eq(JOB_ID.toString()), anyLong());
    }

    @Test
    @DisplayName("touchJobThrottled handles exception gracefully when touchJob throws")
    void touchJobThrottledHandlesExceptionGracefully() {
      UUID partitionId = UUID.randomUUID();
      CollectionDAO.SearchIndexPartitionDAO.SearchIndexPartitionRecord record =
          mock(CollectionDAO.SearchIndexPartitionDAO.SearchIndexPartitionRecord.class);
      when(record.jobId()).thenReturn(JOB_ID.toString());
      when(record.entityType()).thenReturn("table");
      when(record.rangeEnd()).thenReturn(100L);
      when(record.assignedServer()).thenReturn("server1");
      when(record.claimedAt()).thenReturn(NOW);
      when(record.startedAt()).thenReturn(NOW);
      when(record.lastError()).thenReturn(null);
      when(record.retryCount()).thenReturn(0);
      when(partitionDAO.findById(partitionId.toString())).thenReturn(record);
      when(partitionDAO.updateIfProcessing(
              anyString(),
              anyString(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyString(),
              anyLong(),
              anyLong(),
              anyLong(),
              anyLong(),
              any(),
              anyInt()))
          .thenReturn(1);

      when(partitionDAO.findByJobIdAndStatus(JOB_ID.toString(), "PENDING"))
          .thenReturn(List.of(record));
      when(partitionDAO.findByJobIdAndStatus(JOB_ID.toString(), "PROCESSING"))
          .thenReturn(List.of());

      org.mockito.Mockito.doThrow(new RuntimeException("DB connection lost"))
          .when(jobDAO)
          .touchJob(eq(JOB_ID.toString()), anyLong());

      PartitionCalculator calculator = new PartitionCalculator(10000);
      DistributedSearchIndexCoordinator coordinator =
          new DistributedSearchIndexCoordinator(collectionDAO, calculator);

      org.junit.jupiter.api.Assertions.assertDoesNotThrow(
          () -> coordinator.completePartition(partitionId, 100, 0));
    }
  }
}
