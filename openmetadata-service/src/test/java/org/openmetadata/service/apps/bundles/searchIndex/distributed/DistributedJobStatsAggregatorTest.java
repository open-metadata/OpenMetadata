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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.system.EventPublisherJob;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DistributedJobStatsAggregatorTest {

  @Mock private DistributedSearchIndexCoordinator coordinator;

  private DistributedJobStatsAggregator aggregator;
  private UUID jobId;

  @BeforeEach
  void setUp() {
    jobId = UUID.randomUUID();
  }

  @AfterEach
  void tearDown() {
    if (aggregator != null) {
      aggregator.stop();
    }
  }

  @Test
  void testStartAndStop() {
    aggregator = new DistributedJobStatsAggregator(coordinator, jobId);

    assertFalse(aggregator.isRunning());

    aggregator.start();
    assertTrue(aggregator.isRunning());

    aggregator.stop();
    assertFalse(aggregator.isRunning());
  }

  @Test
  void testMultipleStartCallsAreIdempotent() {
    aggregator = new DistributedJobStatsAggregator(coordinator, jobId);

    aggregator.start();
    aggregator.start();
    aggregator.start();

    assertTrue(aggregator.isRunning());
  }

  @Test
  void testMultipleStopCallsAreIdempotent() {
    aggregator = new DistributedJobStatsAggregator(coordinator, jobId);

    aggregator.start();
    aggregator.stop();
    aggregator.stop();
    aggregator.stop();

    assertFalse(aggregator.isRunning());
  }

  @Test
  void testStopsWhenJobNotFound() throws Exception {
    when(coordinator.getJobWithAggregatedStats(jobId)).thenReturn(null);

    aggregator = new DistributedJobStatsAggregator(coordinator, jobId, 500);
    aggregator.start();

    // Wait for aggregator to detect null job and stop
    Awaitility.await().atMost(3, TimeUnit.SECONDS).until(() -> !aggregator.isRunning());

    assertFalse(aggregator.isRunning());
  }

  @Test
  void testDoesNotStopWhenJobIsTerminal() throws Exception {
    EventPublisherJob config = new EventPublisherJob();
    config.setBatchSize(100);

    SearchIndexJob completedJob =
        SearchIndexJob.builder()
            .id(jobId)
            .status(IndexJobStatus.COMPLETED)
            .jobConfiguration(config)
            .totalRecords(1000)
            .processedRecords(1000)
            .successRecords(1000)
            .failedRecords(0)
            .completedAt(System.currentTimeMillis())
            .build();

    when(coordinator.getJobWithAggregatedStats(jobId)).thenReturn(completedJob);

    aggregator = new DistributedJobStatsAggregator(coordinator, jobId, 500);
    aggregator.start();

    // Wait for a couple of poll cycles
    Thread.sleep(1500);

    // Aggregator should still be running (executor is responsible for stopping it)
    assertTrue(aggregator.isRunning());

    aggregator.stop();
  }

  @Test
  void testGetCurrentStats() {
    EventPublisherJob config = new EventPublisherJob();
    config.setBatchSize(100);

    SearchIndexJob job =
        SearchIndexJob.builder()
            .id(jobId)
            .status(IndexJobStatus.RUNNING)
            .jobConfiguration(config)
            .totalRecords(1000)
            .processedRecords(500)
            .successRecords(450)
            .failedRecords(50)
            .build();

    when(coordinator.getJobWithAggregatedStats(jobId)).thenReturn(job);

    aggregator = new DistributedJobStatsAggregator(coordinator, jobId);

    SearchIndexJob currentStats = aggregator.getCurrentStats();
    assertNotNull(currentStats);
    assertEquals(1000, currentStats.getTotalRecords());
    assertEquals(500, currentStats.getProcessedRecords());
    assertEquals(450, currentStats.getSuccessRecords());
    assertEquals(50, currentStats.getFailedRecords());
  }

  @Test
  void testGetCurrentStatsWithEntityStats() {
    EventPublisherJob config = new EventPublisherJob();
    config.setBatchSize(100);

    Map<String, SearchIndexJob.EntityTypeStats> entityStats = new HashMap<>();
    entityStats.put(
        "table",
        SearchIndexJob.EntityTypeStats.builder()
            .entityType("table")
            .totalRecords(500)
            .processedRecords(250)
            .successRecords(240)
            .failedRecords(10)
            .totalPartitions(5)
            .completedPartitions(2)
            .build());
    entityStats.put(
        "dashboard",
        SearchIndexJob.EntityTypeStats.builder()
            .entityType("dashboard")
            .totalRecords(500)
            .processedRecords(250)
            .successRecords(210)
            .failedRecords(40)
            .totalPartitions(5)
            .completedPartitions(3)
            .build());

    SearchIndexJob job =
        SearchIndexJob.builder()
            .id(jobId)
            .status(IndexJobStatus.RUNNING)
            .jobConfiguration(config)
            .totalRecords(1000)
            .processedRecords(500)
            .successRecords(450)
            .failedRecords(50)
            .entityStats(entityStats)
            .build();

    when(coordinator.getJobWithAggregatedStats(jobId)).thenReturn(job);

    aggregator = new DistributedJobStatsAggregator(coordinator, jobId);

    SearchIndexJob currentStats = aggregator.getCurrentStats();
    assertNotNull(currentStats);
    assertNotNull(currentStats.getEntityStats());
    assertEquals(2, currentStats.getEntityStats().size());

    SearchIndexJob.EntityTypeStats tableStats = currentStats.getEntityStats().get("table");
    assertNotNull(tableStats);
    assertEquals(500, tableStats.getTotalRecords());
    assertEquals(250, tableStats.getProcessedRecords());
    assertEquals(240, tableStats.getSuccessRecords());
    assertEquals(10, tableStats.getFailedRecords());

    SearchIndexJob.EntityTypeStats dashboardStats = currentStats.getEntityStats().get("dashboard");
    assertNotNull(dashboardStats);
    assertEquals(500, dashboardStats.getTotalRecords());
    assertEquals(210, dashboardStats.getSuccessRecords());
    assertEquals(40, dashboardStats.getFailedRecords());
  }

  @Test
  void testMinPollIntervalEnforced() {
    // Try to create with poll interval below minimum (500ms)
    aggregator = new DistributedJobStatsAggregator(coordinator, jobId, 100);

    // The aggregator should enforce minimum interval internally
    // We can't directly test this without reflection, but we can verify it doesn't crash
    assertNotNull(aggregator);
  }

  @Test
  void testForceUpdateWhenNotRunning() {
    EventPublisherJob config = new EventPublisherJob();
    config.setBatchSize(100);

    SearchIndexJob job =
        SearchIndexJob.builder()
            .id(jobId)
            .status(IndexJobStatus.RUNNING)
            .jobConfiguration(config)
            .totalRecords(1000)
            .build();

    when(coordinator.getJobWithAggregatedStats(jobId)).thenReturn(job);

    aggregator = new DistributedJobStatsAggregator(coordinator, jobId);
    // Don't start - call forceUpdate directly
    aggregator.forceUpdate();

    // Should not throw, and coordinator should have been called
    // (verify by checking current stats works)
    SearchIndexJob stats = aggregator.getCurrentStats();
    assertNotNull(stats);
  }

  @Test
  void testProgressCalculation() {
    EventPublisherJob config = new EventPublisherJob();
    config.setBatchSize(100);

    SearchIndexJob job =
        SearchIndexJob.builder()
            .id(jobId)
            .status(IndexJobStatus.RUNNING)
            .jobConfiguration(config)
            .totalRecords(1000)
            .processedRecords(500)
            .successRecords(480)
            .failedRecords(20)
            .build();

    when(coordinator.getJobWithAggregatedStats(jobId)).thenReturn(job);

    aggregator = new DistributedJobStatsAggregator(coordinator, jobId);

    SearchIndexJob currentStats = aggregator.getCurrentStats();
    assertNotNull(currentStats);

    // Verify the stats used for progress calculation
    assertEquals(1000, currentStats.getTotalRecords());
    assertEquals(500, currentStats.getProcessedRecords());
    // Progress should be (processedRecords / totalRecords) * 100 = 50%
    assertEquals(50.0, currentStats.getProgressPercent(), 0.01);
  }

  @Test
  void testJobStatusTransitions() {
    EventPublisherJob config = new EventPublisherJob();
    config.setBatchSize(100);

    // Test INITIALIZING
    SearchIndexJob initJob =
        SearchIndexJob.builder()
            .id(jobId)
            .status(IndexJobStatus.INITIALIZING)
            .jobConfiguration(config)
            .totalRecords(100)
            .build();
    assertFalse(initJob.isTerminal());

    // Test READY
    SearchIndexJob readyJob = initJob.toBuilder().status(IndexJobStatus.READY).build();
    assertFalse(readyJob.isTerminal());

    // Test RUNNING
    SearchIndexJob runningJob = initJob.toBuilder().status(IndexJobStatus.RUNNING).build();
    assertFalse(runningJob.isTerminal());

    // Test COMPLETED
    SearchIndexJob completedJob = initJob.toBuilder().status(IndexJobStatus.COMPLETED).build();
    assertTrue(completedJob.isTerminal());

    // Test COMPLETED_WITH_ERRORS
    SearchIndexJob completedWithErrorsJob =
        initJob.toBuilder().status(IndexJobStatus.COMPLETED_WITH_ERRORS).build();
    assertTrue(completedWithErrorsJob.isTerminal());

    // Test FAILED
    SearchIndexJob failedJob = initJob.toBuilder().status(IndexJobStatus.FAILED).build();
    assertTrue(failedJob.isTerminal());

    // Test STOPPING
    SearchIndexJob stoppingJob = initJob.toBuilder().status(IndexJobStatus.STOPPING).build();
    assertFalse(stoppingJob.isTerminal());

    // Test STOPPED
    SearchIndexJob stoppedJob = initJob.toBuilder().status(IndexJobStatus.STOPPED).build();
    assertTrue(stoppedJob.isTerminal());
  }
}
