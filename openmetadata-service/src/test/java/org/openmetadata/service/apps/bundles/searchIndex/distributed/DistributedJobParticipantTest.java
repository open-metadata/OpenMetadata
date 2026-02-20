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
import java.util.function.Consumer;
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
import org.openmetadata.service.cache.CacheConfig;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DistributedJobParticipantTest {

  @Mock private CollectionDAO collectionDAO;
  @Mock private CollectionDAO.SearchIndexJobDAO jobDAO;
  @Mock private SearchRepository searchRepository;
  @Mock private BulkSink bulkSink;

  private DistributedJobParticipant participant;
  private TestJobNotifier testNotifier;

  @BeforeEach
  void setUp() {
    // Set up default mock for job DAO (used by PollingJobNotifier)
    when(collectionDAO.searchIndexJobDAO()).thenReturn(jobDAO);
    when(jobDAO.getRunningJobIds()).thenReturn(List.of());
    // Create a test notifier that allows manual triggering
    testNotifier = new TestJobNotifier();
  }

  /** A test notifier that allows manual triggering of job notifications */
  static class TestJobNotifier implements DistributedJobNotifier {
    private Consumer<UUID> callback;
    private boolean running = false;

    @Override
    public void notifyJobStarted(UUID jobId, String jobType) {}

    @Override
    public void notifyJobCompleted(UUID jobId) {}

    @Override
    public void onJobStarted(Consumer<UUID> callback) {
      this.callback = callback;
    }

    @Override
    public void start() {
      this.running = true;
    }

    @Override
    public void stop() {
      this.running = false;
    }

    @Override
    public boolean isRunning() {
      return running;
    }

    @Override
    public String getType() {
      return "test";
    }

    /** Manually trigger job discovery for testing */
    public void triggerJobDiscovered(UUID jobId) {
      if (callback != null) {
        callback.accept(jobId);
      }
    }
  }

  @AfterEach
  void tearDown() {
    if (participant != null) {
      participant.stop();
    }
  }

  @Test
  void testStartAndStop() {
    participant =
        new DistributedJobParticipant(
            collectionDAO, searchRepository, "test-server-1", (CacheConfig) null);

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
    participant =
        new DistributedJobParticipant(
            collectionDAO, searchRepository, "test-server-1", (CacheConfig) null);

    participant.start();
    participant.start(); // Second call should be no-op
    participant.start(); // Third call should be no-op

    // Should still work normally
    assertFalse(participant.isParticipating());

    participant.stop();
  }

  @Test
  void testMultipleStopCallsAreIdempotent() {
    participant =
        new DistributedJobParticipant(
            collectionDAO, searchRepository, "test-server-1", (CacheConfig) null);

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

      participant =
          new DistributedJobParticipant(
              collectionDAO, searchRepository, "test-server-1", (CacheConfig) null);
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

    // Create a processing partition to simulate work in progress
    SearchIndexPartition processingPartition =
        SearchIndexPartition.builder()
            .id(UUID.randomUUID())
            .jobId(jobId)
            .entityType("table")
            .partitionIndex(1)
            .status(PartitionStatus.PROCESSING)
            .build();

    try (MockedConstruction<DistributedSearchIndexCoordinator> mocked =
        mockConstruction(
            DistributedSearchIndexCoordinator.class,
            (mock, context) -> {
              // Has pending partitions in onJobDiscovered, then empty in loop
              when(mock.getPartitions(eq(jobId), eq(PartitionStatus.PENDING)))
                  .thenReturn(List.of(pendingPartition)) // onJobDiscovered check
                  .thenReturn(List.of()); // processing loop checks

              // Processing partitions - first call shows work in progress (causes 1s delay)
              // This gives the test time to observe currentJobId before it's cleared
              when(mock.getPartitions(eq(jobId), eq(PartitionStatus.PROCESSING)))
                  .thenReturn(List.of(processingPartition)) // loop iteration 1: wait
                  .thenReturn(List.of()); // loop iteration 2: done

              // Job stays running for multiple checks
              when(mock.getJob(eq(jobId)))
                  .thenReturn(Optional.of(runningJob)) // onJobDiscovered check
                  .thenReturn(Optional.of(runningJob)) // processing loop check 1
                  .thenReturn(Optional.of(completedJob)); // processing loop check 2

              // No partition to claim (simulating all taken by other servers)
              when(mock.claimNextPartition(eq(jobId))).thenReturn(Optional.empty());
            })) {

      participant =
          new DistributedJobParticipant(
              collectionDAO, searchRepository, "test-server-1", testNotifier);
      participant.start();

      // Manually trigger job discovery (simulating notification from Redis or polling)
      testNotifier.triggerJobDiscovered(jobId);

      // Wait for the participant to join the job - currentJobId is set synchronously
      // before the virtual thread starts processing
      Awaitility.await()
          .atMost(5, TimeUnit.SECONDS)
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

      participant =
          new DistributedJobParticipant(
              collectionDAO, searchRepository, "test-server-1", testNotifier);
      participant.start();

      // Trigger job discovery manually
      testNotifier.triggerJobDiscovered(jobId);

      // Wait for first join attempt
      Awaitility.await()
          .atMost(5, TimeUnit.SECONDS)
          .until(() -> participant.getCurrentJobId() != null);

      UUID firstJobId = participant.getCurrentJobId();
      assertEquals(jobId, firstJobId);

      // Try triggering again - should be ignored since already participating
      testNotifier.triggerJobDiscovered(jobId);

      // Same job ID should still be remembered
      assertEquals(jobId, participant.getCurrentJobId());
    }
  }

  @Test
  void testClearsJobIdWhenJobCompletes() throws Exception {
    UUID jobId = UUID.randomUUID();

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
            .id(UUID.randomUUID())
            .jobId(jobId)
            .entityType("table")
            .partitionIndex(0)
            .status(PartitionStatus.PENDING)
            .build();

    when(searchRepository.createBulkSink(anyInt(), anyInt(), anyLong())).thenReturn(bulkSink);

    // Create a processing partition to simulate work in progress
    SearchIndexPartition processingPartition =
        SearchIndexPartition.builder()
            .id(UUID.randomUUID())
            .jobId(jobId)
            .entityType("table")
            .partitionIndex(1)
            .status(PartitionStatus.PROCESSING)
            .build();

    try (MockedConstruction<DistributedSearchIndexCoordinator> mocked =
        mockConstruction(
            DistributedSearchIndexCoordinator.class,
            (mock, context) -> {
              // Has pending partitions initially in onJobDiscovered, then empty in loop
              when(mock.getPartitions(eq(jobId), eq(PartitionStatus.PENDING)))
                  .thenReturn(List.of(pendingPartition)) // onJobDiscovered check
                  .thenReturn(List.of()); // processing loop checks

              // Processing partitions - first shows work in progress (causes 1s delay)
              when(mock.getPartitions(eq(jobId), eq(PartitionStatus.PROCESSING)))
                  .thenReturn(List.of(processingPartition)) // loop iteration 1: wait
                  .thenReturn(List.of()); // loop iteration 2: done

              // Job stays running for first two checks, then transitions to completed
              when(mock.getJob(eq(jobId)))
                  .thenReturn(Optional.of(runningJob)) // onJobDiscovered check
                  .thenReturn(Optional.of(runningJob)) // processing loop check 1
                  .thenReturn(Optional.of(completedJob)); // processing loop check 2

              // No partition to claim
              when(mock.claimNextPartition(eq(jobId))).thenReturn(Optional.empty());
            })) {

      participant =
          new DistributedJobParticipant(
              collectionDAO, searchRepository, "test-server-1", testNotifier);
      participant.start();

      // Trigger job discovery manually
      testNotifier.triggerJobDiscovered(jobId);

      // Wait for participant to join (currentJobId is set synchronously before virtual thread)
      Awaitility.await()
          .atMost(5, TimeUnit.SECONDS)
          .until(() -> participant.getCurrentJobId() != null);

      assertEquals(jobId, participant.getCurrentJobId());

      // Wait for job processing to complete (job detected as terminal or no more partitions)
      Awaitility.await().atMost(10, TimeUnit.SECONDS).until(() -> !participant.isParticipating());

      // After completion, currentJobId should be cleared
      assertNull(participant.getCurrentJobId());
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

    // Create a processing partition to simulate work in progress
    SearchIndexPartition processingPartition =
        SearchIndexPartition.builder()
            .id(UUID.randomUUID())
            .jobId(jobId)
            .entityType("table")
            .partitionIndex(1)
            .status(PartitionStatus.PROCESSING)
            .build();

    try (MockedConstruction<DistributedSearchIndexCoordinator> coordinatorMocked =
        mockConstruction(
            DistributedSearchIndexCoordinator.class,
            (mock, context) -> {
              // Has pending partitions in onJobDiscovered, then empty in loop
              when(mock.getPartitions(eq(jobId), eq(PartitionStatus.PENDING)))
                  .thenReturn(List.of(partition)) // onJobDiscovered check
                  .thenReturn(List.of()); // processing loop checks

              // Processing partitions - first shows work in progress (causes 1s delay)
              when(mock.getPartitions(eq(jobId), eq(PartitionStatus.PROCESSING)))
                  .thenReturn(List.of(processingPartition)) // loop iteration 1: wait
                  .thenReturn(List.of()); // loop iteration 2: done

              // Job stays running for multiple checks
              when(mock.getJob(eq(jobId)))
                  .thenReturn(Optional.of(runningJob)) // onJobDiscovered check
                  .thenReturn(Optional.of(runningJob)) // processing loop check 1
                  .thenReturn(Optional.of(completedJob)); // processing loop check 2

              // No partition available to claim
              when(mock.claimNextPartition(eq(jobId))).thenReturn(Optional.empty());
            })) {

      participant =
          new DistributedJobParticipant(
              collectionDAO, searchRepository, "test-server-1", testNotifier);
      participant.start();

      // Trigger job discovery manually
      testNotifier.triggerJobDiscovered(jobId);

      // Wait for participant to join job
      Awaitility.await()
          .atMost(5, TimeUnit.SECONDS)
          .until(() -> participant.getCurrentJobId() != null);

      // Verify the coordinator was called to claim partition
      DistributedSearchIndexCoordinator constructedMock = coordinatorMocked.constructed().get(0);
      Awaitility.await()
          .atMost(5, TimeUnit.SECONDS)
          .untilAsserted(
              () -> verify(constructedMock, atLeastOnce()).claimNextPartition(eq(jobId)));
    }
  }
}
