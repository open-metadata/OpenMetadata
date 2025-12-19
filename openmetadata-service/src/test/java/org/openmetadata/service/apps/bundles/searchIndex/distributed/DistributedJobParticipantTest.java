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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedConstruction;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.service.apps.bundles.searchIndex.BulkSink;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DistributedJobParticipantTest {

  @Mock private CollectionDAO collectionDAO;
  @Mock private SearchRepository searchRepository;
  @Mock private BulkSink bulkSink;

  private DistributedJobParticipant participant;

  @BeforeEach
  void setUp() {
    // Default setup - individual tests may override
  }

  @AfterEach
  void tearDown() {
    if (participant != null) {
      participant.stop();
    }
  }

  @Test
  void testStartAndStop() {
    participant = new DistributedJobParticipant(collectionDAO, searchRepository, "test-server-1");

    // Initially not participating
    assertFalse(participant.isParticipating());
    assertNull(participant.getCurrentJobId());

    // Start the participant
    participant.start();

    // Stop the participant
    participant.stop();

    // Should not be participating after stop
    assertFalse(participant.isParticipating());
  }

  @Test
  void testMultipleStartCallsAreIdempotent() {
    participant = new DistributedJobParticipant(collectionDAO, searchRepository, "test-server-1");

    participant.start();
    participant.start(); // Second call should be no-op
    participant.start(); // Third call should be no-op

    // Should still work normally
    assertFalse(participant.isParticipating());

    participant.stop();
  }

  @Test
  void testMultipleStopCallsAreIdempotent() {
    participant = new DistributedJobParticipant(collectionDAO, searchRepository, "test-server-1");

    participant.start();
    participant.stop();
    participant.stop(); // Second call should be no-op
    participant.stop(); // Third call should be no-op

    // Should not throw or cause issues
    assertFalse(participant.isParticipating());
  }

  @Test
  void testDoesNotJoinWhenNoRunningJobs() throws Exception {
    // Create coordinator mock that returns no running jobs
    DistributedSearchIndexCoordinator mockCoordinator =
        mock(DistributedSearchIndexCoordinator.class);
    when(mockCoordinator.getRecentJobs(any(), anyInt())).thenReturn(List.of());

    try (MockedConstruction<DistributedSearchIndexCoordinator> mocked =
        mockConstruction(
            DistributedSearchIndexCoordinator.class,
            (mock, context) -> {
              when(mock.getRecentJobs(any(), anyInt())).thenReturn(List.of());
            })) {

      participant = new DistributedJobParticipant(collectionDAO, searchRepository, "test-server-1");
      participant.start();

      // Wait a bit for the scheduler to run at least once
      Thread.sleep(6000);

      // Should not be participating
      assertFalse(participant.isParticipating());
      assertNull(participant.getCurrentJobId());
    }
  }

  @Test
  void testJoinsActiveJobWithPendingPartitions() throws Exception {
    UUID jobId = UUID.randomUUID();
    UUID partitionId = UUID.randomUUID();

    EventPublisherJob config = new EventPublisherJob();
    config.setEntities(Set.of("table"));
    config.setBatchSize(100);
    config.setMaxConcurrentRequests(10);
    config.setPayLoadSize(1000000L);

    SearchIndexJob runningJob =
        SearchIndexJob.builder()
            .id(jobId)
            .status(IndexJobStatus.RUNNING)
            .jobConfiguration(config)
            .totalRecords(100)
            .build();

    SearchIndexJob completedJob =
        SearchIndexJob.builder()
            .id(jobId)
            .status(IndexJobStatus.COMPLETED)
            .jobConfiguration(config)
            .totalRecords(100)
            .processedRecords(100)
            .successRecords(100)
            .build();

    SearchIndexPartition pendingPartition =
        SearchIndexPartition.builder()
            .id(partitionId)
            .jobId(jobId)
            .entityType("table")
            .partitionIndex(0)
            .rangeStart(0)
            .rangeEnd(100)
            .status(PartitionStatus.PENDING)
            .build();

    when(searchRepository.createBulkSink(anyInt(), anyInt(), anyLong())).thenReturn(bulkSink);

    try (MockedConstruction<DistributedSearchIndexCoordinator> mocked =
        mockConstruction(
            DistributedSearchIndexCoordinator.class,
            (mock, context) -> {
              // First call finds running job, then no running jobs
              when(mock.getRecentJobs(eq(List.of(IndexJobStatus.RUNNING)), eq(1)))
                  .thenReturn(List.of(runningJob))
                  .thenReturn(List.of());

              // Has pending partitions initially
              when(mock.getPartitions(eq(jobId), eq(PartitionStatus.PENDING)))
                  .thenReturn(List.of(pendingPartition))
                  .thenReturn(List.of());

              // Job check returns running then completed
              when(mock.getJob(eq(jobId)))
                  .thenReturn(Optional.of(runningJob))
                  .thenReturn(Optional.of(completedJob));

              // No partition to claim (simulating all taken by other servers)
              when(mock.claimNextPartition(eq(jobId))).thenReturn(Optional.empty());
            })) {

      participant = new DistributedJobParticipant(collectionDAO, searchRepository, "test-server-1");
      participant.start();

      // Wait for the participant to detect and attempt to join the job
      Awaitility.await()
          .atMost(15, TimeUnit.SECONDS)
          .until(() -> participant.getCurrentJobId() != null);

      assertEquals(jobId, participant.getCurrentJobId());
    }
  }

  @Test
  void testDoesNotRejoinSameRunningJob() throws Exception {
    UUID jobId = UUID.randomUUID();

    EventPublisherJob config = new EventPublisherJob();
    config.setEntities(Set.of("table"));
    config.setBatchSize(100);

    SearchIndexJob runningJob =
        SearchIndexJob.builder()
            .id(jobId)
            .status(IndexJobStatus.RUNNING)
            .jobConfiguration(config)
            .totalRecords(100)
            .build();

    SearchIndexPartition pendingPartition =
        SearchIndexPartition.builder()
            .id(UUID.randomUUID())
            .jobId(jobId)
            .entityType("table")
            .partitionIndex(0)
            .status(PartitionStatus.PENDING)
            .build();

    when(searchRepository.createBulkSink(anyInt(), anyInt(), anyLong())).thenReturn(bulkSink);

    try (MockedConstruction<DistributedSearchIndexCoordinator> mocked =
        mockConstruction(
            DistributedSearchIndexCoordinator.class,
            (mock, context) -> {
              // Always returns the same running job
              when(mock.getRecentJobs(eq(List.of(IndexJobStatus.RUNNING)), eq(1)))
                  .thenReturn(List.of(runningJob));

              // Has pending partitions
              when(mock.getPartitions(eq(jobId), eq(PartitionStatus.PENDING)))
                  .thenReturn(List.of(pendingPartition));

              // Job is still running
              when(mock.getJob(eq(jobId))).thenReturn(Optional.of(runningJob));

              // No partition to claim
              when(mock.claimNextPartition(eq(jobId))).thenReturn(Optional.empty());
            })) {

      participant = new DistributedJobParticipant(collectionDAO, searchRepository, "test-server-1");
      participant.start();

      // Wait for first join attempt
      Awaitility.await()
          .atMost(15, TimeUnit.SECONDS)
          .until(() -> participant.getCurrentJobId() != null);

      UUID firstJobId = participant.getCurrentJobId();
      assertEquals(jobId, firstJobId);

      // Wait for more scheduler cycles
      Thread.sleep(10000);

      // Same job ID should still be remembered, participant not re-joining repeatedly
      assertEquals(jobId, participant.getCurrentJobId());

      // Verify that getRecentJobs was called multiple times but participant logic
      // prevented re-joining (check via participating flag or job ID stability)
      DistributedSearchIndexCoordinator constructedMock = mocked.constructed().get(0);
      verify(constructedMock, atLeastOnce())
          .getRecentJobs(eq(List.of(IndexJobStatus.RUNNING)), eq(1));
    }
  }

  @Test
  void testClearsJobIdWhenJobCompletes() throws Exception {
    UUID jobId = UUID.randomUUID();

    EventPublisherJob config = new EventPublisherJob();
    config.setEntities(Set.of("table"));
    config.setBatchSize(100);

    SearchIndexJob runningJob =
        SearchIndexJob.builder()
            .id(jobId)
            .status(IndexJobStatus.RUNNING)
            .jobConfiguration(config)
            .totalRecords(100)
            .build();

    SearchIndexJob completedJob =
        SearchIndexJob.builder()
            .id(jobId)
            .status(IndexJobStatus.COMPLETED)
            .jobConfiguration(config)
            .totalRecords(100)
            .processedRecords(100)
            .successRecords(100)
            .build();

    SearchIndexPartition pendingPartition =
        SearchIndexPartition.builder()
            .id(UUID.randomUUID())
            .jobId(jobId)
            .entityType("table")
            .partitionIndex(0)
            .status(PartitionStatus.PENDING)
            .build();

    when(searchRepository.createBulkSink(anyInt(), anyInt(), anyLong())).thenReturn(bulkSink);

    try (MockedConstruction<DistributedSearchIndexCoordinator> mocked =
        mockConstruction(
            DistributedSearchIndexCoordinator.class,
            (mock, context) -> {
              // First returns running, then returns running again (same job)
              when(mock.getRecentJobs(eq(List.of(IndexJobStatus.RUNNING)), eq(1)))
                  .thenReturn(List.of(runningJob))
                  .thenReturn(List.of(runningJob))
                  .thenReturn(List.of()); // No more running jobs

              // Has pending partitions initially
              when(mock.getPartitions(eq(jobId), eq(PartitionStatus.PENDING)))
                  .thenReturn(List.of(pendingPartition))
                  .thenReturn(List.of());

              // Job transitions to completed
              when(mock.getJob(eq(jobId)))
                  .thenReturn(Optional.of(runningJob))
                  .thenReturn(Optional.of(completedJob));

              // No partition to claim
              when(mock.claimNextPartition(eq(jobId))).thenReturn(Optional.empty());
            })) {

      participant = new DistributedJobParticipant(collectionDAO, searchRepository, "test-server-1");
      participant.start();

      // Wait for join
      Awaitility.await()
          .atMost(15, TimeUnit.SECONDS)
          .until(() -> participant.getCurrentJobId() != null);

      assertTrue(participant.getCurrentJobId() != null);

      // Wait for job to be detected as completed
      Awaitility.await().atMost(20, TimeUnit.SECONDS).until(() -> !participant.isParticipating());
    }
  }

  @Test
  void testAttemptsToClaimPartitions() throws Exception {
    UUID jobId = UUID.randomUUID();
    UUID partitionId = UUID.randomUUID();

    EventPublisherJob config = new EventPublisherJob();
    config.setEntities(Set.of("table"));
    config.setBatchSize(100);
    config.setMaxConcurrentRequests(10);
    config.setPayLoadSize(1000000L);

    SearchIndexJob runningJob =
        SearchIndexJob.builder()
            .id(jobId)
            .status(IndexJobStatus.RUNNING)
            .jobConfiguration(config)
            .totalRecords(100)
            .build();

    SearchIndexJob completedJob =
        SearchIndexJob.builder()
            .id(jobId)
            .status(IndexJobStatus.COMPLETED)
            .jobConfiguration(config)
            .totalRecords(100)
            .processedRecords(100)
            .successRecords(100)
            .build();

    SearchIndexPartition partition =
        SearchIndexPartition.builder()
            .id(partitionId)
            .jobId(jobId)
            .entityType("table")
            .partitionIndex(0)
            .rangeStart(0)
            .rangeEnd(100)
            .status(PartitionStatus.PENDING)
            .build();

    when(searchRepository.createBulkSink(anyInt(), anyInt(), anyLong())).thenReturn(bulkSink);

    try (MockedConstruction<DistributedSearchIndexCoordinator> coordinatorMocked =
        mockConstruction(
            DistributedSearchIndexCoordinator.class,
            (mock, context) -> {
              when(mock.getRecentJobs(eq(List.of(IndexJobStatus.RUNNING)), eq(1)))
                  .thenReturn(List.of(runningJob))
                  .thenReturn(List.of());

              when(mock.getPartitions(eq(jobId), eq(PartitionStatus.PENDING)))
                  .thenReturn(List.of(partition))
                  .thenReturn(List.of());

              // Job transitions to completed
              when(mock.getJob(eq(jobId)))
                  .thenReturn(Optional.of(runningJob))
                  .thenReturn(Optional.of(completedJob));

              // No partition available to claim
              when(mock.claimNextPartition(eq(jobId))).thenReturn(Optional.empty());
            })) {

      participant = new DistributedJobParticipant(collectionDAO, searchRepository, "test-server-1");
      participant.start();

      // Wait for participant to detect and join job
      Awaitility.await()
          .atMost(15, TimeUnit.SECONDS)
          .until(() -> participant.getCurrentJobId() != null);

      // Verify the coordinator was called to claim partition
      DistributedSearchIndexCoordinator constructedMock = coordinatorMocked.constructed().get(0);
      Awaitility.await()
          .atMost(10, TimeUnit.SECONDS)
          .untilAsserted(
              () -> verify(constructedMock, atLeastOnce()).claimNextPartition(eq(jobId)));
    }
  }
}
