/*
 *  Copyright 2025 Collate
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

package org.openmetadata.service.monitoring;

import static org.junit.jupiter.api.Assertions.*;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.OperationMetric;
import org.openmetadata.schema.entity.services.ingestionPipelines.OperationMetricsBatch;
import org.openmetadata.schema.entity.services.ingestionPipelines.ProgressNode;
import org.openmetadata.schema.entity.services.ingestionPipelines.ProgressUpdate;
import org.openmetadata.schema.entity.services.ingestionPipelines.ProgressUpdateType;
import org.openmetadata.schema.entity.services.ingestionPipelines.ServiceProgressEvent;

class IngestionProgressTrackerTest {

  private IngestionProgressTracker tracker;
  private SimpleMeterRegistry meterRegistry;

  @BeforeEach
  void setUp() {
    meterRegistry = new SimpleMeterRegistry();
    tracker = new IngestionProgressTracker(meterRegistry);
  }

  @Test
  void testUpdateProgress() {
    String pipelineFqn = "service.pipeline";
    UUID runId = UUID.randomUUID();

    ProgressNode progress =
        new ProgressNode()
            .withLabel("")
            .withEntityType("Table")
            .withProcessed(50)
            .withExpected(100)
            .withActive(true)
            .withOverflow(0);

    ProgressUpdate update =
        new ProgressUpdate()
            .withRunId(runId.toString())
            .withTimestamp(System.currentTimeMillis())
            .withUpdateType(ProgressUpdateType.PROCESSING)
            .withProgress(progress);

    tracker.updateProgress(pipelineFqn, runId, update);

    IngestionProgressTracker.ProgressState state = tracker.getProgressState(pipelineFqn, runId);
    assertNotNull(state);
    assertNotNull(state.getLatestUpdate());
    assertEquals(runId.toString(), state.getLatestUpdate().getRunId());
    assertEquals(ProgressUpdateType.PROCESSING, state.getLatestUpdate().getUpdateType());
    assertEquals("Table", state.getLatestUpdate().getProgress().getEntityType());
  }

  @Test
  void testAddAndGetMetricsBatch() {
    String pipelineFqn = "service.pipeline";
    UUID runId = UUID.randomUUID();

    OperationMetric metric =
        new OperationMetric()
            .withCategory("db_queries")
            .withOperation("SELECT")
            .withEntityType("Table")
            .withTimestamp(System.currentTimeMillis())
            .withDurationMs(150)
            .withSuccess(true);

    List<OperationMetric> metrics = new ArrayList<>();
    metrics.add(metric);

    OperationMetricsBatch batch =
        new OperationMetricsBatch()
            .withRunId(runId.toString())
            .withStepName("TestSource")
            .withBatchTimestamp(System.currentTimeMillis())
            .withMetrics(metrics);

    tracker.addMetricsBatch(pipelineFqn, runId, batch);

    List<OperationMetricsBatch> batches = tracker.getAndClearMetricsBatches(pipelineFqn, runId);
    assertNotNull(batches);
    assertEquals(1, batches.size());
    assertEquals("TestSource", batches.get(0).getStepName());
    assertEquals(1, batches.get(0).getMetrics().size());

    // Verify batches are cleared after retrieval
    List<OperationMetricsBatch> emptyBatches =
        tracker.getAndClearMetricsBatches(pipelineFqn, runId);
    assertNull(emptyBatches);
  }

  @Test
  void testProgressListener() {
    String pipelineFqn = "service.pipeline";
    UUID runId = UUID.randomUUID();

    AtomicInteger updateCount = new AtomicInteger(0);
    List<ProgressUpdate> receivedUpdates = new ArrayList<>();

    tracker.registerProgressListener(
        pipelineFqn,
        runId,
        update -> {
          updateCount.incrementAndGet();
          receivedUpdates.add(update);
        });

    ProgressUpdate update1 =
        new ProgressUpdate()
            .withRunId(runId.toString())
            .withTimestamp(System.currentTimeMillis())
            .withUpdateType(ProgressUpdateType.DISCOVERY)
            .withMessage("Discovering entities");

    ProgressUpdate update2 =
        new ProgressUpdate()
            .withRunId(runId.toString())
            .withTimestamp(System.currentTimeMillis())
            .withUpdateType(ProgressUpdateType.PROCESSING)
            .withMessage("Processing entities");

    tracker.updateProgress(pipelineFqn, runId, update1);
    tracker.updateProgress(pipelineFqn, runId, update2);

    assertEquals(2, updateCount.get());
    assertEquals(2, receivedUpdates.size());
    assertEquals(ProgressUpdateType.DISCOVERY, receivedUpdates.get(0).getUpdateType());
    assertEquals(ProgressUpdateType.PROCESSING, receivedUpdates.get(1).getUpdateType());
  }

  @Test
  void testUnregisterProgressListener() {
    String pipelineFqn = "service.pipeline";
    UUID runId = UUID.randomUUID();

    AtomicInteger updateCount = new AtomicInteger(0);
    java.util.function.Consumer<ProgressUpdate> listener = update -> updateCount.incrementAndGet();

    tracker.registerProgressListener(pipelineFqn, runId, listener);

    ProgressUpdate update1 =
        new ProgressUpdate()
            .withRunId(runId.toString())
            .withTimestamp(System.currentTimeMillis())
            .withUpdateType(ProgressUpdateType.PROCESSING);

    tracker.updateProgress(pipelineFqn, runId, update1);
    assertEquals(1, updateCount.get());

    tracker.unregisterProgressListener(pipelineFqn, runId, listener);

    ProgressUpdate update2 =
        new ProgressUpdate()
            .withRunId(runId.toString())
            .withTimestamp(System.currentTimeMillis())
            .withUpdateType(ProgressUpdateType.STEP_COMPLETE);

    tracker.updateProgress(pipelineFqn, runId, update2);
    assertEquals(1, updateCount.get()); // Count should not increase
  }

  @Test
  void testClearProgressState() {
    String pipelineFqn = "service.pipeline";
    UUID runId = UUID.randomUUID();

    ProgressUpdate update =
        new ProgressUpdate()
            .withRunId(runId.toString())
            .withTimestamp(System.currentTimeMillis())
            .withUpdateType(ProgressUpdateType.PROCESSING);

    tracker.updateProgress(pipelineFqn, runId, update);
    assertNotNull(tracker.getProgressState(pipelineFqn, runId));

    tracker.clearProgressState(pipelineFqn, runId);
    assertNull(tracker.getProgressState(pipelineFqn, runId));
  }

  @Test
  void testMultiplePipelines() {
    String pipeline1 = "service1.pipeline1";
    String pipeline2 = "service2.pipeline2";
    UUID runId1 = UUID.randomUUID();
    UUID runId2 = UUID.randomUUID();

    ProgressUpdate update1 =
        new ProgressUpdate()
            .withRunId(runId1.toString())
            .withTimestamp(System.currentTimeMillis())
            .withUpdateType(ProgressUpdateType.PROCESSING)
            .withMessage("Pipeline 1");

    ProgressUpdate update2 =
        new ProgressUpdate()
            .withRunId(runId2.toString())
            .withTimestamp(System.currentTimeMillis())
            .withUpdateType(ProgressUpdateType.DISCOVERY)
            .withMessage("Pipeline 2");

    tracker.updateProgress(pipeline1, runId1, update1);
    tracker.updateProgress(pipeline2, runId2, update2);

    IngestionProgressTracker.ProgressState state1 = tracker.getProgressState(pipeline1, runId1);
    IngestionProgressTracker.ProgressState state2 = tracker.getProgressState(pipeline2, runId2);

    assertNotNull(state1);
    assertNotNull(state2);
    assertEquals("Pipeline 1", state1.getLatestUpdate().getMessage());
    assertEquals("Pipeline 2", state2.getLatestUpdate().getMessage());
  }

  @Test
  void testMetricsCounters() {
    String pipelineFqn = "service.pipeline";
    UUID runId = UUID.randomUUID();

    ProgressUpdate update =
        new ProgressUpdate()
            .withRunId(runId.toString())
            .withTimestamp(System.currentTimeMillis())
            .withUpdateType(ProgressUpdateType.PROCESSING);

    tracker.updateProgress(pipelineFqn, runId, update);
    tracker.updateProgress(pipelineFqn, runId, update);

    double progressCount =
        meterRegistry.find("om_ingestion_progress_updates_total").counter().count();
    assertEquals(2.0, progressCount);

    OperationMetricsBatch batch =
        new OperationMetricsBatch()
            .withRunId(runId.toString())
            .withStepName("TestSource")
            .withMetrics(new ArrayList<>());

    tracker.addMetricsBatch(pipelineFqn, runId, batch);

    double metricsCount =
        meterRegistry.find("om_operation_metrics_batches_total").counter().count();
    assertEquals(1.0, metricsCount);
  }

  @Test
  void testServiceListenerReceivesAllPipelinesOfService() {
    UUID run1 = UUID.randomUUID();
    UUID run2 = UUID.randomUUID();
    List<ServiceProgressEvent> received = new ArrayList<>();
    tracker.registerServiceListener("svc", received::add);

    tracker.updateProgress("svc.metadata", run1, processing(run1, "m"));
    tracker.updateProgress("svc.lineage", run2, processing(run2, "l"));

    assertEquals(2, received.size());
    assertEquals("svc.metadata", received.get(0).getPipelineFqn());
    assertEquals("svc.lineage", received.get(1).getPipelineFqn());
    assertEquals(run1.toString(), received.get(0).getRunId());
  }

  @Test
  void testServiceListenerIsolation() {
    UUID run = UUID.randomUUID();
    List<ServiceProgressEvent> svcA = new ArrayList<>();
    tracker.registerServiceListener("svcA", svcA::add);

    tracker.updateProgress("svcB.metadata", run, processing(run, "b"));

    assertTrue(svcA.isEmpty());
  }

  @Test
  void testActiveRunSnapshotsReflectLatestAndDropOnTerminal() {
    UUID run1 = UUID.randomUUID();
    UUID run2 = UUID.randomUUID();
    tracker.updateProgress("svc.metadata", run1, processing(run1, "m1"));
    tracker.updateProgress("svc.metadata", run1, processing(run1, "m2"));
    tracker.updateProgress("svc.lineage", run2, processing(run2, "l1"));

    List<ServiceProgressEvent> snaps = tracker.getActiveRunSnapshots("svc");
    assertEquals(2, snaps.size());

    tracker.updateProgress("svc.metadata", run1, terminal(run1));

    List<ServiceProgressEvent> after = tracker.getActiveRunSnapshots("svc");
    assertEquals(1, after.size());
    assertEquals("svc.lineage", after.get(0).getPipelineFqn());
  }

  @Test
  void testTerminalEventIsForwardedBeforeDrop() {
    UUID run = UUID.randomUUID();
    List<ServiceProgressEvent> received = new ArrayList<>();
    tracker.registerServiceListener("svc", received::add);

    tracker.updateProgress("svc.metadata", run, processing(run, "p"));
    tracker.updateProgress("svc.metadata", run, terminal(run));

    assertEquals(2, received.size());
    assertEquals(ProgressUpdateType.PIPELINE_COMPLETE, received.get(1).getEvent().getUpdateType());
    assertTrue(tracker.getActiveRunSnapshots("svc").isEmpty());
  }

  @Test
  void testUnregisterServiceListenerStopsDelivery() {
    UUID run = UUID.randomUUID();
    List<ServiceProgressEvent> received = new ArrayList<>();
    Consumer<ServiceProgressEvent> listener = received::add;
    tracker.registerServiceListener("svc", listener);
    tracker.updateProgress("svc.metadata", run, processing(run, "a"));
    tracker.unregisterServiceListener("svc", listener);
    tracker.updateProgress("svc.metadata", run, processing(run, "b"));
    assertEquals(1, received.size());
  }

  @Test
  void serviceEventCarriesIngestionPipelineWhenProvided() {
    UUID run = UUID.randomUUID();
    List<ServiceProgressEvent> received = new ArrayList<>();
    tracker.registerServiceListener("svc", received::add);

    IngestionPipeline pipeline =
        new IngestionPipeline().withName("metadata").withFullyQualifiedName("svc.metadata");
    tracker.updateProgress("svc.metadata", run, discovery(run), pipeline);

    assertEquals(1, received.size());
    assertNotNull(received.get(0).getIngestionPipeline());
    assertEquals("svc.metadata", received.get(0).getIngestionPipeline().getFullyQualifiedName());
  }

  @Test
  void serviceEventHasNoIngestionPipelineByDefault() {
    UUID run = UUID.randomUUID();
    List<ServiceProgressEvent> received = new ArrayList<>();
    tracker.registerServiceListener("svc", received::add);

    tracker.updateProgress("svc.metadata", run, processing(run, "p"));

    assertEquals(1, received.size());
    assertNull(received.get(0).getIngestionPipeline());
  }

  private static ProgressUpdate discovery(UUID runId) {
    return new ProgressUpdate()
        .withRunId(runId.toString())
        .withTimestamp(System.currentTimeMillis())
        .withUpdateType(ProgressUpdateType.DISCOVERY);
  }

  private static ProgressUpdate processing(UUID runId, String msg) {
    return new ProgressUpdate()
        .withRunId(runId.toString())
        .withTimestamp(System.currentTimeMillis())
        .withUpdateType(ProgressUpdateType.PROCESSING)
        .withMessage(msg);
  }

  private static ProgressUpdate terminal(UUID runId) {
    return new ProgressUpdate()
        .withRunId(runId.toString())
        .withTimestamp(System.currentTimeMillis())
        .withUpdateType(ProgressUpdateType.PIPELINE_COMPLETE);
  }
}
