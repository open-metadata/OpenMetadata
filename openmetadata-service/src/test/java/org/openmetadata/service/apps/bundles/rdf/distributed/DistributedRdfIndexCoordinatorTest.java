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
import org.openmetadata.service.apps.bundles.searchIndex.distributed.ServerIdentityResolver;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.RdfIndexJobDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.RdfIndexJobDAO.RdfIndexJobRecord;
import org.openmetadata.service.jdbi3.CollectionDAO.RdfIndexPartitionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.RdfIndexPartitionDAO.RdfAggregatedStatsRecord;

@ExtendWith(MockitoExtension.class)
class DistributedRdfIndexCoordinatorTest {

  private static final String TEST_SERVER_ID = "rdf-test-server";

  @Mock private CollectionDAO collectionDAO;
  @Mock private RdfIndexJobDAO jobDAO;
  @Mock private RdfIndexPartitionDAO partitionDAO;
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
}
