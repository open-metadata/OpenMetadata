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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
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
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexPartitionDAO.EntityStatsRecord;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexPartitionDAO.SearchIndexPartitionRecord;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchReindexLockDAO;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DistributedSearchIndexCoordinatorTest {

  @Mock private CollectionDAO collectionDAO;
  @Mock private SearchIndexJobDAO jobDAO;
  @Mock private SearchIndexPartitionDAO partitionDAO;
  @Mock private SearchReindexLockDAO lockDAO;
  @Mock private PartitionCalculator partitionCalculator;

  private DistributedSearchIndexCoordinator coordinator;
  private MockedStatic<ServerIdentityResolver> serverIdentityMock;
  private ServerIdentityResolver mockServerIdentityResolver;

  private static final String TEST_SERVER_ID = "test-server-1";

  @BeforeEach
  void setUp() {
    // Mock ServerIdentityResolver
    mockServerIdentityResolver = mock(ServerIdentityResolver.class);
    when(mockServerIdentityResolver.getServerId()).thenReturn(TEST_SERVER_ID);

    serverIdentityMock = mockStatic(ServerIdentityResolver.class);
    serverIdentityMock
        .when(ServerIdentityResolver::getInstance)
        .thenReturn(mockServerIdentityResolver);

    // Setup DAO mocks
    when(collectionDAO.searchIndexJobDAO()).thenReturn(jobDAO);
    when(collectionDAO.searchIndexPartitionDAO()).thenReturn(partitionDAO);
    when(collectionDAO.searchReindexLockDAO()).thenReturn(lockDAO);

    coordinator = new DistributedSearchIndexCoordinator(collectionDAO, partitionCalculator);
  }

  @AfterEach
  void tearDown() {
    if (serverIdentityMock != null) {
      serverIdentityMock.close();
    }
  }

  @Test
  void testCreateJob_Success() {
    Set<String> entities = Set.of("table", "user");
    EventPublisherJob jobConfig = new EventPublisherJob().withEntities(entities).withBatchSize(500);

    when(partitionCalculator.getEntityCounts(entities))
        .thenReturn(java.util.Map.of("table", 10000L, "user", 5000L));

    SearchIndexJob job = coordinator.createJob(entities, jobConfig, "admin");

    assertNotNull(job);
    assertNotNull(job.getId());
    assertEquals(IndexJobStatus.INITIALIZING, job.getStatus());
    assertEquals(15000, job.getTotalRecords());
    assertEquals("admin", job.getCreatedBy());
    assertEquals(2, job.getEntityStats().size());

    // Verify job was inserted
    verify(jobDAO)
        .insert(
            eq(job.getId().toString()),
            eq(IndexJobStatus.INITIALIZING.name()),
            anyString(), // jobConfiguration JSON
            anyString(), // targetIndexPrefix
            eq(15000L),
            eq(0L),
            eq(0L),
            eq(0L),
            anyString(), // stats JSON
            eq("admin"),
            anyLong(),
            anyLong());
  }

  @Test
  void testInitializePartitions_Success() {
    UUID jobId = UUID.randomUUID();
    Set<String> entities = Set.of("table");

    EventPublisherJob jobConfig = new EventPublisherJob().withEntities(entities);
    String jobConfigJson = JsonUtils.pojoToJson(jobConfig);

    SearchIndexJobRecord jobRecord =
        new SearchIndexJobRecord(
            jobId.toString(),
            IndexJobStatus.INITIALIZING.name(),
            jobConfigJson,
            "staged_123_",
            10000,
            0,
            0,
            0,
            "{}",
            "admin",
            System.currentTimeMillis(),
            null,
            null,
            System.currentTimeMillis(),
            null);

    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);

    List<SearchIndexPartition> mockPartitions =
        List.of(
            SearchIndexPartition.builder()
                .id(UUID.randomUUID())
                .jobId(jobId)
                .entityType("table")
                .partitionIndex(0)
                .rangeStart(0)
                .rangeEnd(5000)
                .estimatedCount(5000)
                .workUnits(7500)
                .priority(50)
                .status(PartitionStatus.PENDING)
                .cursor(0)
                .build(),
            SearchIndexPartition.builder()
                .id(UUID.randomUUID())
                .jobId(jobId)
                .entityType("table")
                .partitionIndex(1)
                .rangeStart(5000)
                .rangeEnd(10000)
                .estimatedCount(5000)
                .workUnits(7500)
                .priority(50)
                .status(PartitionStatus.PENDING)
                .cursor(5000)
                .build());

    when(partitionCalculator.calculatePartitions(jobId, entities)).thenReturn(mockPartitions);

    SearchIndexJob result = coordinator.initializePartitions(jobId);

    assertNotNull(result);
    assertEquals(IndexJobStatus.READY, result.getStatus());

    // Verify partitions were inserted
    verify(partitionDAO, times(2))
        .insert(
            anyString(),
            anyString(),
            anyString(),
            anyInt(),
            anyLong(),
            anyLong(),
            anyLong(),
            anyLong(),
            anyInt(),
            eq(PartitionStatus.PENDING.name()),
            anyLong());

    // Verify job was updated
    verify(jobDAO)
        .update(
            eq(jobId.toString()),
            eq(IndexJobStatus.READY.name()),
            anyLong(),
            anyLong(),
            anyLong(),
            anyString(),
            any(),
            any(),
            anyLong(),
            any());
  }

  @Test
  void testInitializePartitions_WrongState() {
    UUID jobId = UUID.randomUUID();
    EventPublisherJob jobConfig = new EventPublisherJob().withEntities(Set.of("table"));
    String jobConfigJson = JsonUtils.pojoToJson(jobConfig);

    SearchIndexJobRecord jobRecord =
        new SearchIndexJobRecord(
            jobId.toString(),
            IndexJobStatus.RUNNING.name(), // Wrong state
            jobConfigJson,
            "staged_123_",
            10000,
            0,
            0,
            0,
            "{}",
            "admin",
            System.currentTimeMillis(),
            null,
            null,
            System.currentTimeMillis(),
            null);

    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);

    assertThrows(IllegalStateException.class, () -> coordinator.initializePartitions(jobId));
  }

  @Test
  void testClaimNextPartition_Success() {
    UUID jobId = UUID.randomUUID();
    UUID partitionId = UUID.randomUUID();

    SearchIndexPartitionRecord record =
        new SearchIndexPartitionRecord(
            partitionId.toString(),
            jobId.toString(),
            "table",
            0,
            0,
            5000,
            5000,
            7500,
            50,
            PartitionStatus.PENDING.name(),
            0,
            0,
            0,
            0,
            null,
            null,
            null,
            null,
            null,
            null,
            0);

    // New atomic claim approach
    when(partitionDAO.claimNextPartitionAtomic(eq(jobId.toString()), eq(TEST_SERVER_ID), anyLong()))
        .thenReturn(1);
    when(partitionDAO.findLatestClaimedPartition(jobId.toString(), TEST_SERVER_ID))
        .thenReturn(
            new SearchIndexPartitionRecord(
                partitionId.toString(),
                jobId.toString(),
                "table",
                0,
                0,
                5000,
                5000,
                7500,
                50,
                PartitionStatus.PROCESSING.name(),
                0,
                0,
                0,
                0,
                TEST_SERVER_ID,
                System.currentTimeMillis(),
                System.currentTimeMillis(),
                null,
                System.currentTimeMillis(),
                null,
                0));

    Optional<SearchIndexPartition> result = coordinator.claimNextPartition(jobId);

    assertTrue(result.isPresent());
    assertEquals(partitionId, result.get().getId());
    assertEquals(PartitionStatus.PROCESSING, result.get().getStatus());
    assertEquals(TEST_SERVER_ID, result.get().getAssignedServer());

    verify(partitionDAO)
        .claimNextPartitionAtomic(eq(jobId.toString()), eq(TEST_SERVER_ID), anyLong());
  }

  @Test
  void testClaimNextPartition_NoPartitionsAvailable() {
    UUID jobId = UUID.randomUUID();
    when(partitionDAO.claimNextPartitionAtomic(eq(jobId.toString()), eq(TEST_SERVER_ID), anyLong()))
        .thenReturn(0);

    Optional<SearchIndexPartition> result = coordinator.claimNextPartition(jobId);

    assertFalse(result.isPresent());
    verify(partitionDAO, never()).findLatestClaimedPartition(anyString(), anyString());
  }

  @Test
  void testCompletePartition_Success() {
    UUID jobId = UUID.randomUUID();
    UUID partitionId = UUID.randomUUID();

    SearchIndexPartitionRecord record =
        new SearchIndexPartitionRecord(
            partitionId.toString(),
            jobId.toString(),
            "table",
            0,
            0,
            5000,
            5000,
            7500,
            50,
            PartitionStatus.PROCESSING.name(),
            2500,
            2500,
            2400,
            100,
            TEST_SERVER_ID,
            System.currentTimeMillis() - 10000,
            System.currentTimeMillis() - 10000,
            null,
            System.currentTimeMillis() - 1000,
            null,
            0);

    when(partitionDAO.findById(partitionId.toString())).thenReturn(record);

    // Mock that there are still pending partitions
    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.PENDING.name()))
        .thenReturn(List.of(mock(SearchIndexPartitionRecord.class)));

    coordinator.completePartition(partitionId, 4900, 100);

    // Verify partition was updated to COMPLETED
    verify(partitionDAO)
        .update(
            eq(partitionId.toString()),
            eq(PartitionStatus.COMPLETED.name()),
            eq(5000L), // cursor = rangeEnd
            eq(5000L), // processed = success + failed
            eq(4900L), // success
            eq(100L), // failed
            eq(TEST_SERVER_ID),
            anyLong(),
            anyLong(),
            anyLong(),
            anyLong(),
            any(),
            anyInt());
  }

  @Test
  void testFailPartition_RetryAvailable() {
    UUID jobId = UUID.randomUUID();
    UUID partitionId = UUID.randomUUID();

    SearchIndexPartitionRecord record =
        new SearchIndexPartitionRecord(
            partitionId.toString(),
            jobId.toString(),
            "table",
            0,
            0,
            5000,
            5000,
            7500,
            50,
            PartitionStatus.PROCESSING.name(),
            2500,
            2500,
            2400,
            100,
            TEST_SERVER_ID,
            System.currentTimeMillis() - 10000,
            System.currentTimeMillis() - 10000,
            null,
            System.currentTimeMillis() - 1000,
            null,
            0); // retryCount = 0

    when(partitionDAO.findById(partitionId.toString())).thenReturn(record);

    coordinator.failPartition(partitionId, "Connection timeout");

    // Verify partition was reset to PENDING for retry
    ArgumentCaptor<String> statusCaptor = ArgumentCaptor.forClass(String.class);
    ArgumentCaptor<Integer> retryCaptor = ArgumentCaptor.forClass(Integer.class);

    verify(partitionDAO)
        .update(
            eq(partitionId.toString()),
            statusCaptor.capture(),
            anyLong(),
            anyLong(),
            anyLong(),
            anyLong(),
            any(),
            any(),
            any(),
            any(),
            anyLong(),
            eq("Connection timeout"),
            retryCaptor.capture());

    assertEquals(PartitionStatus.PENDING.name(), statusCaptor.getValue());
    assertEquals(1, retryCaptor.getValue()); // retryCount incremented
  }

  @Test
  void testFailPartition_MaxRetriesExceeded() {
    UUID jobId = UUID.randomUUID();
    UUID partitionId = UUID.randomUUID();

    SearchIndexPartitionRecord record =
        new SearchIndexPartitionRecord(
            partitionId.toString(),
            jobId.toString(),
            "table",
            0,
            0,
            5000,
            5000,
            7500,
            50,
            PartitionStatus.PROCESSING.name(),
            2500,
            2500,
            2400,
            100,
            TEST_SERVER_ID,
            System.currentTimeMillis() - 10000,
            System.currentTimeMillis() - 10000,
            null,
            System.currentTimeMillis() - 1000,
            null,
            3); // retryCount = 3 (max)

    when(partitionDAO.findById(partitionId.toString())).thenReturn(record);

    // Mock for job completion check
    EventPublisherJob jobConfig = new EventPublisherJob().withEntities(Set.of("table"));
    SearchIndexJobRecord jobRecord =
        new SearchIndexJobRecord(
            jobId.toString(),
            IndexJobStatus.RUNNING.name(),
            JsonUtils.pojoToJson(jobConfig),
            "staged_123_",
            5000,
            2500,
            2400,
            100,
            "{}",
            "admin",
            System.currentTimeMillis() - 60000,
            System.currentTimeMillis() - 50000,
            null,
            System.currentTimeMillis(),
            null);
    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);
    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.PENDING.name()))
        .thenReturn(List.of());
    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.PROCESSING.name()))
        .thenReturn(List.of());
    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.FAILED.name()))
        .thenReturn(List.of(record));

    AggregatedStatsRecord aggregatedStats =
        new AggregatedStatsRecord(5000, 2500, 2400, 100, 1, 0, 1, 0, 0);
    when(partitionDAO.getAggregatedStats(jobId.toString())).thenReturn(aggregatedStats);

    coordinator.failPartition(partitionId, "Connection timeout");

    // Verify partition was marked as FAILED (not retried)
    verify(partitionDAO)
        .update(
            eq(partitionId.toString()),
            eq(PartitionStatus.FAILED.name()),
            anyLong(),
            anyLong(),
            anyLong(),
            anyLong(),
            anyString(),
            anyLong(),
            anyLong(),
            anyLong(),
            anyLong(),
            eq("Connection timeout"),
            eq(3));
  }

  @Test
  void testStartJob_Success() {
    UUID jobId = UUID.randomUUID();
    EventPublisherJob jobConfig = new EventPublisherJob().withEntities(Set.of("table"));

    SearchIndexJobRecord jobRecord =
        new SearchIndexJobRecord(
            jobId.toString(),
            IndexJobStatus.READY.name(),
            JsonUtils.pojoToJson(jobConfig),
            "staged_123_",
            10000,
            0,
            0,
            0,
            "{}",
            "admin",
            System.currentTimeMillis(),
            null,
            null,
            System.currentTimeMillis(),
            null);

    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);

    coordinator.startJob(jobId);

    verify(jobDAO)
        .update(
            eq(jobId.toString()),
            eq(IndexJobStatus.RUNNING.name()),
            anyLong(),
            anyLong(),
            anyLong(),
            anyString(),
            anyLong(),
            any(),
            anyLong(),
            any());
  }

  @Test
  void testStartJob_WrongState() {
    UUID jobId = UUID.randomUUID();
    EventPublisherJob jobConfig = new EventPublisherJob().withEntities(Set.of("table"));

    SearchIndexJobRecord jobRecord =
        new SearchIndexJobRecord(
            jobId.toString(),
            IndexJobStatus.INITIALIZING.name(), // Wrong state
            JsonUtils.pojoToJson(jobConfig),
            "staged_123_",
            10000,
            0,
            0,
            0,
            "{}",
            "admin",
            System.currentTimeMillis(),
            null,
            null,
            System.currentTimeMillis(),
            null);

    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);

    assertThrows(IllegalStateException.class, () -> coordinator.startJob(jobId));
  }

  @Test
  void testRequestStop_Success() {
    UUID jobId = UUID.randomUUID();
    EventPublisherJob jobConfig = new EventPublisherJob().withEntities(Set.of("table"));

    SearchIndexJobRecord jobRecord =
        new SearchIndexJobRecord(
            jobId.toString(),
            IndexJobStatus.RUNNING.name(),
            JsonUtils.pojoToJson(jobConfig),
            "staged_123_",
            10000,
            5000,
            4900,
            100,
            "{}",
            "admin",
            System.currentTimeMillis() - 60000,
            System.currentTimeMillis() - 50000,
            null,
            System.currentTimeMillis(),
            null);

    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);

    coordinator.requestStop(jobId);

    // Verify job status updated to STOPPING
    verify(jobDAO)
        .update(
            eq(jobId.toString()),
            eq(IndexJobStatus.STOPPING.name()),
            anyLong(),
            anyLong(),
            anyLong(),
            anyString(),
            any(),
            any(),
            anyLong(),
            any());

    // Verify pending partitions were cancelled
    verify(partitionDAO).cancelPendingPartitions(jobId.toString());
  }

  @Test
  void testGetJob_Found() {
    UUID jobId = UUID.randomUUID();
    EventPublisherJob jobConfig = new EventPublisherJob().withEntities(Set.of("table"));

    SearchIndexJobRecord jobRecord =
        new SearchIndexJobRecord(
            jobId.toString(),
            IndexJobStatus.RUNNING.name(),
            JsonUtils.pojoToJson(jobConfig),
            "staged_123_",
            10000,
            5000,
            4900,
            100,
            "{}",
            "admin",
            System.currentTimeMillis(),
            System.currentTimeMillis(),
            null,
            System.currentTimeMillis(),
            null);

    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);

    Optional<SearchIndexJob> result = coordinator.getJob(jobId);

    assertTrue(result.isPresent());
    assertEquals(jobId, result.get().getId());
    assertEquals(IndexJobStatus.RUNNING, result.get().getStatus());
  }

  @Test
  void testGetJob_NotFound() {
    UUID jobId = UUID.randomUUID();
    when(jobDAO.findById(jobId.toString())).thenReturn(null);

    Optional<SearchIndexJob> result = coordinator.getJob(jobId);

    assertFalse(result.isPresent());
  }

  @Test
  void testGetJobWithAggregatedStats() {
    UUID jobId = UUID.randomUUID();
    EventPublisherJob jobConfig = new EventPublisherJob().withEntities(Set.of("table", "user"));

    SearchIndexJobRecord jobRecord =
        new SearchIndexJobRecord(
            jobId.toString(),
            IndexJobStatus.RUNNING.name(),
            JsonUtils.pojoToJson(jobConfig),
            "staged_123_",
            15000,
            0,
            0,
            0,
            "{}",
            "admin",
            System.currentTimeMillis(),
            System.currentTimeMillis(),
            null,
            System.currentTimeMillis(),
            null);

    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);

    AggregatedStatsRecord aggregatedStats =
        new AggregatedStatsRecord(15000, 10000, 9800, 200, 4, 2, 0, 1, 1);
    when(partitionDAO.getAggregatedStats(jobId.toString())).thenReturn(aggregatedStats);

    List<EntityStatsRecord> entityStats =
        List.of(
            new EntityStatsRecord("table", 10000, 7000, 6900, 100, 2, 1, 0),
            new EntityStatsRecord("user", 5000, 3000, 2900, 100, 2, 1, 0));
    when(partitionDAO.getEntityStats(jobId.toString())).thenReturn(entityStats);

    SearchIndexJob result = coordinator.getJobWithAggregatedStats(jobId);

    assertNotNull(result);
    assertEquals(10000, result.getProcessedRecords());
    assertEquals(9800, result.getSuccessRecords());
    assertEquals(200, result.getFailedRecords());
    assertEquals(2, result.getEntityStats().size());

    SearchIndexJob.EntityTypeStats tableStats = result.getEntityStats().get("table");
    assertNotNull(tableStats);
    assertEquals(10000, tableStats.getTotalRecords());
    assertEquals(7000, tableStats.getProcessedRecords());
    assertEquals(6900, tableStats.getSuccessRecords());
    assertEquals(100, tableStats.getFailedRecords());
  }

  @Test
  void testGetPartitions_AllPartitions() {
    UUID jobId = UUID.randomUUID();

    List<SearchIndexPartitionRecord> records =
        List.of(
            createPartitionRecord(jobId, "table", 0, PartitionStatus.COMPLETED),
            createPartitionRecord(jobId, "table", 1, PartitionStatus.PROCESSING),
            createPartitionRecord(jobId, "user", 0, PartitionStatus.PENDING));

    when(partitionDAO.findByJobId(jobId.toString())).thenReturn(records);

    List<SearchIndexPartition> result = coordinator.getPartitions(jobId, null);

    assertEquals(3, result.size());
  }

  @Test
  void testGetPartitions_FilterByStatus() {
    UUID jobId = UUID.randomUUID();

    List<SearchIndexPartitionRecord> pendingRecords =
        List.of(createPartitionRecord(jobId, "user", 0, PartitionStatus.PENDING));

    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.PENDING.name()))
        .thenReturn(pendingRecords);

    List<SearchIndexPartition> result = coordinator.getPartitions(jobId, PartitionStatus.PENDING);

    assertEquals(1, result.size());
    assertEquals(PartitionStatus.PENDING, result.get(0).getStatus());
  }

  @Test
  void testReclaimStalePartitions() {
    UUID jobId = UUID.randomUUID();

    // Mock failing stale partitions exceeding retries
    when(partitionDAO.failStalePartitionsExceedingRetries(
            eq(jobId.toString()), anyLong(), anyInt(), anyLong()))
        .thenReturn(0);

    // Mock reclaiming partitions for retry
    when(partitionDAO.reclaimStalePartitionsForRetry(eq(jobId.toString()), anyLong(), anyInt()))
        .thenReturn(3);

    int reclaimed = coordinator.reclaimStalePartitions(jobId);

    assertEquals(3, reclaimed);
    verify(partitionDAO).reclaimStalePartitionsForRetry(eq(jobId.toString()), anyLong(), anyInt());
  }

  @Test
  void testReclaimStalePartitions_FailsExceededRetries() {
    UUID jobId = UUID.randomUUID();

    // Some partitions exceeded retry limit and should be marked failed
    when(partitionDAO.failStalePartitionsExceedingRetries(
            eq(jobId.toString()), anyLong(), anyInt(), anyLong()))
        .thenReturn(2);

    // Remaining partitions can be retried
    when(partitionDAO.reclaimStalePartitionsForRetry(eq(jobId.toString()), anyLong(), anyInt()))
        .thenReturn(1);

    // Mock job completion check
    when(jobDAO.findById(jobId.toString()))
        .thenReturn(
            new SearchIndexJobRecord(
                jobId.toString(),
                IndexJobStatus.RUNNING.name(),
                "{}",
                "staged_",
                10000,
                5000,
                4900,
                100,
                "{}",
                "admin",
                System.currentTimeMillis(),
                System.currentTimeMillis(),
                null,
                System.currentTimeMillis(),
                null));

    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.PENDING.name()))
        .thenReturn(List.of());
    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.PROCESSING.name()))
        .thenReturn(List.of());

    int reclaimed = coordinator.reclaimStalePartitions(jobId);

    assertEquals(1, reclaimed);
    verify(partitionDAO)
        .failStalePartitionsExceedingRetries(eq(jobId.toString()), anyLong(), anyInt(), anyLong());
  }

  @Test
  void testTryAcquireReindexLock_Success() {
    UUID jobId = UUID.randomUUID();
    when(lockDAO.tryAcquireLock(
            anyString(), eq(jobId.toString()), eq(TEST_SERVER_ID), anyLong(), anyLong()))
        .thenReturn(true);

    boolean result = coordinator.tryAcquireReindexLock(jobId);

    assertTrue(result);
  }

  @Test
  void testTryAcquireReindexLock_Failure() {
    UUID jobId = UUID.randomUUID();
    when(lockDAO.tryAcquireLock(
            anyString(), eq(jobId.toString()), eq(TEST_SERVER_ID), anyLong(), anyLong()))
        .thenReturn(false);

    boolean result = coordinator.tryAcquireReindexLock(jobId);

    assertFalse(result);
  }

  @Test
  void testReleaseReindexLock() {
    UUID jobId = UUID.randomUUID();
    doNothing().when(lockDAO).releaseLock(anyString(), eq(jobId.toString()));

    coordinator.releaseReindexLock(jobId);

    verify(lockDAO).releaseLock(anyString(), eq(jobId.toString()));
  }

  @Test
  void testRefreshReindexLock() {
    UUID jobId = UUID.randomUUID();
    when(lockDAO.refreshLock(
            anyString(), eq(jobId.toString()), eq(TEST_SERVER_ID), anyLong(), anyLong()))
        .thenReturn(true);

    boolean result = coordinator.refreshReindexLock(jobId);

    assertTrue(result);
  }

  @Test
  void testGetRecentJobs_WithStatuses() {
    List<SearchIndexJobRecord> records =
        List.of(createJobRecord(IndexJobStatus.RUNNING), createJobRecord(IndexJobStatus.READY));

    when(jobDAO.findByStatusesWithLimit(any(), eq(10))).thenReturn(records);

    List<SearchIndexJob> result =
        coordinator.getRecentJobs(List.of(IndexJobStatus.RUNNING, IndexJobStatus.READY), 10);

    assertEquals(2, result.size());
  }

  @Test
  void testGetRecentJobs_NoStatusFilter() {
    List<SearchIndexJobRecord> records =
        List.of(createJobRecord(IndexJobStatus.COMPLETED), createJobRecord(IndexJobStatus.RUNNING));

    when(jobDAO.listRecent(10)).thenReturn(records);

    List<SearchIndexJob> result = coordinator.getRecentJobs(null, 10);

    assertEquals(2, result.size());
  }

  @Test
  void testDeleteJob_Success() {
    UUID jobId = UUID.randomUUID();
    EventPublisherJob jobConfig = new EventPublisherJob().withEntities(Set.of("table"));

    SearchIndexJobRecord jobRecord =
        new SearchIndexJobRecord(
            jobId.toString(),
            IndexJobStatus.COMPLETED.name(), // Terminal state
            JsonUtils.pojoToJson(jobConfig),
            "staged_123_",
            10000,
            10000,
            9900,
            100,
            "{}",
            "admin",
            System.currentTimeMillis() - 60000,
            System.currentTimeMillis() - 50000,
            System.currentTimeMillis(),
            System.currentTimeMillis(),
            null);

    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);

    coordinator.deleteJob(jobId);

    verify(jobDAO).delete(jobId.toString());
  }

  @Test
  void testDeleteJob_NonTerminalState() {
    UUID jobId = UUID.randomUUID();
    EventPublisherJob jobConfig = new EventPublisherJob().withEntities(Set.of("table"));

    SearchIndexJobRecord jobRecord =
        new SearchIndexJobRecord(
            jobId.toString(),
            IndexJobStatus.RUNNING.name(), // Non-terminal state
            JsonUtils.pojoToJson(jobConfig),
            "staged_123_",
            10000,
            5000,
            4900,
            100,
            "{}",
            "admin",
            System.currentTimeMillis(),
            System.currentTimeMillis(),
            null,
            System.currentTimeMillis(),
            null);

    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);

    assertThrows(IllegalStateException.class, () -> coordinator.deleteJob(jobId));
    verify(jobDAO, never()).delete(anyString());
  }

  // Helper methods

  private SearchIndexPartitionRecord createPartitionRecord(
      UUID jobId, String entityType, int index, PartitionStatus status) {
    return new SearchIndexPartitionRecord(
        UUID.randomUUID().toString(),
        jobId.toString(),
        entityType,
        index,
        index * 5000L,
        (index + 1) * 5000L,
        5000,
        7500,
        50,
        status.name(),
        index * 5000L,
        status == PartitionStatus.COMPLETED ? 5000 : 0,
        status == PartitionStatus.COMPLETED ? 4900 : 0,
        status == PartitionStatus.COMPLETED ? 100 : 0,
        status == PartitionStatus.PROCESSING ? TEST_SERVER_ID : null,
        status == PartitionStatus.PROCESSING ? System.currentTimeMillis() : null,
        status == PartitionStatus.PROCESSING ? System.currentTimeMillis() : null,
        status == PartitionStatus.COMPLETED ? System.currentTimeMillis() : null,
        System.currentTimeMillis(),
        null,
        0);
  }

  private SearchIndexJobRecord createJobRecord(IndexJobStatus status) {
    EventPublisherJob jobConfig = new EventPublisherJob().withEntities(Set.of("table"));
    return new SearchIndexJobRecord(
        UUID.randomUUID().toString(),
        status.name(),
        JsonUtils.pojoToJson(jobConfig),
        "staged_123_",
        10000,
        status.ordinal() >= IndexJobStatus.COMPLETED.ordinal() ? 10000 : 5000,
        status.ordinal() >= IndexJobStatus.COMPLETED.ordinal() ? 9900 : 4900,
        status.ordinal() >= IndexJobStatus.COMPLETED.ordinal() ? 100 : 100,
        "{}",
        "admin",
        System.currentTimeMillis() - 60000,
        System.currentTimeMillis() - 50000,
        status.ordinal() >= IndexJobStatus.COMPLETED.ordinal() ? System.currentTimeMillis() : null,
        System.currentTimeMillis(),
        null);
  }
}
