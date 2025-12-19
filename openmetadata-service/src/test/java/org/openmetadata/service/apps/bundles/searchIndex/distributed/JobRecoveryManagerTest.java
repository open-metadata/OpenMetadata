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
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexJobDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexJobDAO.SearchIndexJobRecord;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexPartitionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexPartitionDAO.AggregatedStatsRecord;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexPartitionDAO.SearchIndexPartitionRecord;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchReindexLockDAO;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class JobRecoveryManagerTest {

  @Mock private CollectionDAO collectionDAO;
  @Mock private SearchIndexJobDAO jobDAO;
  @Mock private SearchIndexPartitionDAO partitionDAO;
  @Mock private SearchReindexLockDAO lockDAO;

  private JobRecoveryManager recoveryManager;
  private MockedStatic<ServerIdentityResolver> serverIdentityMock;
  private ServerIdentityResolver mockServerIdentityResolver;

  private static final String TEST_SERVER_ID = "test-server-1";

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

    AggregatedStatsRecord stats = new AggregatedStatsRecord(10000, 5000, 4900, 100, 2, 1, 1, 0, 0);
    when(partitionDAO.getAggregatedStats(jobId.toString())).thenReturn(stats);

    JobRecoveryManager.RecoveryResult result = recoveryManager.performStartupRecovery();

    assertEquals(1, result.orphanedJobsFound());
    assertEquals(0, result.jobsRecovered());
    assertEquals(1, result.jobsMarkedFailed());

    verify(jobDAO)
        .update(
            eq(jobId.toString()),
            eq(IndexJobStatus.FAILED.name()),
            anyLong(),
            anyLong(),
            anyLong(),
            any(),
            anyLong(),
            anyLong(),
            anyLong(),
            anyString());
  }

  @Test
  void testStartupRecovery_FailInitializingJob() {
    UUID jobId = UUID.randomUUID();

    SearchIndexJobRecord jobRecord = createJobRecord(jobId, IndexJobStatus.INITIALIZING);
    when(jobDAO.findByStatusesWithLimit(any(), eq(10))).thenReturn(List.of(jobRecord));
    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);

    when(lockDAO.cleanupExpiredLocks(anyLong())).thenReturn(0);
    when(lockDAO.getLockInfo(anyString())).thenReturn(null);

    AggregatedStatsRecord stats = new AggregatedStatsRecord(0, 0, 0, 0, 0, 0, 0, 0, 0);
    when(partitionDAO.getAggregatedStats(jobId.toString())).thenReturn(stats);

    JobRecoveryManager.RecoveryResult result = recoveryManager.performStartupRecovery();

    assertEquals(1, result.orphanedJobsFound());
    assertEquals(0, result.jobsRecovered());
    assertEquals(1, result.jobsMarkedFailed());
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

    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.PROCESSING.name()))
        .thenReturn(List.of());

    JobRecoveryManager.RecoveryResult result = recoveryManager.performStartupRecovery();

    assertEquals(1, result.orphanedJobsFound());
    assertEquals(1, result.jobsRecovered());
    assertEquals(0, result.jobsMarkedFailed());

    verify(jobDAO, never())
        .update(
            eq(jobId.toString()),
            eq(IndexJobStatus.FAILED.name()),
            anyLong(),
            anyLong(),
            anyLong(),
            any(),
            anyLong(),
            anyLong(),
            anyLong(),
            anyString());
  }

  private SearchIndexJobRecord createJobRecord(UUID jobId, IndexJobStatus status) {
    EventPublisherJob jobConfig = new EventPublisherJob().withEntities(Set.of("table"));
    long now = System.currentTimeMillis();
    return new SearchIndexJobRecord(
        jobId.toString(),
        status.name(),
        JsonUtils.pojoToJson(jobConfig),
        "staged_123_",
        10000,
        0,
        0,
        0,
        "{}",
        "admin",
        now - TimeUnit.MINUTES.toMillis(30),
        status == IndexJobStatus.RUNNING ? now - TimeUnit.MINUTES.toMillis(29) : null,
        null,
        now - TimeUnit.MINUTES.toMillis(5),
        null);
  }

  private SearchIndexJobRecord createJobRecordWithStartTime(
      UUID jobId, IndexJobStatus status, long startTime) {
    EventPublisherJob jobConfig = new EventPublisherJob().withEntities(Set.of("table"));
    return new SearchIndexJobRecord(
        jobId.toString(),
        status.name(),
        JsonUtils.pojoToJson(jobConfig),
        "staged_123_",
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
        null);
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
        null);
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
        0);
  }
}
