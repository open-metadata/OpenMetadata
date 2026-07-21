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

package org.openmetadata.service.apps.bundles.rdf.distributed;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
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
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.IndexJobStatus;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.PartitionStatus;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.ServerIdentityResolver;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.RdfIndexJobDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.RdfIndexJobDAO.RdfIndexJobRecord;
import org.openmetadata.service.jdbi3.CollectionDAO.RdfIndexPartitionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.RdfIndexPartitionDAO.RdfAggregatedStatsRecord;
import org.openmetadata.service.jdbi3.CollectionDAO.RdfIndexPartitionDAO.RdfIndexPartitionRecord;
import org.openmetadata.service.jdbi3.CollectionDAO.RdfIndexServerStatsDAO;

@ExtendWith(MockitoExtension.class)
class DistributedRdfIndexCoordinatorTest {

  private static final String TEST_SERVER_ID = "rdf-test-server";

  @Mock private CollectionDAO collectionDAO;
  @Mock private RdfIndexJobDAO jobDAO;
  @Mock private RdfIndexPartitionDAO partitionDAO;
  @Mock private RdfIndexServerStatsDAO serverStatsDAO;
  @Mock private RdfPartitionCalculator partitionCalculator;

  private DistributedRdfIndexCoordinator coordinator;
  private MockedStatic<ServerIdentityResolver> serverIdentityMock;

  @BeforeEach
  void setUp() {
    ServerIdentityResolver resolver = mock(ServerIdentityResolver.class);
    when(resolver.getServerId()).thenReturn(TEST_SERVER_ID);

    serverIdentityMock = mockStatic(ServerIdentityResolver.class);
    serverIdentityMock.when(ServerIdentityResolver::getInstance).thenReturn(resolver);

    lenient().when(collectionDAO.rdfIndexJobDAO()).thenReturn(jobDAO);
    lenient().when(collectionDAO.rdfIndexPartitionDAO()).thenReturn(partitionDAO);
    lenient().when(collectionDAO.rdfIndexServerStatsDAO()).thenReturn(serverStatsDAO);

    coordinator = new DistributedRdfIndexCoordinator(collectionDAO, partitionCalculator);
  }

  @AfterEach
  void tearDown() {
    if (serverIdentityMock != null) {
      serverIdentityMock.close();
    }
  }

  @Test
  void getJobWithAggregatedStatsKeepsCompletedAtNullForNonTerminalJob() {
    UUID jobId = UUID.randomUUID();
    EventPublisherJob jobConfiguration = new EventPublisherJob().withEntities(Set.of("table"));
    RdfIndexJobRecord jobRecord =
        new RdfIndexJobRecord(
            jobId.toString(),
            IndexJobStatus.READY.name(),
            JsonUtils.pojoToJson(jobConfiguration),
            25L,
            0L,
            0L,
            0L,
            JsonUtils.pojoToJson(
                Map.of(
                    "table",
                    RdfIndexJob.EntityTypeStats.builder()
                        .entityType("table")
                        .totalRecords(25)
                        .build())),
            "admin",
            System.currentTimeMillis(),
            null,
            null,
            System.currentTimeMillis(),
            null);

    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);
    when(partitionDAO.getAggregatedStats(jobId.toString()))
        .thenReturn(new RdfAggregatedStatsRecord(25L, 0L, 0L, 0L, 1, 0, 0, 1, 0));
    when(partitionDAO.getEntityStats(jobId.toString()))
        .thenReturn(
            List.of(
                new CollectionDAO.RdfIndexPartitionDAO.RdfEntityStatsRecord(
                    "table", 25L, 0L, 0L, 0L, 1, 0, 0)));
    when(partitionDAO.getServerStats(jobId.toString())).thenReturn(List.of());

    RdfIndexJob refreshed = coordinator.getJobWithAggregatedStats(jobId);

    assertEquals(IndexJobStatus.RUNNING, refreshed.getStatus());
    assertNull(refreshed.getCompletedAt());

