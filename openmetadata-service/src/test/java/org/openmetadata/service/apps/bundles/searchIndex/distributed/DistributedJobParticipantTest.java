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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.SuccessContext;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.BulkSink;
import org.openmetadata.service.apps.bundles.searchIndex.IndexingFailureRecorder;
import org.openmetadata.service.cache.CacheConfig;
import org.openmetadata.service.jdbi3.AppRepository;
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
  void tearDown() throws Exception {
    clearCoordinatedJobs();
    Thread.interrupted();
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
  void testJoinsActiveJobWithPendingPartitions() {
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
  void testDoesNotRejoinSameRunningJob() {
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
  void testClearsJobIdWhenJobCompletes() {
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
  void testAttemptsToClaimPartitions() {
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

  @Test
  void testOnJobDiscoveredSkipsJobsThatCannotBeJoined() throws Exception {
    UUID missingJobId = UUID.randomUUID();
    UUID terminalJobId = UUID.randomUUID();
    UUID readyJobId = UUID.randomUUID();
    UUID coordinatedJobId = UUID.randomUUID();
    UUID noPendingJobId = UUID.randomUUID();
    UUID failingJobId = UUID.randomUUID();

    EventPublisherJob config = new EventPublisherJob();
    config.setEntities(Set.of("table"));

    SearchIndexJob terminalJob =
        SearchIndexJob.builder()
            .id(terminalJobId)
            .status(IndexJobStatus.COMPLETED)
            .jobConfiguration(config)
            .build();
    SearchIndexJob readyJob =
        SearchIndexJob.builder()
            .id(readyJobId)
            .status(IndexJobStatus.READY)
            .jobConfiguration(config)
            .build();
    SearchIndexJob coordinatedJob =
        SearchIndexJob.builder()
            .id(coordinatedJobId)
            .status(IndexJobStatus.RUNNING)
            .jobConfiguration(config)
            .build();
    SearchIndexJob noPendingJob =
        SearchIndexJob.builder()
            .id(noPendingJobId)
            .status(IndexJobStatus.RUNNING)
            .jobConfiguration(config)
            .build();

    try (MockedConstruction<DistributedSearchIndexCoordinator> coordinatorMocked =
        mockConstruction(
            DistributedSearchIndexCoordinator.class,
            (mock, context) -> {
              when(mock.getJob(eq(missingJobId))).thenReturn(Optional.empty());
              when(mock.getJob(eq(terminalJobId))).thenReturn(Optional.of(terminalJob));
              when(mock.getJob(eq(readyJobId))).thenReturn(Optional.of(readyJob));
              when(mock.getJob(eq(coordinatedJobId))).thenReturn(Optional.of(coordinatedJob));
              when(mock.getJob(eq(noPendingJobId))).thenReturn(Optional.of(noPendingJob));
              when(mock.getJob(eq(failingJobId))).thenThrow(new IllegalStateException("boom"));
              when(mock.getPartitions(eq(noPendingJobId), eq(PartitionStatus.PENDING)))
                  .thenReturn(List.of());
            })) {

      participant =
          new DistributedJobParticipant(
              collectionDAO, searchRepository, "test-server-1", testNotifier);

      invokeParticipantMethod("onJobDiscovered", new Class<?>[] {UUID.class}, missingJobId);
      invokeParticipantMethod("onJobDiscovered", new Class<?>[] {UUID.class}, terminalJobId);
      invokeParticipantMethod("onJobDiscovered", new Class<?>[] {UUID.class}, readyJobId);

      addCoordinatedJob(coordinatedJobId);
      invokeParticipantMethod("onJobDiscovered", new Class<?>[] {UUID.class}, coordinatedJobId);
      clearCoordinatedJobs();

      invokeParticipantMethod("onJobDiscovered", new Class<?>[] {UUID.class}, noPendingJobId);
      invokeParticipantMethod("onJobDiscovered", new Class<?>[] {UUID.class}, failingJobId);

      assertFalse(participant.isParticipating());
      assertNull(participant.getCurrentJobId());

      DistributedSearchIndexCoordinator coordinator = coordinatorMocked.constructed().get(0);
      verify(coordinator, never()).getPartitions(eq(coordinatedJobId), eq(PartitionStatus.PENDING));
      verify(coordinator).getPartitions(eq(noPendingJobId), eq(PartitionStatus.PENDING));
    }
  }

  @Test
  void testJoinAndProcessJobTracksPollingNotifierParticipation() throws Exception {
    UUID jobId = UUID.randomUUID();

    EventPublisherJob config = new EventPublisherJob();
    config.setEntities(Set.of("table"));
    config.setBatchSize(100);

    SearchIndexJob runningJob =
        SearchIndexJob.builder()
            .id(jobId)
            .status(IndexJobStatus.RUNNING)
            .jobConfiguration(config)
            .build();

    SearchIndexPartition pendingPartition =
        SearchIndexPartition.builder()
            .id(UUID.randomUUID())
            .jobId(jobId)
            .entityType("table")
            .status(PartitionStatus.PENDING)
            .build();

    SearchIndexPartition processingPartition =
        SearchIndexPartition.builder()
            .id(UUID.randomUUID())
            .jobId(jobId)
            .entityType("table")
            .status(PartitionStatus.PROCESSING)
            .build();

    PollingJobNotifier pollingNotifier = new PollingJobNotifier(collectionDAO, "server-1");
    when(searchRepository.createBulkSink(anyInt(), anyInt(), anyLong())).thenReturn(bulkSink);
    when(bulkSink.flushAndAwait(60)).thenReturn(true);

    try (MockedConstruction<DistributedSearchIndexCoordinator> coordinatorMocked =
        mockConstruction(
            DistributedSearchIndexCoordinator.class,
            (mock, context) -> {
              when(mock.getJob(eq(jobId)))
                  .thenReturn(
                      Optional.of(runningJob), Optional.of(runningJob), Optional.of(runningJob));
              when(mock.getPartitions(eq(jobId), eq(PartitionStatus.PENDING)))
                  .thenReturn(List.of(pendingPartition), List.of());
              when(mock.getPartitions(eq(jobId), eq(PartitionStatus.PROCESSING)))
                  .thenReturn(List.of(processingPartition), List.of());
              when(mock.claimNextPartition(eq(jobId))).thenReturn(Optional.empty());
            })) {

      participant =
          new DistributedJobParticipant(
              collectionDAO, searchRepository, "test-server-1", pollingNotifier);
      setParticipantRunning(true);

      invokeParticipantMethod("onJobDiscovered", new Class<?>[] {UUID.class}, jobId);

      assertTrue(getPollingNotifierParticipating(pollingNotifier));
      assertEquals(jobId, participant.getCurrentJobId());

      Awaitility.await().atMost(5, TimeUnit.SECONDS).until(() -> !participant.isParticipating());

      assertFalse(getPollingNotifierParticipating(pollingNotifier));
      assertNull(participant.getCurrentJobId());

      DistributedSearchIndexCoordinator coordinator = coordinatorMocked.constructed().get(0);
      verify(coordinator, atLeastOnce()).claimNextPartition(jobId);
    }
  }

  @Test
  void testStopRestoresInterruptFlagWhenJoinWaitIsInterrupted() throws Exception {
    Thread workerThread = mock(Thread.class);
    doThrow(new InterruptedException("stop")).when(workerThread).join(10_000);

    participant =
        new DistributedJobParticipant(
            collectionDAO, searchRepository, "test-server-1", testNotifier);
    setParticipantRunning(true);
    setParticipantField("participantThread", workerThread);

    participant.stop();

    verify(workerThread).interrupt();
    assertTrue(Thread.currentThread().isInterrupted());
  }

  @Test
  void testResolveAppRunRecordContextReturnsNullWhenLookupFails() throws Exception {
    participant =
        new DistributedJobParticipant(
            collectionDAO, searchRepository, "test-server-1", testNotifier);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.APPLICATION))
          .thenThrow(new IllegalStateException("missing repository"));

      Object appCtx = invokeParticipantMethod("resolveAppRunRecordContext", new Class<?>[0]);

      assertNull(appCtx);
    }
  }

  @Test
  void testRestoreAppRunRecordToRunningSwallowsDaoErrors() throws Exception {
    UUID appId = UUID.randomUUID();
    CollectionDAO.AppExtensionTimeSeries appExtensionDao =
        mock(CollectionDAO.AppExtensionTimeSeries.class);
    when(collectionDAO.appExtensionTimeSeriesDao()).thenReturn(appExtensionDao);
    doThrow(new IllegalStateException("db down"))
        .when(appExtensionDao)
        .markEntryRunning(appId.toString(), 42L);

    participant =
        new DistributedJobParticipant(
            collectionDAO, searchRepository, "test-server-1", testNotifier);

    invokeParticipantMethod(
        "restoreAppRunRecordToRunning", new Class<?>[] {UUID.class, long.class}, appId, 42L);

    verify(appExtensionDao).markEntryRunning(appId.toString(), 42L);
  }

  @Test
  void testFinalizeAppRunRecordSkipsTransientAndMissingStates() throws Exception {
    UUID appId = UUID.randomUUID();
    UUID jobId = UUID.randomUUID();

    CollectionDAO.AppExtensionTimeSeries appExtensionDao =
        mock(CollectionDAO.AppExtensionTimeSeries.class);
    when(collectionDAO.appExtensionTimeSeriesDao()).thenReturn(appExtensionDao);

    participant =
        new DistributedJobParticipant(
            collectionDAO, searchRepository, "test-server-1", testNotifier);

    Object appCtx = newAppRunRecordContext(appId, 42L);
    DistributedJobStatsAggregator aggregator = mock(DistributedJobStatsAggregator.class);
    AppRunRecord runningRecord = new AppRunRecord().withStatus(AppRunRecord.Status.RUNNING);
    AppRunRecord pendingRecord = new AppRunRecord().withStatus(AppRunRecord.Status.PENDING);
    AppRunRecord failedRecord = new AppRunRecord().withStatus(AppRunRecord.Status.FAILED);

    when(aggregator.buildFinalAppRunRecord())
        .thenReturn(null, runningRecord, pendingRecord, failedRecord);
    when(appExtensionDao.getByAppIdAndTimestamp(appId.toString(), 42L, "status")).thenReturn(null);

    invokeParticipantMethod(
        "finalizeAppRunRecord",
        new Class<?>[] {DistributedJobStatsAggregator.class, appRunRecordContextType(), UUID.class},
        aggregator,
        appCtx,
        jobId);
    invokeParticipantMethod(
        "finalizeAppRunRecord",
        new Class<?>[] {DistributedJobStatsAggregator.class, appRunRecordContextType(), UUID.class},
        aggregator,
        appCtx,
        jobId);
    invokeParticipantMethod(
        "finalizeAppRunRecord",
        new Class<?>[] {DistributedJobStatsAggregator.class, appRunRecordContextType(), UUID.class},
        aggregator,
        appCtx,
        jobId);
    invokeParticipantMethod(
        "finalizeAppRunRecord",
        new Class<?>[] {DistributedJobStatsAggregator.class, appRunRecordContextType(), UUID.class},
        aggregator,
        appCtx,
        jobId);

    verify(appExtensionDao, never()).update(any(), any(), any(), any());
  }

  @Test
  void testRecoveredParticipationRestoresRunRecordAndFinalizesStats() throws Exception {
    UUID jobId = UUID.randomUUID();
    UUID appId = UUID.randomUUID();
    long startTime = 123L;
    SearchIndexPartition partition =
        SearchIndexPartition.builder()
            .id(UUID.randomUUID())
            .jobId(jobId)
            .entityType("table")
            .status(PartitionStatus.PENDING)
            .build();

    EventPublisherJob config = new EventPublisherJob();
    config.setEntities(Set.of("table"));
    config.setBatchSize(50);
    config.setMaxConcurrentRequests(8);
    config.setPayLoadSize(4096L);
    config.setRecreateIndex(true);

    SearchIndexJob runningJob =
        SearchIndexJob.builder()
            .id(jobId)
            .status(IndexJobStatus.RUNNING)
            .jobConfiguration(config)
            .stagedIndexMapping(Map.of("table", "table_staged"))
            .build();
    SearchIndexJob completedJob =
        SearchIndexJob.builder()
            .id(jobId)
            .status(IndexJobStatus.COMPLETED)
            .jobConfiguration(config)
            .build();

    CollectionDAO.ApplicationDAO appDao = mock(CollectionDAO.ApplicationDAO.class);
    AppRepository appRepository = mock(AppRepository.class);
    App app = new App().withId(appId).withName("SearchIndexingApplication");
    AppRunRecord latestRecord =
        new AppRunRecord()
            .withAppId(appId)
            .withAppName(app.getName())
            .withStartTime(startTime)
            .withStatus(AppRunRecord.Status.RUNNING);
    AppRunRecord existingRecord =
        new AppRunRecord()
            .withAppId(appId)
            .withAppName(app.getName())
            .withStartTime(startTime)
            .withTimestamp(startTime)
            .withStatus(AppRunRecord.Status.RUNNING);
    CollectionDAO.AppExtensionTimeSeries appExtensionDao =
        mock(CollectionDAO.AppExtensionTimeSeries.class);
    AtomicReference<BulkSink.FailureCallback> callbackRef = new AtomicReference<>();
    AtomicReference<Object> recreateContextRef = new AtomicReference<>();
    SuccessContext successContext = new SuccessContext().withAdditionalProperty("recovered", "yes");

    when(appRepository.getDao()).thenReturn(appDao);
    when(appDao.findEntityByName("SearchIndexingApplication")).thenReturn(app);
    when(appRepository.getLatestAppRuns(app)).thenReturn(latestRecord);
    when(collectionDAO.appExtensionTimeSeriesDao()).thenReturn(appExtensionDao);
    when(appExtensionDao.getByAppIdAndTimestamp(appId.toString(), startTime, "status"))
        .thenReturn(JsonUtils.pojoToJson(existingRecord));
    when(searchRepository.createBulkSink(50, 8, 4096L)).thenReturn(bulkSink);
    when(bulkSink.flushAndAwait(60)).thenReturn(true);
    doAnswer(
            invocation -> {
              callbackRef.set(invocation.getArgument(0));
              return null;
            })
        .when(bulkSink)
        .setFailureCallback(any());

    try (MockedConstruction<DistributedSearchIndexCoordinator> coordinatorMocked =
            mockConstruction(
                DistributedSearchIndexCoordinator.class,
                (mock, context) -> {
                  when(mock.getJob(eq(jobId)))
                      .thenReturn(
                          Optional.of(runningJob),
                          Optional.of(runningJob),
                          Optional.of(completedJob));
                  when(mock.claimNextPartition(eq(jobId)))
                      .thenReturn(Optional.of(partition), Optional.empty());
                });
        MockedConstruction<DistributedJobStatsAggregator> aggregatorConstruction =
            mockConstruction(
                DistributedJobStatsAggregator.class,
                (mock, context) -> {
                  AppRunRecord finalRecord =
                      new AppRunRecord().withStatus(AppRunRecord.Status.FAILED);
                  finalRecord.setSuccessContext(successContext);
                  when(mock.buildFinalAppRunRecord()).thenReturn(finalRecord);
                });
        MockedConstruction<IndexingFailureRecorder> failureConstruction =
            mockConstruction(IndexingFailureRecorder.class);
        MockedConstruction<PartitionWorker> workerConstruction =
            mockConstruction(
                PartitionWorker.class,
                (mock, context) -> {
                  recreateContextRef.set(context.arguments().get(3));
                  when(mock.processPartition(partition))
                      .thenReturn(new PartitionWorker.PartitionResult(4, 1, false, 2, 3));
                });
        MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {

      entityMock
          .when(() -> Entity.getEntityRepository(Entity.APPLICATION))
          .thenReturn(appRepository);

      participant =
          new DistributedJobParticipant(
              collectionDAO, searchRepository, "test-server-1", testNotifier);
      setParticipantRunning(true);

      invokeParticipantMethod(
          "processJobPartitions", new Class<?>[] {SearchIndexJob.class}, runningJob);

      assertNotNull(callbackRef.get());
      assertNotNull(recreateContextRef.get());
      callbackRef
          .get()
          .onFailure(
              "table",
              "1",
              "table.fqn",
              "process failed",
              org.openmetadata
                  .service
                  .apps
                  .bundles
                  .searchIndex
                  .IndexingFailureRecorder
                  .FailureStage
                  .PROCESS);
      callbackRef
          .get()
          .onFailure(
              "table",
              "2",
              "table.fqn",
              "sink failed",
              org.openmetadata
                  .service
                  .apps
                  .bundles
                  .searchIndex
                  .IndexingFailureRecorder
                  .FailureStage
                  .SINK);

      DistributedJobStatsAggregator statsAggregator = aggregatorConstruction.constructed().get(0);
      IndexingFailureRecorder failureRecorder = failureConstruction.constructed().get(0);

      verify(workerConstruction.constructed().get(0)).processPartition(partition);
      verify(statsAggregator).start();
      verify(statsAggregator).forceUpdate();
      verify(statsAggregator).stop();
      verify(failureRecorder).recordProcessFailure("table", "1", "table.fqn", "process failed");
      verify(failureRecorder).recordSinkFailure("table", "2", "table.fqn", "sink failed");
      verify(failureRecorder).close();
      verify(appExtensionDao).markEntryRunning(appId.toString(), startTime);
      ArgumentCaptor<String> updatedJson = ArgumentCaptor.forClass(String.class);
      verify(appExtensionDao)
          .update(eq(appId.toString()), updatedJson.capture(), eq(startTime), eq("status"));

      AppRunRecord updatedRecord = JsonUtils.readValue(updatedJson.getValue(), AppRunRecord.class);
      assertEquals(AppRunRecord.Status.FAILED, updatedRecord.getStatus());
      assertEquals(
          "yes", updatedRecord.getSuccessContext().getAdditionalProperties().get("recovered"));
      assertNotNull(updatedRecord.getEndTime());

      DistributedSearchIndexCoordinator coordinator = coordinatorMocked.constructed().get(0);
      verify(coordinator, atLeastOnce()).claimNextPartition(jobId);
    }
  }

  @Test
  void testProcessJobPartitionsUsesDefaultBulkSinkSettingsAndHandlesInterruptedWait()
      throws Exception {
    UUID jobId = UUID.randomUUID();
    EventPublisherJob config = new EventPublisherJob();
    config.setEntities(Set.of("table"));

    SearchIndexJob runningJob =
        SearchIndexJob.builder()
            .id(jobId)
            .status(IndexJobStatus.RUNNING)
            .jobConfiguration(config)
            .build();
    SearchIndexPartition pendingPartition =
        SearchIndexPartition.builder()
            .id(UUID.randomUUID())
            .jobId(jobId)
            .entityType("table")
            .status(PartitionStatus.PENDING)
            .build();

    CollectionDAO.SearchIndexFailureDAO failureDao =
        mock(CollectionDAO.SearchIndexFailureDAO.class);
    when(collectionDAO.searchIndexFailureDAO()).thenReturn(failureDao);
    when(searchRepository.createBulkSink(100, 100, 104857600L)).thenReturn(bulkSink);
    when(bulkSink.flushAndAwait(60)).thenReturn(false);

    try (MockedConstruction<DistributedSearchIndexCoordinator> coordinatorMocked =
        mockConstruction(
            DistributedSearchIndexCoordinator.class,
            (mock, context) -> {
              when(mock.getJob(eq(jobId))).thenReturn(Optional.of(runningJob));
              when(mock.claimNextPartition(eq(jobId))).thenReturn(Optional.empty());
              when(mock.getPartitions(eq(jobId), eq(PartitionStatus.PENDING)))
                  .thenReturn(List.of(pendingPartition));
              when(mock.getPartitions(eq(jobId), eq(PartitionStatus.PROCESSING)))
                  .thenReturn(List.of());
            })) {

      participant =
          new DistributedJobParticipant(
              collectionDAO, searchRepository, "test-server-1", testNotifier);
      setParticipantRunning(true);
      Thread.currentThread().interrupt();

      invokeParticipantMethod(
          "processJobPartitions", new Class<?>[] {SearchIndexJob.class}, runningJob);

      verify(searchRepository).createBulkSink(100, 100, 104857600L);
      verify(bulkSink).flushAndAwait(60);
      assertTrue(Thread.currentThread().isInterrupted());
      verify(coordinatorMocked.constructed().get(0)).claimNextPartition(jobId);
    }
  }

  private void setParticipantField(String fieldName, Object value) throws Exception {
    Field field = DistributedJobParticipant.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(participant, value);
  }

  private Object getParticipantField(String fieldName) throws Exception {
    Field field = DistributedJobParticipant.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    return field.get(participant);
  }

  private void setParticipantRunning(boolean running) throws Exception {
    ((AtomicBoolean) getParticipantField("running")).set(running);
  }

  private Object invokeParticipantMethod(
      String methodName, Class<?>[] parameterTypes, Object... args) throws Exception {
    Method method = DistributedJobParticipant.class.getDeclaredMethod(methodName, parameterTypes);
    method.setAccessible(true);
    return method.invoke(participant, args);
  }

  private Class<?> appRunRecordContextType() {
    for (Class<?> nestedClass : DistributedJobParticipant.class.getDeclaredClasses()) {
      if ("AppRunRecordContext".equals(nestedClass.getSimpleName())) {
        return nestedClass;
      }
    }
    throw new IllegalStateException("AppRunRecordContext type not found");
  }

  private Object newAppRunRecordContext(UUID appId, long startTime) throws Exception {
    Constructor<?> constructor =
        appRunRecordContextType().getDeclaredConstructor(UUID.class, long.class);
    constructor.setAccessible(true);
    return constructor.newInstance(appId, startTime);
  }

  @SuppressWarnings("unchecked")
  private void clearCoordinatedJobs() throws Exception {
    Field field = DistributedSearchIndexExecutor.class.getDeclaredField("COORDINATED_JOBS");
    field.setAccessible(true);
    ((Set<UUID>) field.get(null)).clear();
  }

  @SuppressWarnings("unchecked")
  private void addCoordinatedJob(UUID jobId) throws Exception {
    Field field = DistributedSearchIndexExecutor.class.getDeclaredField("COORDINATED_JOBS");
    field.setAccessible(true);
    ((Set<UUID>) field.get(null)).add(jobId);
  }

  private boolean getPollingNotifierParticipating(PollingJobNotifier notifier) throws Exception {
    Field field = PollingJobNotifier.class.getDeclaredField("participating");
    field.setAccessible(true);
    return ((AtomicBoolean) field.get(notifier)).get();
  }
}
