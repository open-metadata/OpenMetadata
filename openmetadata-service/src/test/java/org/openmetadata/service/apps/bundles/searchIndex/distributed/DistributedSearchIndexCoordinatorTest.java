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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchIndexJobDAO;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchIndexJobDAO.SearchIndexJobRecord;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchIndexPartitionDAO;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchIndexPartitionDAO.AggregatedStatsRecord;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchIndexPartitionDAO.EntityStatsRecord;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchIndexPartitionDAO.SearchIndexPartitionRecord;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchReindexLockDAO;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DistributedSearchIndexCoordinatorTest {

  @Mock private CollectionDAO collectionDAO;
  @Mock private SearchIndexJobDAO jobDAO;
  @Mock private SearchIndexPartitionDAO partitionDAO;
  @Mock private SearchReindexLockDAO lockDAO;
  @Mock private CollectionDAO.SearchIndexServerStatsDAO serverStatsDAO;
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
    // getJobWithAggregatedStats now joins partition stats with per-stage timing pulled
    // from search_index_server_stats. Stub the DAO so the timing lookups return empty
    // collections — tests focused on count semantics don't need to assert timing.
    when(collectionDAO.searchIndexServerStatsDAO()).thenReturn(serverStatsDAO);
    when(serverStatsDAO.getStatsByEntityType(anyString())).thenReturn(java.util.List.of());
    when(serverStatsDAO.getStatsByServer(anyString())).thenReturn(java.util.List.of());

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

    when(partitionCalculator.getEntityCounts(entities, null))
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
            anyLong(),
            isNull()); // registrationDeadline (no longer used)
  }

  @Test
  void testGetCollectionDAO_ReturnsInjectedDAO() {
    assertSame(collectionDAO, coordinator.getCollectionDAO());
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
            null,
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
            null,
            System.currentTimeMillis() - 5000, // registrationDeadline (in past)
            2); // registeredServerCount

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

    when(partitionCalculator.calculatePartitions(jobId, entities, null)).thenReturn(mockPartitions);

    SearchIndexJob result = coordinator.initializePartitions(jobId);

    assertNotNull(result);
    assertEquals(IndexJobStatus.READY, result.getStatus());

    // Verify partitions were inserted with claimableAt
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
            anyLong(),
            anyLong()); // claimableAt

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
            null, // stagedIndexMapping
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
            null,
            System.currentTimeMillis() - 5000,
            2);

    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);

    assertThrows(IllegalStateException.class, () -> coordinator.initializePartitions(jobId));
  }

  @Test
  void testClaimNextPartition_Success() {
    UUID jobId = UUID.randomUUID();
    UUID partitionId = UUID.randomUUID();

    // Mock in-flight count below limit
    when(partitionDAO.countInFlightPartitions(jobId.toString(), TEST_SERVER_ID)).thenReturn(0);

    // Atomic claim succeeds
    when(partitionDAO.claimNextPartitionAtomic(eq(jobId.toString()), eq(TEST_SERVER_ID), anyLong()))
        .thenReturn(1);
    when(partitionDAO.findLatestClaimedPartition(
            eq(jobId.toString()), eq(TEST_SERVER_ID), anyLong()))
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
                0,
                0L)); // claimableAt

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

    // Mock in-flight count below limit
    when(partitionDAO.countInFlightPartitions(jobId.toString(), TEST_SERVER_ID)).thenReturn(0);

    // Atomic claim returns 0 (no partitions available)
    when(partitionDAO.claimNextPartitionAtomic(eq(jobId.toString()), eq(TEST_SERVER_ID), anyLong()))
        .thenReturn(0);

    Optional<SearchIndexPartition> result = coordinator.claimNextPartition(jobId);

    assertFalse(result.isPresent());
    verify(partitionDAO, never()).findLatestClaimedPartition(anyString(), anyString(), anyLong());
  }

  @Test
  void testClaimNextPartition_InFlightLimitReached() {
    UUID jobId = UUID.randomUUID();

    // Mock in-flight count at limit (5)
    when(partitionDAO.countInFlightPartitions(jobId.toString(), TEST_SERVER_ID)).thenReturn(5);

    Optional<SearchIndexPartition> result = coordinator.claimNextPartition(jobId);

    // Should not claim any partition when at the limit
    assertFalse(result.isPresent());
    // Should not even attempt to claim
    verify(partitionDAO, never()).claimNextPartitionAtomic(anyString(), anyString(), anyLong());
  }

  @Test
  void testClaimNextPartition_BelowInFlightLimit() {
    UUID jobId = UUID.randomUUID();
    UUID partitionId = UUID.randomUUID();

    // Mock in-flight count below limit
    when(partitionDAO.countInFlightPartitions(jobId.toString(), TEST_SERVER_ID)).thenReturn(2);

    when(partitionDAO.claimNextPartitionAtomic(eq(jobId.toString()), eq(TEST_SERVER_ID), anyLong()))
        .thenReturn(1);
    when(partitionDAO.findLatestClaimedPartition(
            eq(jobId.toString()), eq(TEST_SERVER_ID), anyLong()))
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
                0,
                0L)); // claimableAt

    Optional<SearchIndexPartition> result = coordinator.claimNextPartition(jobId);

    // Should successfully claim partition
    assertTrue(result.isPresent());
    assertEquals(partitionId, result.get().getId());
    verify(partitionDAO)
        .claimNextPartitionAtomic(eq(jobId.toString()), eq(TEST_SERVER_ID), anyLong());
  }

  @Test
  void testClaimNextPartition_AtomicClaimRaceCondition() {
    UUID jobId = UUID.randomUUID();

    // Mock in-flight count below limit
    when(partitionDAO.countInFlightPartitions(jobId.toString(), TEST_SERVER_ID)).thenReturn(0);

    // Atomic claim returns 0 - another server won the race
    when(partitionDAO.claimNextPartitionAtomic(eq(jobId.toString()), eq(TEST_SERVER_ID), anyLong()))
        .thenReturn(0);

    Optional<SearchIndexPartition> result = coordinator.claimNextPartition(jobId);

    // Should return empty - lost the race
    assertFalse(result.isPresent());
    // Should NOT call findLatestClaimedPartition since claim failed
    verify(partitionDAO, never()).findLatestClaimedPartition(anyString(), anyString(), anyLong());
  }

  @Test
  void testClaimNextPartition_JustBelowInFlightLimit() {
    UUID jobId = UUID.randomUUID();
    UUID partitionId = UUID.randomUUID();

    // Mock in-flight count at 4 (one below limit of 5)
    when(partitionDAO.countInFlightPartitions(jobId.toString(), TEST_SERVER_ID)).thenReturn(4);

    when(partitionDAO.claimNextPartitionAtomic(eq(jobId.toString()), eq(TEST_SERVER_ID), anyLong()))
        .thenReturn(1);
    when(partitionDAO.findLatestClaimedPartition(
            eq(jobId.toString()), eq(TEST_SERVER_ID), anyLong()))
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
                0,
                0L)); // claimableAt

    Optional<SearchIndexPartition> result = coordinator.claimNextPartition(jobId);

    // Should claim - just below in-flight limit
    assertTrue(result.isPresent());
    verify(partitionDAO)
        .claimNextPartitionAtomic(eq(jobId.toString()), eq(TEST_SERVER_ID), anyLong());
  }

  @Test
  void testClaimNextPartition_AboveInFlightLimit() {
    UUID jobId = UUID.randomUUID();

    // Mock in-flight count above limit (6)
    when(partitionDAO.countInFlightPartitions(jobId.toString(), TEST_SERVER_ID)).thenReturn(6);

    Optional<SearchIndexPartition> result = coordinator.claimNextPartition(jobId);

    // Should not claim - above in-flight limit
    assertFalse(result.isPresent());
    verify(partitionDAO, never()).claimNextPartitionAtomic(anyString(), anyString(), anyLong());
  }

  @Test
  void testUpdatePartitionProgress_UsesPartitionProgressValues() {
    SearchIndexPartition partition =
        SearchIndexPartition.builder()
            .id(UUID.randomUUID())
            .jobId(UUID.randomUUID())
            .entityType("table")
            .cursor(120L)
            .processedCount(100L)
            .successCount(95L)
            .failedCount(5L)
            .build();

    coordinator.updatePartitionProgress(partition);

    verify(partitionDAO)
        .updateProgress(
            eq(partition.getId().toString()), eq(120L), eq(100L), eq(95L), eq(5L), anyLong());
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
            0,
            0L); // claimableAt

    when(partitionDAO.findById(partitionId.toString())).thenReturn(record);
    when(partitionDAO.updateIfProcessing(
            eq(partitionId.toString()),
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

    // Mock that there are still pending partitions
    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.PENDING.name()))
        .thenReturn(List.of(mock(SearchIndexPartitionRecord.class)));

    coordinator.completePartition(partitionId, 4900, 100);

    // Verify partition was updated to COMPLETED via the status-guarded SQL — the unguarded
    // update() must NOT be called, so a late completion write can no longer overwrite a
    // CANCELLED row written by requestStop on another server.
    verify(partitionDAO)
        .updateIfProcessing(
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
    verify(partitionDAO, never())
        .update(
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
            anyInt());
  }

  @Test
  void testCompletePartition_NoOpWhenAlreadyCancelled() {
    UUID jobId = UUID.randomUUID();
    UUID partitionId = UUID.randomUUID();
    EntityCompletionTracker tracker = mock(EntityCompletionTracker.class);
    coordinator.setEntityCompletionTracker(tracker);

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
            0,
            0L);

    when(partitionDAO.findById(partitionId.toString())).thenReturn(record);
    // updateIfProcessing returns 0 — row is no longer PROCESSING (already CANCELLED by
    // requestStop). The completion writer must not advance the tracker and must not
    // touch job state, leaving STOPPED as the authoritative outcome.
    when(partitionDAO.updateIfProcessing(
            eq(partitionId.toString()),
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
        .thenReturn(0);

    coordinator.completePartition(partitionId, 4900, 100);

    verify(tracker, never()).recordPartitionComplete(anyString(), anyBoolean());
  }

  @Test
  void testCompletePartition_RecordsTrackerCompletion() {
    UUID jobId = UUID.randomUUID();
    UUID partitionId = UUID.randomUUID();
    EntityCompletionTracker tracker = mock(EntityCompletionTracker.class);
    coordinator.setEntityCompletionTracker(tracker);

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
            0,
            0L);

    when(partitionDAO.findById(partitionId.toString())).thenReturn(record);
    when(partitionDAO.updateIfProcessing(
            eq(partitionId.toString()),
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
    when(jobDAO.findById(jobId.toString()))
        .thenReturn(createJobRecord(jobId, IndexJobStatus.RUNNING, null, "{}"));
    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.PENDING.name()))
        .thenReturn(List.of(mock(SearchIndexPartitionRecord.class)));
    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.PROCESSING.name()))
        .thenReturn(List.of());
    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.FAILED.name()))
        .thenReturn(List.of());
    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.CANCELLED.name()))
        .thenReturn(List.of());

    coordinator.completePartition(partitionId, 5000, 0);

    verify(tracker).recordPartitionComplete("table", false);
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
            0, // retryCount = 0
            0L); // claimableAt

    when(partitionDAO.findById(partitionId.toString())).thenReturn(record);
    when(partitionDAO.updateIfProcessing(
            anyString(),
            anyString(),
            anyLong(),
            anyLong(),
            anyLong(),
            anyLong(),
            any(),
            any(),
            any(),
            any(),
            anyLong(),
            anyString(),
            anyInt()))
        .thenReturn(1);

    coordinator.failPartition(partitionId, "Connection timeout");

    // Verify partition was reset to PENDING for retry via the status-guarded SQL,
    // and the unguarded update() is never called (Stop must remain authoritative).
    ArgumentCaptor<String> statusCaptor = ArgumentCaptor.forClass(String.class);
    ArgumentCaptor<Integer> retryCaptor = ArgumentCaptor.forClass(Integer.class);

    verify(partitionDAO)
        .updateIfProcessing(
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
    verify(partitionDAO, never())
        .update(
            anyString(),
            anyString(),
            anyLong(),
            anyLong(),
            anyLong(),
            anyLong(),
            any(),
            any(),
            any(),
            any(),
            anyLong(),
            anyString(),
            anyInt());

    assertEquals(PartitionStatus.PENDING.name(), statusCaptor.getValue());
    assertEquals(1, retryCaptor.getValue()); // retryCount incremented
  }

  @Test
  void testFailPartition_NoOpWhenAlreadyCancelled() {
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
            0,
            0L);

    when(partitionDAO.findById(partitionId.toString())).thenReturn(record);
    // Simulate the row already being CANCELLED by requestStop on another server —
    // the guarded SQL matches zero rows.
    when(partitionDAO.updateIfProcessing(
            anyString(),
            anyString(),
            anyLong(),
            anyLong(),
            anyLong(),
            anyLong(),
            any(),
            any(),
            any(),
            any(),
            anyLong(),
            anyString(),
            anyInt()))
        .thenReturn(0);

    coordinator.failPartition(partitionId, "Connection timeout");

    // The unguarded update() must not be called — that's what would resurrect a CANCELLED row.
    verify(partitionDAO, never())
        .update(
            anyString(),
            anyString(),
            anyLong(),
            anyLong(),
            anyLong(),
            anyLong(),
            any(),
            any(),
            any(),
            any(),
            anyLong(),
            anyString(),
            anyInt());
    // No job-completion check should run — the cancellation already drove that path.
    verify(jobDAO, never())
        .update(
            anyString(),
            anyString(),
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
            3, // retryCount = 3 (max)
            0L); // claimableAt

    when(partitionDAO.findById(partitionId.toString())).thenReturn(record);

    // Mock for job completion check
    EventPublisherJob jobConfig = new EventPublisherJob().withEntities(Set.of("table"));
    SearchIndexJobRecord jobRecord =
        new SearchIndexJobRecord(
            jobId.toString(),
            IndexJobStatus.RUNNING.name(),
            JsonUtils.pojoToJson(jobConfig),
            "staged_123_",
            null, // stagedIndexMapping
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
            null,
            System.currentTimeMillis() - 55000,
            2);
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
            anyString(),
            anyInt()))
        .thenReturn(1);

    coordinator.failPartition(partitionId, "Connection timeout");

    // Verify partition was marked as FAILED via the status-guarded SQL,
    // and the unguarded update() is never called.
    verify(partitionDAO)
        .updateIfProcessing(
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
    verify(partitionDAO, never())
        .update(
            anyString(),
            anyString(),
            anyLong(),
            anyLong(),
            anyLong(),
            anyLong(),
            any(),
            any(),
            any(),
            any(),
            anyLong(),
            anyString(),
            anyInt());
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
            null, // stagedIndexMapping
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
            null,
            System.currentTimeMillis() - 5000,
            2);

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
            null, // stagedIndexMapping
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
            null,
            System.currentTimeMillis() - 5000,
            2);

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
            null, // stagedIndexMapping
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
            null,
            System.currentTimeMillis() - 55000,
            2);

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

    // Both PENDING and PROCESSING partitions must be cancelled — leaving PROCESSING orphaned
    // means workerExecutor.shutdownNow() kills the threads but the rows stay PROCESSING in
    // the DB, so checkAndUpdateJobCompletion (which requires processing.isEmpty()) never
    // flips STOPPING → STOPPED and the strategy's monitor loop polls forever.
    verify(partitionDAO).cancelInFlightPartitions(eq(jobId.toString()), anyLong());
    verify(partitionDAO, never()).cancelPendingPartitions(jobId.toString());
  }

  /**
   * Regression test for the user-visible "stop button does nothing" bug. Reproduces the exact
   * production scenario: distributed reindex running with PROCESSING partitions, user clicks
   * Stop. Without this fix the job would stay in STOPPING forever because
   * checkAndUpdateJobCompletion requires processing.isEmpty() and PROCESSING rows were never
   * cancelled. With the fix, requestStop cancels in-flight partitions AND drives the state
   * machine forward in the same call, so the job transitions to STOPPED before requestStop
   * returns.
   */
  @Test
  void testRequestStop_ProcessingPartitionsTransitionToStopped() {
    UUID jobId = UUID.randomUUID();
    EventPublisherJob jobConfig = new EventPublisherJob().withEntities(Set.of("table"));

    SearchIndexJobRecord runningJob =
        new SearchIndexJobRecord(
            jobId.toString(),
            IndexJobStatus.RUNNING.name(),
            JsonUtils.pojoToJson(jobConfig),
            "staged_123_",
            null,
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
            null,
            System.currentTimeMillis() - 55000,
            2);

    SearchIndexJobRecord stoppingJob =
        new SearchIndexJobRecord(
            runningJob.id(),
            IndexJobStatus.STOPPING.name(),
            runningJob.jobConfiguration(),
            runningJob.targetIndexPrefix(),
            runningJob.stagedIndexMapping(),
            runningJob.totalRecords(),
            runningJob.processedRecords(),
            runningJob.successRecords(),
            runningJob.failedRecords(),
            runningJob.stats(),
            runningJob.createdBy(),
            runningJob.createdAt(),
            runningJob.startedAt(),
            runningJob.completedAt(),
            System.currentTimeMillis(),
            runningJob.errorMessage(),
            runningJob.registrationDeadline(),
            runningJob.registeredServerCount());

    // First findById returns RUNNING (entry into requestStop). After the STOPPING write,
    // checkAndUpdateJobCompletion's findById should see STOPPING.
    when(jobDAO.findById(jobId.toString())).thenReturn(runningJob, stoppingJob);

    // Critical: cancelInFlightPartitions empties both PENDING and PROCESSING. The
    // post-cancel partition lists are all empty, so checkAndUpdateJobCompletion's
    // pending.isEmpty() && processing.isEmpty() check passes and STOPPING → STOPPED fires.
    when(partitionDAO.cancelInFlightPartitions(eq(jobId.toString()), anyLong())).thenReturn(3);
    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.PENDING.name()))
        .thenReturn(List.of());
    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.PROCESSING.name()))
        .thenReturn(List.of());
    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.FAILED.name()))
        .thenReturn(List.of());
    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.CANCELLED.name()))
        .thenReturn(List.of());

    coordinator.requestStop(jobId);

    // STOPPING write happens first.
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

    // STOPPED write happens before requestStop returns — driven by the in-call
    // checkAndUpdateJobCompletion. Without the fix this never fires because PROCESSING
    // rows were never cleaned up and the state machine couldn't advance.
    verify(jobDAO)
        .update(
            eq(jobId.toString()),
            eq(IndexJobStatus.STOPPED.name()),
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
  void testCheckAndUpdateJobCompletion_EvictsPartitionStartCursorsCache() throws Exception {
    UUID jobId = UUID.randomUUID();

    // Seed the per-jobId cursor cache directly. Going through precomputePartitionStartCursors
    // would require real EntityRepository wiring — testing the eviction contract is the
    // point here, not the population path.
    java.lang.reflect.Field cacheField =
        DistributedSearchIndexCoordinator.class.getDeclaredField("partitionStartCursors");
    cacheField.setAccessible(true);
    @SuppressWarnings("unchecked")
    Map<UUID, Map<String, Map<Long, String>>> cache =
        (Map<UUID, Map<String, Map<Long, String>>>) cacheField.get(coordinator);
    Map<String, Map<Long, String>> entityCursors = new HashMap<>();
    entityCursors.put("table", Map.of(10000L, "encoded-cursor-blob"));
    cache.put(jobId, entityCursors);

    assertNotNull(
        coordinator.getPartitionStartCursor(jobId, "table", 10000L),
        "Cache should hold the seeded cursor before terminal transition");

    // RUNNING job with no remaining partitions — checkAndUpdateJobCompletion should
    // promote it to COMPLETED and evict the cache entry.
    EventPublisherJob jobConfig = new EventPublisherJob().withEntities(Set.of("table"));
    SearchIndexJobRecord runningJob =
        new SearchIndexJobRecord(
            jobId.toString(),
            IndexJobStatus.RUNNING.name(),
            JsonUtils.pojoToJson(jobConfig),
            "staged_",
            null,
            100,
            100,
            100,
            0,
            "{}",
            "admin",
            System.currentTimeMillis() - 60000,
            System.currentTimeMillis() - 50000,
            null,
            System.currentTimeMillis(),
            null,
            System.currentTimeMillis() - 55000,
            1);
    when(jobDAO.findById(jobId.toString())).thenReturn(runningJob);
    when(partitionDAO.findByJobIdAndStatus(eq(jobId.toString()), anyString()))
        .thenReturn(List.of());
    when(partitionDAO.getAggregatedStats(jobId.toString()))
        .thenReturn(new AggregatedStatsRecord(100, 100, 100, 0, 1, 1, 0, 0, 0));

    coordinator.checkAndUpdateJobCompletion(jobId);

    assertNull(
        coordinator.getPartitionStartCursor(jobId, "table", 10000L),
        "Cache should be evicted once the job reaches a terminal state — long-running"
            + " servers must not retain cursor blobs across many reindex runs.");
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
            null, // stagedIndexMapping
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
            null,
            System.currentTimeMillis() - 5000,
            2);

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
            null, // stagedIndexMapping
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
            null,
            System.currentTimeMillis() - 5000,
            2);

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
                null, // stagedIndexMapping
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
                null,
                System.currentTimeMillis() - 5000,
                2));

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
  void testTryAcquireReindexLock_ExceptionReturnsFalse() {
    UUID jobId = UUID.randomUUID();
    when(lockDAO.tryAcquireLock(
            anyString(), eq(jobId.toString()), eq(TEST_SERVER_ID), anyLong(), anyLong()))
        .thenThrow(new IllegalStateException("lock store unavailable"));

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
  void testTransferReindexLock_Success() {
    UUID fromJobId = UUID.randomUUID();
    UUID toJobId = UUID.randomUUID();
    when(lockDAO.transferLock(
            anyString(),
            eq(fromJobId.toString()),
            eq(toJobId.toString()),
            eq(TEST_SERVER_ID),
            anyLong(),
            anyLong()))
        .thenReturn(true);

    boolean result = coordinator.transferReindexLock(fromJobId, toJobId);

    assertTrue(result);
  }

  @Test
  void testTransferReindexLock_Failure() {
    UUID fromJobId = UUID.randomUUID();
    UUID toJobId = UUID.randomUUID();
    when(lockDAO.transferLock(
            anyString(),
            eq(fromJobId.toString()),
            eq(toJobId.toString()),
            eq(TEST_SERVER_ID),
            anyLong(),
            anyLong()))
        .thenReturn(false);

    boolean result = coordinator.transferReindexLock(fromJobId, toJobId);

    assertFalse(result);
  }

  @Test
  void testGetParticipatingServers_ReturnsAssignedServers() {
    UUID jobId = UUID.randomUUID();
    when(partitionDAO.getAssignedServers(jobId.toString()))
        .thenReturn(List.of("server-a", "server-b"));

    List<String> result = coordinator.getParticipatingServers(jobId);

    assertEquals(List.of("server-a", "server-b"), result);
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
  void testUpdateStagedIndexMapping_SerializesMapping() {
    UUID jobId = UUID.randomUUID();
    Map<String, String> stagedMapping = Map.of("table", "staged_table");
    ArgumentCaptor<String> mappingCaptor = ArgumentCaptor.forClass(String.class);

    coordinator.updateStagedIndexMapping(jobId, stagedMapping);

    verify(jobDAO)
        .updateStagedIndexMapping(eq(jobId.toString()), mappingCaptor.capture(), anyLong());
    assertEquals(stagedMapping, JsonUtils.readValue(mappingCaptor.getValue(), Map.class));
  }

  @Test
  void testUpdateStagedIndexMapping_AllowsNullMapping() {
    UUID jobId = UUID.randomUUID();

    coordinator.updateStagedIndexMapping(jobId, null);

    verify(jobDAO).updateStagedIndexMapping(eq(jobId.toString()), isNull(), anyLong());
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
            null, // stagedIndexMapping
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
            null,
            System.currentTimeMillis() - 55000,
            2);

    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);

    coordinator.deleteJob(jobId);

    verify(jobDAO).delete(jobId.toString());
  }

  @Test
  void testDeleteJob_NotFound() {
    UUID jobId = UUID.randomUUID();
    when(jobDAO.findById(jobId.toString())).thenReturn(null);

    coordinator.deleteJob(jobId);

    verify(jobDAO, never()).delete(anyString());
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
            null, // stagedIndexMapping
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
            null,
            System.currentTimeMillis() - 5000,
            2);

    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);

    assertThrows(IllegalStateException.class, () -> coordinator.deleteJob(jobId));
    verify(jobDAO, never()).delete(anyString());
  }

  @Test
  void testGetJobWithAggregatedStats_PreservesStagedMappingAndBuildsServerStats() {
    UUID jobId = UUID.randomUUID();
    Map<String, String> stagedMapping = Map.of("table", "staged_table");
    EventPublisherJob jobConfig = new EventPublisherJob().withEntities(Set.of("table"));

    SearchIndexJobRecord jobRecord =
        createJobRecord(
            jobId,
            IndexJobStatus.RUNNING,
            JsonUtils.pojoToJson(stagedMapping),
            JsonUtils.pojoToJson(
                Map.of(
                    "table",
                    Map.of(
                        "entityType",
                        "table",
                        "totalRecords",
                        10,
                        "processedRecords",
                        0,
                        "successRecords",
                        0,
                        "failedRecords",
                        0,
                        "totalPartitions",
                        1,
                        "completedPartitions",
                        0,
                        "failedPartitions",
                        0))));
    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);
    when(partitionDAO.getAggregatedStats(jobId.toString()))
        .thenReturn(new AggregatedStatsRecord(10, 7, 6, 1, 1, 1, 0, 0, 0));
    when(partitionDAO.getEntityStats(jobId.toString()))
        .thenReturn(List.of(new EntityStatsRecord("table", 10, 7, 6, 1, 1, 1, 0)));
    when(partitionDAO.getServerStats(jobId.toString()))
        .thenReturn(
            List.of(
                new CollectionDAO.SearchIndexPartitionDAO.ServerStatsRecord(
                    TEST_SERVER_ID, 7, 6, 1, 1, 1, 0)));

    SearchIndexJob result = coordinator.getJobWithAggregatedStats(jobId);

    assertEquals(stagedMapping, result.getStagedIndexMapping());
    assertNotNull(result.getServerStats());
    assertEquals(1, result.getServerStats().size());
    assertEquals(7, result.getServerStats().get(TEST_SERVER_ID).getProcessedRecords());
    assertEquals(6, result.getSuccessRecords());
    assertEquals(1, result.getFailedRecords());
  }

  @Test
  void testForceCompleteProcessingPartitions_CancelsInFlightPartitions() {
    UUID jobId = UUID.randomUUID();
    List<SearchIndexPartitionRecord> processing =
        List.of(
            createPartitionRecord(jobId, "table", 0, PartitionStatus.PROCESSING),
            createPartitionRecord(jobId, "user", 1, PartitionStatus.PROCESSING));
    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.PROCESSING.name()))
        .thenReturn(processing);

    coordinator.forceCompleteProcessingPartitions(jobId);

    verify(partitionDAO, times(2))
        .update(
            anyString(),
            eq(PartitionStatus.CANCELLED.name()),
            anyLong(),
            anyLong(),
            anyLong(),
            anyLong(),
            any(),
            any(),
            any(),
            anyLong(),
            anyLong(),
            eq("Force-cancelled during job stop"),
            anyInt());
  }

  @Test
  void testForceCompleteProcessingPartitions_NoInFlightPartitions() {
    UUID jobId = UUID.randomUUID();
    when(partitionDAO.findByJobIdAndStatus(jobId.toString(), PartitionStatus.PROCESSING.name()))
        .thenReturn(List.of());

    coordinator.forceCompleteProcessingPartitions(jobId);

    verify(partitionDAO, never())
        .update(
            anyString(),
            anyString(),
            anyLong(),
            anyLong(),
            anyLong(),
            anyLong(),
            any(),
            any(),
            any(),
            any(),
            anyLong(),
            any(),
            anyInt());
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
        0,
        0L); // claimableAt
  }

  private SearchIndexJobRecord createJobRecord(IndexJobStatus status) {
    return createJobRecord(UUID.randomUUID(), status, null, "{}");
  }

  private SearchIndexJobRecord createJobRecord(
      UUID jobId, IndexJobStatus status, String stagedIndexMapping, String statsJson) {
    EventPublisherJob jobConfig = new EventPublisherJob().withEntities(Set.of("table"));
    return new SearchIndexJobRecord(
        jobId.toString(),
        status.name(),
        JsonUtils.pojoToJson(jobConfig),
        "staged_123_",
        stagedIndexMapping,
        10000,
        status.ordinal() >= IndexJobStatus.COMPLETED.ordinal() ? 10000 : 5000,
        status.ordinal() >= IndexJobStatus.COMPLETED.ordinal() ? 9900 : 4900,
        100,
        statsJson,
        "admin",
        System.currentTimeMillis() - 60000,
        System.currentTimeMillis() - 50000,
        status.ordinal() >= IndexJobStatus.COMPLETED.ordinal() ? System.currentTimeMillis() : null,
        System.currentTimeMillis(),
        null,
        System.currentTimeMillis() - 55000, // registrationDeadline (in past)
        2); // registeredServerCount
  }

  // ==================== Server Tracking Tests ====================

  @Test
  void testGetParticipatingServers() {
    UUID jobId = UUID.randomUUID();

    when(partitionDAO.getAssignedServers(jobId.toString()))
        .thenReturn(List.of("server-1", "server-2", "server-3"));

    List<String> servers = coordinator.getParticipatingServers(jobId);

    assertEquals(3, servers.size());
    assertTrue(servers.contains("server-1"));
    assertTrue(servers.contains("server-2"));
    assertTrue(servers.contains("server-3"));
  }
}