    verify(jobDAO)
        .update(
            eq(jobId.toString()),
            eq(IndexJobStatus.RUNNING.name()),
            eq(0L),
            eq(0L),
            eq(0L),
            anyString(),
            isNull(),
            isNull(),
            anyLong(),
            isNull());
  }

  @Test
  void getJobWithAggregatedStatsPreservesCompletedAtForTerminalJob() {
    UUID jobId = UUID.randomUUID();
    long completedAt = System.currentTimeMillis() - 5000;
    EventPublisherJob jobConfiguration = new EventPublisherJob().withEntities(Set.of("table"));
    RdfIndexJobRecord jobRecord =
        new RdfIndexJobRecord(
            jobId.toString(),
            IndexJobStatus.RUNNING.name(),
            JsonUtils.pojoToJson(jobConfiguration),
            25L,
            25L,
            25L,
            0L,
            JsonUtils.pojoToJson(
                Map.of(
                    "table",
                    RdfIndexJob.EntityTypeStats.builder()
                        .entityType("table")
                        .totalRecords(25)
                        .build())),
            "admin",
            System.currentTimeMillis(),
            System.currentTimeMillis() - 10000,
            completedAt,
            System.currentTimeMillis(),
            null);

    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);
    when(partitionDAO.getAggregatedStats(jobId.toString()))
        .thenReturn(new RdfAggregatedStatsRecord(25L, 25L, 25L, 0L, 1, 1, 0, 0, 0));
    when(partitionDAO.getEntityStats(jobId.toString()))
        .thenReturn(
            List.of(
                new CollectionDAO.RdfIndexPartitionDAO.RdfEntityStatsRecord(
                    "table", 25L, 25L, 25L, 0L, 1, 1, 0)));
    when(partitionDAO.getServerStats(jobId.toString())).thenReturn(List.of());

    RdfIndexJob refreshed = coordinator.getJobWithAggregatedStats(jobId);

    assertEquals(IndexJobStatus.COMPLETED, refreshed.getStatus());
    assertEquals(completedAt, refreshed.getCompletedAt());

    verify(jobDAO)
        .update(
            eq(jobId.toString()),
            eq(IndexJobStatus.COMPLETED.name()),
            eq(25L),
            eq(25L),
            eq(0L),
            anyString(),
            eq(jobRecord.startedAt()),
            eq(completedAt),
            anyLong(),
            isNull());
  }

  @Test
  void getJobWithAggregatedStatsSetsCompletedAtWhenTerminalJobWasPreviouslyUnset() {
    UUID jobId = UUID.randomUUID();
    EventPublisherJob jobConfiguration = new EventPublisherJob().withEntities(Set.of("table"));
    RdfIndexJobRecord jobRecord =
        new RdfIndexJobRecord(
            jobId.toString(),
            IndexJobStatus.RUNNING.name(),
            JsonUtils.pojoToJson(jobConfiguration),
            25L,
            25L,
            25L,
            0L,
            JsonUtils.pojoToJson(
                Map.of(
                    "table",
                    RdfIndexJob.EntityTypeStats.builder()
                        .entityType("table")
                        .totalRecords(25)
                        .build())),
            "admin",
            System.currentTimeMillis(),
            System.currentTimeMillis() - 10000,
            null,
            System.currentTimeMillis(),
            null);

    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);
    when(partitionDAO.getAggregatedStats(jobId.toString()))
        .thenReturn(new RdfAggregatedStatsRecord(25L, 25L, 25L, 0L, 1, 1, 0, 0, 0));
    when(partitionDAO.getEntityStats(jobId.toString()))
        .thenReturn(
            List.of(
                new CollectionDAO.RdfIndexPartitionDAO.RdfEntityStatsRecord(
                    "table", 25L, 25L, 25L, 0L, 1, 1, 0)));
    when(partitionDAO.getServerStats(jobId.toString())).thenReturn(List.of());

    RdfIndexJob refreshed = coordinator.getJobWithAggregatedStats(jobId);

    assertEquals(IndexJobStatus.COMPLETED, refreshed.getStatus());
    assertNotNull(refreshed.getCompletedAt());

    ArgumentCaptor<Long> completedAtCaptor = ArgumentCaptor.forClass(Long.class);
    verify(jobDAO)
        .update(
            eq(jobId.toString()),
            eq(IndexJobStatus.COMPLETED.name()),
            eq(25L),
            eq(25L),
            eq(0L),
            anyString(),
            eq(jobRecord.startedAt()),
            completedAtCaptor.capture(),
            anyLong(),
            isNull());

    assertNotNull(completedAtCaptor.getValue());
    assertEquals(completedAtCaptor.getValue(), refreshed.getCompletedAt());
  }

  @Test
  void claimNextPartitionUsesUniqueMillisecondTimestamps() {
    UUID jobId = UUID.randomUUID();
    when(partitionDAO.claimNextPartitionAtomic(eq(jobId.toString()), eq(TEST_SERVER_ID), anyLong()))
        .thenReturn(1);
    when(partitionDAO.findLatestClaimedPartition(
            eq(jobId.toString()), eq(TEST_SERVER_ID), anyLong()))
        .thenAnswer(
            invocation ->
                new CollectionDAO.RdfIndexPartitionDAO.RdfIndexPartitionRecord(
                    UUID.randomUUID().toString(),
                    jobId.toString(),
                    "table",
                    0,
                    0L,
                    100L,
                    100L,
                    100L,
                    1,
                    "PROCESSING",
                    0L,
                    0L,
                    0L,
                    0L,
                    TEST_SERVER_ID,
                    invocation.getArgument(2, Long.class),
                    invocation.getArgument(2, Long.class),
                    null,
                    invocation.getArgument(2, Long.class),
                    null,
                    0,
                    0L));

    coordinator.claimNextPartition(jobId);
    coordinator.claimNextPartition(jobId);

    ArgumentCaptor<Long> claimTimes = ArgumentCaptor.forClass(Long.class);
    verify(partitionDAO, times(2))
        .claimNextPartitionAtomic(eq(jobId.toString()), eq(TEST_SERVER_ID), claimTimes.capture());

    List<Long> capturedTimes = claimTimes.getAllValues();
    assertEquals(2, capturedTimes.size());
    assertNotEquals(capturedTimes.get(0), capturedTimes.get(1));
    assertTrue(capturedTimes.get(1) > capturedTimes.get(0));
  }

  @Test
  void updateJobStatusPreservesExistingCompletedAt() {
    UUID jobId = UUID.randomUUID();
    long completedAt = System.currentTimeMillis() - 5000;
    EventPublisherJob jobConfiguration = new EventPublisherJob().withEntities(Set.of("table"));
    RdfIndexJobRecord jobRecord =
        new RdfIndexJobRecord(
            jobId.toString(),
            IndexJobStatus.RUNNING.name(),
            JsonUtils.pojoToJson(jobConfiguration),
            25L,
            25L,
            25L,
            0L,
            JsonUtils.pojoToJson(Map.of()),
            "admin",
            System.currentTimeMillis(),
            System.currentTimeMillis() - 10000,
            completedAt,
            System.currentTimeMillis(),
            null);

    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);

    coordinator.updateJobStatus(jobId, IndexJobStatus.COMPLETED, null);

    verify(jobDAO)
        .update(
            eq(jobId.toString()),
            eq(IndexJobStatus.COMPLETED.name()),
            eq(25L),
            eq(25L),
            eq(0L),
            anyString(),
            eq(jobRecord.startedAt()),
            eq(completedAt),
            anyLong(),
            isNull());
  }

  @Test
  void hasClaimableWorkUsesCountQueries() {
    UUID jobId = UUID.randomUUID();
    EventPublisherJob jobConfiguration = new EventPublisherJob().withEntities(Set.of("table"));
    RdfIndexJobRecord jobRecord =
        new RdfIndexJobRecord(
            jobId.toString(),
            IndexJobStatus.READY.name(),
            JsonUtils.pojoToJson(jobConfiguration),
            25L,
            0L,
            0L,
            0L,
            JsonUtils.pojoToJson(Map.of()),
            "admin",
            System.currentTimeMillis(),
            null,
            null,
            System.currentTimeMillis(),
            null);

    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);
    when(partitionDAO.getAggregatedStats(jobId.toString()))
        .thenReturn(new RdfAggregatedStatsRecord(25L, 0L, 0L, 0L, 1, 0, 0, 1, 0));
    when(partitionDAO.getEntityStats(jobId.toString())).thenReturn(List.of());
    when(partitionDAO.getServerStats(jobId.toString())).thenReturn(List.of());
    when(partitionDAO.countPendingPartitions(jobId.toString())).thenReturn(0);
    when(partitionDAO.countInFlightPartitions(jobId.toString())).thenReturn(1);

    assertTrue(coordinator.hasClaimableWork(jobId));

    verify(partitionDAO).countPendingPartitions(jobId.toString());
    verify(partitionDAO).countInFlightPartitions(jobId.toString());
    verify(partitionDAO, never()).findByJobId(jobId.toString());
  }

  @Test
  void hasClaimableWorkReturnsFalseWhenNoClaimableOrInflightPartitionsExist() {
    UUID jobId = UUID.randomUUID();
    EventPublisherJob jobConfiguration = new EventPublisherJob().withEntities(Set.of("table"));
    RdfIndexJobRecord jobRecord =
        new RdfIndexJobRecord(
            jobId.toString(),
            IndexJobStatus.READY.name(),
            JsonUtils.pojoToJson(jobConfiguration),
            25L,
            0L,
            0L,
            0L,
            JsonUtils.pojoToJson(Map.of()),
            "admin",
            System.currentTimeMillis(),
            null,
            null,
            System.currentTimeMillis(),
            null);

    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord);
    when(partitionDAO.getAggregatedStats(jobId.toString()))
        .thenReturn(new RdfAggregatedStatsRecord(25L, 0L, 0L, 0L, 1, 0, 0, 1, 0));
    when(partitionDAO.getEntityStats(jobId.toString())).thenReturn(List.of());
    when(partitionDAO.getServerStats(jobId.toString())).thenReturn(List.of());
    when(partitionDAO.countPendingPartitions(jobId.toString())).thenReturn(0);
    when(partitionDAO.countInFlightPartitions(jobId.toString())).thenReturn(0);

    assertFalse(coordinator.hasClaimableWork(jobId));
  }

  @Test
  @SuppressWarnings("unchecked")
  void getPartitionStartCursorReturnsCachedValue() throws Exception {
    UUID jobId = UUID.randomUUID();
    java.lang.reflect.Field cacheField =
        DistributedRdfIndexCoordinator.class.getDeclaredField("partitionStartCursors");
    cacheField.setAccessible(true);
    Map<UUID, Map<String, Map<Long, String>>> cache =
        (Map<UUID, Map<String, Map<Long, String>>>) cacheField.get(coordinator);
    Map<Long, String> cursors = new java.util.HashMap<>();
    cursors.put(100L, "encoded-cursor-100");
    cursors.put(200L, "encoded-cursor-200");
    Map<String, Map<Long, String>> entityMap = new java.util.HashMap<>();
    entityMap.put("table", cursors);
    cache.put(jobId, entityMap);

    assertEquals("encoded-cursor-100", coordinator.getPartitionStartCursor(jobId, "table", 100L));
    assertEquals("encoded-cursor-200", coordinator.getPartitionStartCursor(jobId, "table", 200L));
    assertNull(coordinator.getPartitionStartCursor(jobId, "table", 999L));
    assertNull(coordinator.getPartitionStartCursor(jobId, "dashboard", 100L));
    assertNull(coordinator.getPartitionStartCursor(UUID.randomUUID(), "table", 100L));
    assertNull(coordinator.getPartitionStartCursor(jobId, "table", 0L));
    assertNull(coordinator.getPartitionStartCursor(null, "table", 100L));
  }

  @Test
  void cancelInFlightPartitionsDelegatesToDao() {
    when(partitionDAO.cancelInFlightPartitions(anyString(), anyLong())).thenReturn(7);
    int cancelled = coordinator.cancelInFlightPartitions(UUID.randomUUID());
    assertEquals(7, cancelled);
    verify(partitionDAO, times(1)).cancelInFlightPartitions(anyString(), anyLong());
  }

  @Test
  void claimNextPartitionRespectsInFlightBackpressure() {
    when(partitionDAO.countInFlightPartitionsForServer(anyString(), eq(TEST_SERVER_ID)))
        .thenReturn(5);

    assertNull(coordinator.claimNextPartition(UUID.randomUUID(), TEST_SERVER_ID));
    verify(partitionDAO, never()).claimNextPartitionAtomic(anyString(), anyString(), anyLong());
  }

  @Test
  void claimNextPartitionProceedsWhenUnderInFlightCap() {
    when(partitionDAO.countInFlightPartitionsForServer(anyString(), eq(TEST_SERVER_ID)))
        .thenReturn(2);
    when(partitionDAO.claimNextPartitionAtomic(anyString(), anyString(), anyLong())).thenReturn(0);

    coordinator.claimNextPartition(UUID.randomUUID(), TEST_SERVER_ID);
    verify(partitionDAO, times(1))
        .claimNextPartitionAtomic(anyString(), eq(TEST_SERVER_ID), anyLong());
  }

  @Test
  void checkAndUpdateJobCompletionReturnsEarlyWhenPendingPartitionsRemain() {
    UUID jobId = UUID.randomUUID();
    stubNonTerminalRefresh(jobId, IndexJobStatus.RUNNING, 0L);
    when(partitionDAO.countPartitionsByStatus(jobId.toString(), PartitionStatus.PENDING.name()))
        .thenReturn(2);
    when(partitionDAO.countPartitionsByStatus(jobId.toString(), PartitionStatus.PROCESSING.name()))
        .thenReturn(0);

    coordinator.checkAndUpdateJobCompletion(jobId);

    verify(partitionDAO, never())
        .countPartitionsByStatus(jobId.toString(), PartitionStatus.FAILED.name());
    verify(jobDAO, never())
        .update(
            anyString(),
            eq(IndexJobStatus.COMPLETED.name()),
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
  void checkAndUpdateJobCompletionReturnsEarlyWhenProcessingPartitionsRemain() {
    UUID jobId = UUID.randomUUID();
    stubNonTerminalRefresh(jobId, IndexJobStatus.RUNNING, 0L);
    when(partitionDAO.countPartitionsByStatus(jobId.toString(), PartitionStatus.PENDING.name()))
        .thenReturn(0);
    when(partitionDAO.countPartitionsByStatus(jobId.toString(), PartitionStatus.PROCESSING.name()))
        .thenReturn(3);

    coordinator.checkAndUpdateJobCompletion(jobId);

    verify(partitionDAO, never())
        .countPartitionsByStatus(jobId.toString(), PartitionStatus.FAILED.name());
  }

  @Test
  void checkAndUpdateJobCompletionIsNoOpWhenJobAlreadyTerminal() {
    UUID jobId = UUID.randomUUID();
    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord(jobId, IndexJobStatus.COMPLETED));
    when(partitionDAO.getAggregatedStats(jobId.toString()))
        .thenReturn(new RdfAggregatedStatsRecord(25L, 25L, 25L, 0L, 1, 1, 0, 0, 0));
    when(partitionDAO.getEntityStats(jobId.toString())).thenReturn(List.of());
    when(partitionDAO.getServerStats(jobId.toString())).thenReturn(List.of());
    when(partitionDAO.findRecentPartitionErrors(jobId.toString(), 1)).thenReturn(List.of());

    coordinator.checkAndUpdateJobCompletion(jobId);

    verify(partitionDAO, never())
        .countPartitionsByStatus(anyString(), eq(PartitionStatus.PENDING.name()));
  }

  @Test
  void checkAndUpdateJobCompletionStoppingWithAllDonePromotesToStoppedNotCompleted() {
    UUID jobId = UUID.randomUUID();
    stubNonTerminalRefresh(jobId, IndexJobStatus.STOPPING, 0L);
    stubAllPartitionsSettled(jobId, 0, 0);
    when(partitionDAO.findRecentPartitionErrors(jobId.toString(), 1)).thenReturn(List.of());

    coordinator.checkAndUpdateJobCompletion(jobId);

    verifyTerminalStatusWritten(jobId, IndexJobStatus.STOPPED);
    verify(jobDAO, never())
        .update(
            anyString(),
            eq(IndexJobStatus.COMPLETED.name()),
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
  void checkAndUpdateJobCompletionCleanRunPromotesToCompleted() {
    UUID jobId = UUID.randomUUID();
    stubNonTerminalRefresh(jobId, IndexJobStatus.RUNNING, 0L);
    stubAllPartitionsSettled(jobId, 0, 0);
    when(partitionDAO.findRecentPartitionErrors(jobId.toString(), 1)).thenReturn(List.of());

    coordinator.checkAndUpdateJobCompletion(jobId);

    verifyTerminalStatusWritten(jobId, IndexJobStatus.COMPLETED);
  }

  @Test
  void checkAndUpdateJobCompletionFailedPartitionsPromoteToCompletedWithErrors() {
    UUID jobId = UUID.randomUUID();
    stubNonTerminalRefresh(jobId, IndexJobStatus.RUNNING, 0L);
    stubAllPartitionsSettled(jobId, 1, 0);
    when(partitionDAO.findRecentPartitionErrors(jobId.toString(), 1)).thenReturn(List.of());

    coordinator.checkAndUpdateJobCompletion(jobId);

    verifyTerminalStatusWritten(jobId, IndexJobStatus.COMPLETED_WITH_ERRORS);
  }

  @Test
  void checkAndUpdateJobCompletionCancelledPartitionsPromoteToCompletedWithErrors() {
    UUID jobId = UUID.randomUUID();
    stubNonTerminalRefresh(jobId, IndexJobStatus.RUNNING, 0L);
    stubAllPartitionsSettled(jobId, 0, 1);
    when(partitionDAO.findRecentPartitionErrors(jobId.toString(), 1)).thenReturn(List.of());

    coordinator.checkAndUpdateJobCompletion(jobId);

    verifyTerminalStatusWritten(jobId, IndexJobStatus.COMPLETED_WITH_ERRORS);
  }

  @Test
  void checkAndUpdateJobCompletionFailedRecordsPromoteToCompletedWithErrors() {
    UUID jobId = UUID.randomUUID();
    stubNonTerminalRefresh(jobId, IndexJobStatus.RUNNING, 4L);
    stubAllPartitionsSettled(jobId, 0, 0);
    when(partitionDAO.findRecentPartitionErrors(jobId.toString(), 1)).thenReturn(List.of());

    coordinator.checkAndUpdateJobCompletion(jobId);

    verifyTerminalStatusWritten(jobId, IndexJobStatus.COMPLETED_WITH_ERRORS);
  }

  @Test
  void checkAndUpdateJobCompletionPartitionLastErrorPromotesToCompletedWithErrors() {
    UUID jobId = UUID.randomUUID();
    stubNonTerminalRefresh(jobId, IndexJobStatus.RUNNING, 0L);
    stubAllPartitionsSettled(jobId, 0, 0);
    when(partitionDAO.findRecentPartitionErrors(jobId.toString(), 1))
        .thenReturn(List.of("fuseki write failed"));
    when(partitionDAO.findRecentPartitionErrors(jobId.toString(), 5))
        .thenReturn(List.of("fuseki write failed"));

    coordinator.checkAndUpdateJobCompletion(jobId);

    ArgumentCaptor<String> errorCaptor = captureTerminalErrorMessage(jobId);
    assertEquals("Partition errors: fuseki write failed", errorCaptor.getValue());
  }

  @Test
  void checkAndUpdateJobCompletionSynthesizedErrorMessageIsTruncatedAtMaxLength() {
    UUID jobId = UUID.randomUUID();
    stubNonTerminalRefresh(jobId, IndexJobStatus.RUNNING, 0L);
    stubAllPartitionsSettled(jobId, 0, 0);
    String hugeError = "e".repeat(5000);
    when(partitionDAO.findRecentPartitionErrors(jobId.toString(), 1)).thenReturn(List.of("marker"));
    when(partitionDAO.findRecentPartitionErrors(jobId.toString(), 5))
        .thenReturn(List.of(hugeError));

    coordinator.checkAndUpdateJobCompletion(jobId);

    ArgumentCaptor<String> errorCaptor = captureTerminalErrorMessage(jobId);
    String errorMessage = errorCaptor.getValue();
    assertEquals(4003, errorMessage.length());
    assertTrue(errorMessage.startsWith("Partition errors: "));
    assertTrue(errorMessage.endsWith("..."));
  }

  @Test
  void failPartitionBumpsRetryCountByOneViaUpdateIfProcessing() {
    UUID partitionId = UUID.randomUUID();
    UUID jobId = UUID.randomUUID();
    when(partitionDAO.findById(partitionId.toString()))
        .thenReturn(partitionRecord(partitionId, jobId, PartitionStatus.PROCESSING.name(), 2));
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
            any(),
            any(),
            anyInt()))
        .thenReturn(1);

    coordinator.failPartition(partitionId, 10L, 5L, 3L, 2L, "boom");

    ArgumentCaptor<Integer> retryCaptor = ArgumentCaptor.forClass(Integer.class);
    verify(partitionDAO)
        .updateIfProcessing(
            eq(partitionId.toString()),
            eq(PartitionStatus.FAILED.name()),
            anyLong(),
            anyLong(),
            anyLong(),
            anyLong(),
            any(),
            any(),
            any(),
            any(),
            any(),
            any(),
            retryCaptor.capture());
    assertEquals(3, retryCaptor.getValue());
  }

  @Test
  void failPartitionSkipsStatsWhenNoLongerProcessing() {
    UUID partitionId = UUID.randomUUID();
    UUID jobId = UUID.randomUUID();
    when(partitionDAO.findById(partitionId.toString()))
        .thenReturn(partitionRecord(partitionId, jobId, PartitionStatus.PROCESSING.name(), 0));
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
            any(),
            any(),
            anyInt()))
        .thenReturn(0);

    coordinator.failPartition(partitionId, 10L, 5L, 3L, 2L, "boom");

    verify(serverStatsDAO, never())
        .incrementStats(
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            anyLong(),
            anyLong(),
            anyLong(),
            anyInt(),
            anyInt(),
            anyLong());
    verify(jobDAO, never()).findById(jobId.toString());
  }

  @Test
  void failPartitionIncrementsFailedPartitionStatOnSuccess() {
    UUID partitionId = UUID.randomUUID();
    UUID jobId = UUID.randomUUID();
    when(partitionDAO.findById(partitionId.toString()))
        .thenReturn(partitionRecord(partitionId, jobId, PartitionStatus.PROCESSING.name(), 0));
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
            any(),
            any(),
            anyInt()))
        .thenReturn(1);

    coordinator.failPartition(partitionId, 10L, 5L, 3L, 2L, "boom");

    verify(serverStatsDAO)
        .incrementStats(
            anyString(),
            eq(jobId.toString()),
            eq(TEST_SERVER_ID),
            eq("table"),
            eq(5L),
            eq(3L),
            eq(2L),
            eq(0),
            eq(1),
            anyLong());
  }

  @Test
  void completePartitionSkipsStatsWhenNoLongerProcessing() {
    UUID partitionId = UUID.randomUUID();
    UUID jobId = UUID.randomUUID();
    when(partitionDAO.findById(partitionId.toString()))
        .thenReturn(partitionRecord(partitionId, jobId, PartitionStatus.PROCESSING.name(), 0));
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
            any(),
            any(),
            anyInt()))
        .thenReturn(0);

    coordinator.completePartition(partitionId, 10L, 5L, 5L, 0L, null);

    verify(serverStatsDAO, never())
        .incrementStats(
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            anyLong(),
            anyLong(),
            anyLong(),
            anyInt(),
            anyInt(),
            anyLong());
  }

  @Test
  void completePartitionIncrementsCompletedPartitionStatOnSuccess() {
    UUID partitionId = UUID.randomUUID();
    UUID jobId = UUID.randomUUID();
    when(partitionDAO.findById(partitionId.toString()))
        .thenReturn(partitionRecord(partitionId, jobId, PartitionStatus.PROCESSING.name(), 2));
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
            any(),
            any(),
            anyInt()))
        .thenReturn(1);

    coordinator.completePartition(partitionId, 10L, 5L, 5L, 0L, null);

    verify(serverStatsDAO)
        .incrementStats(
            anyString(),
            eq(jobId.toString()),
            eq(TEST_SERVER_ID),
            eq("table"),
            eq(5L),
            eq(5L),
            eq(0L),
            eq(1),
            eq(0),
            anyLong());
  }

  @Test
  void completePartitionKeepsRetryCountUnchanged() {
    UUID partitionId = UUID.randomUUID();
    UUID jobId = UUID.randomUUID();
    when(partitionDAO.findById(partitionId.toString()))
        .thenReturn(partitionRecord(partitionId, jobId, PartitionStatus.PROCESSING.name(), 2));
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
            any(),
            any(),
            anyInt()))
        .thenReturn(1);

    coordinator.completePartition(partitionId, 10L, 5L, 5L, 0L, null);

    ArgumentCaptor<Integer> retryCaptor = ArgumentCaptor.forClass(Integer.class);
    verify(partitionDAO)
        .updateIfProcessing(
            eq(partitionId.toString()),
            eq(PartitionStatus.COMPLETED.name()),
            anyLong(),
            anyLong(),
            anyLong(),
            anyLong(),
            any(),
            any(),
            any(),
            any(),
            any(),
            any(),
            retryCaptor.capture());
    assertEquals(2, retryCaptor.getValue());
  }

  @Test
  void reclaimStalePartitionsPassesMaxRetriesAndAggregatesCounts() {
    UUID jobId = UUID.randomUUID();
    when(partitionDAO.reclaimStalePartitionsForRetry(eq(jobId.toString()), anyLong(), eq(3)))
        .thenReturn(2);
    when(partitionDAO.failStalePartitionsExceedingRetries(
            eq(jobId.toString()), anyLong(), eq(3), anyLong()))
        .thenReturn(1);

    int recovered = coordinator.reclaimStalePartitions(jobId);

    assertEquals(3, recovered);
    verify(partitionDAO).reclaimStalePartitionsForRetry(eq(jobId.toString()), anyLong(), eq(3));
    verify(partitionDAO)
        .failStalePartitionsExceedingRetries(eq(jobId.toString()), anyLong(), eq(3), anyLong());
    verify(jobDAO).findById(jobId.toString());
  }

  @Test
  void reclaimStalePartitionsReturnsReclaimedWhenNoneExceedRetries() {
    UUID jobId = UUID.randomUUID();
    when(partitionDAO.reclaimStalePartitionsForRetry(eq(jobId.toString()), anyLong(), eq(3)))
        .thenReturn(5);
    when(partitionDAO.failStalePartitionsExceedingRetries(
            eq(jobId.toString()), anyLong(), eq(3), anyLong()))
        .thenReturn(0);

    assertEquals(5, coordinator.reclaimStalePartitions(jobId));
    verify(jobDAO).findById(jobId.toString());
  }

  @Test
  void reclaimStalePartitionsSkipsRefreshWhenNothingRecovered() {
    UUID jobId = UUID.randomUUID();
    when(partitionDAO.reclaimStalePartitionsForRetry(eq(jobId.toString()), anyLong(), eq(3)))
        .thenReturn(0);
    when(partitionDAO.failStalePartitionsExceedingRetries(
            eq(jobId.toString()), anyLong(), eq(3), anyLong()))
        .thenReturn(0);

    assertEquals(0, coordinator.reclaimStalePartitions(jobId));
    verify(jobDAO, never()).findById(jobId.toString());
  }

  private RdfIndexJobRecord jobRecord(UUID jobId, IndexJobStatus status) {
    EventPublisherJob jobConfiguration = new EventPublisherJob().withEntities(Set.of("table"));
    return new RdfIndexJobRecord(
        jobId.toString(),
        status.name(),
        JsonUtils.pojoToJson(jobConfiguration),
        25L,
        0L,
        0L,
        0L,
        JsonUtils.pojoToJson(Map.of()),
        "admin",
        System.currentTimeMillis(),
        null,
        null,
        System.currentTimeMillis(),
        null);
  }

  private void stubNonTerminalRefresh(UUID jobId, IndexJobStatus status, long failedRecords) {
    when(jobDAO.findById(jobId.toString())).thenReturn(jobRecord(jobId, status));
    when(partitionDAO.getAggregatedStats(jobId.toString()))
        .thenReturn(new RdfAggregatedStatsRecord(25L, 0L, 0L, failedRecords, 1, 0, 0, 1, 0));
    when(partitionDAO.getEntityStats(jobId.toString())).thenReturn(List.of());
    when(partitionDAO.getServerStats(jobId.toString())).thenReturn(List.of());
  }

  private void stubAllPartitionsSettled(UUID jobId, int failed, int cancelled) {
    when(partitionDAO.countPartitionsByStatus(jobId.toString(), PartitionStatus.PENDING.name()))
        .thenReturn(0);
    when(partitionDAO.countPartitionsByStatus(jobId.toString(), PartitionStatus.PROCESSING.name()))
        .thenReturn(0);
    when(partitionDAO.countPartitionsByStatus(jobId.toString(), PartitionStatus.FAILED.name()))
        .thenReturn(failed);
    when(partitionDAO.countPartitionsByStatus(jobId.toString(), PartitionStatus.CANCELLED.name()))
        .thenReturn(cancelled);
  }

  private void verifyTerminalStatusWritten(UUID jobId, IndexJobStatus status) {
    verify(jobDAO)
        .update(
            eq(jobId.toString()),
            eq(status.name()),
            anyLong(),
            anyLong(),
            anyLong(),
            anyString(),
            any(),
            any(),
            anyLong(),
            any());
  }

  private ArgumentCaptor<String> captureTerminalErrorMessage(UUID jobId) {
    ArgumentCaptor<String> errorCaptor = ArgumentCaptor.forClass(String.class);
    verify(jobDAO)
        .update(
            eq(jobId.toString()),
            eq(IndexJobStatus.COMPLETED_WITH_ERRORS.name()),
            anyLong(),
            anyLong(),
            anyLong(),
            anyString(),
            any(),
            any(),
            anyLong(),
            errorCaptor.capture());
    return errorCaptor;
  }

  private RdfIndexPartitionRecord partitionRecord(
      UUID partitionId, UUID jobId, String status, int retryCount) {
    return new RdfIndexPartitionRecord(
        partitionId.toString(),
        jobId.toString(),
        "table",
        0,
        0L,
        100L,
        100L,
        100L,
        1,
        status,
        0L,
        0L,
        0L,
        0L,
        TEST_SERVER_ID,
        1000L,
        2000L,
        null,
        3000L,
        null,
        retryCount,
        0L);
  }
}
