package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.lang.reflect.Field;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

@DisplayName("ReindexingMetrics Tests")
class ReindexingMetricsTest {

  private SimpleMeterRegistry meterRegistry;

  @BeforeEach
  void setUp() throws Exception {
    resetSingleton();
    meterRegistry = new SimpleMeterRegistry();
    ReindexingMetrics.initialize(meterRegistry);
  }

  private void resetSingleton() throws Exception {
    Field instanceField = ReindexingMetrics.class.getDeclaredField("instance");
    instanceField.setAccessible(true);
    instanceField.set(null, null);
  }

  @Nested
  @DisplayName("Initialization")
  class InitializationTests {

    @Test
    @DisplayName("getInstance returns non-null after initialize")
    void testGetInstanceAfterInitialize() {
      assertNotNull(ReindexingMetrics.getInstance());
    }

    @Test
    @DisplayName("getInstance returns null before initialize")
    void testGetInstanceBeforeInitialize() throws Exception {
      resetSingleton();
      assertNull(ReindexingMetrics.getInstance());
    }

    @Test
    @DisplayName("Double initialization is idempotent")
    void testDoubleInitialize() {
      ReindexingMetrics first = ReindexingMetrics.getInstance();
      SimpleMeterRegistry secondRegistry = new SimpleMeterRegistry();
      ReindexingMetrics.initialize(secondRegistry);
      assertEquals(first, ReindexingMetrics.getInstance());
    }

    @Test
    @DisplayName("All metrics are registered")
    void testAllMetricsRegistered() {
      assertNotNull(meterRegistry.find("reindexing.jobs").tag("status", "started").counter());
      assertNotNull(meterRegistry.find("reindexing.jobs").tag("status", "completed").counter());
      assertNotNull(meterRegistry.find("reindexing.jobs").tag("status", "failed").counter());
      assertNotNull(meterRegistry.find("reindexing.jobs").tag("status", "stopped").counter());

      assertNotNull(
          meterRegistry.find("reindexing.job.duration").tag("status", "completed").timer());
      assertNotNull(meterRegistry.find("reindexing.job.duration").tag("status", "failed").timer());
      assertNotNull(meterRegistry.find("reindexing.job.duration").tag("status", "stopped").timer());

      assertNotNull(meterRegistry.find("reindexing.jobs.active").gauge());

      assertNotNull(meterRegistry.find("reindexing.bulk.duration").tag("success", "true").timer());
      assertNotNull(meterRegistry.find("reindexing.bulk.duration").tag("success", "false").timer());
      assertNotNull(meterRegistry.find("reindexing.bulk.payload.size").summary());
      assertNotNull(meterRegistry.find("reindexing.sink.pending").gauge());
      assertNotNull(meterRegistry.find("reindexing.backpressure.events").counter());
    }
  }

  @Nested
  @DisplayName("Job Lifecycle")
  class JobLifecycleTests {

    @Test
    @DisplayName("recordJobStarted increments counter and active gauge")
    void testRecordJobStarted() {
      ReindexingMetrics metrics = ReindexingMetrics.getInstance();
      metrics.recordJobStarted();

      assertEquals(1, getCounterValue("reindexing.jobs", "status", "started"));
      assertEquals(1.0, getGaugeValue("reindexing.jobs.active"));
    }

    @Test
    @DisplayName("recordJobCompleted increments counter and decrements active gauge")
    void testRecordJobCompleted() {
      ReindexingMetrics metrics = ReindexingMetrics.getInstance();
      metrics.recordJobStarted();
      Timer.Sample sample = metrics.startJobTimer();
      metrics.recordJobCompleted(sample);

      assertEquals(1, getCounterValue("reindexing.jobs", "status", "completed"));
      assertEquals(0.0, getGaugeValue("reindexing.jobs.active"));

      Timer timer =
          meterRegistry.find("reindexing.job.duration").tag("status", "completed").timer();
      assertNotNull(timer);
      assertEquals(1, timer.count());
    }

    @Test
    @DisplayName("recordJobFailed increments counter and decrements active gauge")
    void testRecordJobFailed() {
      ReindexingMetrics metrics = ReindexingMetrics.getInstance();
      metrics.recordJobStarted();
      Timer.Sample sample = metrics.startJobTimer();
      metrics.recordJobFailed(sample);

      assertEquals(1, getCounterValue("reindexing.jobs", "status", "failed"));
      assertEquals(0.0, getGaugeValue("reindexing.jobs.active"));

      Timer timer = meterRegistry.find("reindexing.job.duration").tag("status", "failed").timer();
      assertNotNull(timer);
      assertEquals(1, timer.count());
    }

    @Test
    @DisplayName("recordJobStopped increments counter and decrements active gauge")
    void testRecordJobStopped() {
      ReindexingMetrics metrics = ReindexingMetrics.getInstance();
      metrics.recordJobStarted();
      Timer.Sample sample = metrics.startJobTimer();
      metrics.recordJobStopped(sample);

      assertEquals(1, getCounterValue("reindexing.jobs", "status", "stopped"));
      assertEquals(0.0, getGaugeValue("reindexing.jobs.active"));

      Timer timer = meterRegistry.find("reindexing.job.duration").tag("status", "stopped").timer();
      assertNotNull(timer);
      assertEquals(1, timer.count());
    }

    @Test
    @DisplayName("recordJobCompleted handles null sample gracefully")
    void testRecordJobCompletedNullSample() {
      ReindexingMetrics metrics = ReindexingMetrics.getInstance();
      metrics.recordJobStarted();
      metrics.recordJobCompleted(null);

      assertEquals(1, getCounterValue("reindexing.jobs", "status", "completed"));
      Timer timer =
          meterRegistry.find("reindexing.job.duration").tag("status", "completed").timer();
      assertNotNull(timer);
      assertEquals(0, timer.count());
    }

    @Test
    @DisplayName("Multiple jobs tracked correctly")
    void testMultipleJobs() {
      ReindexingMetrics metrics = ReindexingMetrics.getInstance();
      metrics.recordJobStarted();
      metrics.recordJobStarted();
      assertEquals(2.0, getGaugeValue("reindexing.jobs.active"));

      metrics.recordJobCompleted(null);
      assertEquals(1.0, getGaugeValue("reindexing.jobs.active"));

      metrics.recordJobFailed(null);
      assertEquals(0.0, getGaugeValue("reindexing.jobs.active"));

      assertEquals(2, getCounterValue("reindexing.jobs", "status", "started"));
      assertEquals(1, getCounterValue("reindexing.jobs", "status", "completed"));
      assertEquals(1, getCounterValue("reindexing.jobs", "status", "failed"));
    }
  }

  @Nested
  @DisplayName("Stage Counters")
  class StageCounterTests {

    @Test
    @DisplayName("recordStageSuccess creates counter with correct tags")
    void testRecordStageSuccess() {
      ReindexingMetrics metrics = ReindexingMetrics.getInstance();
      metrics.recordStageSuccess("reader", "table", 10);

      Counter counter =
          meterRegistry
              .find("reindexing.stage.success")
              .tag("stage", "reader")
              .tag("entity_type", "table")
              .counter();
      assertNotNull(counter);
      assertEquals(10.0, counter.count());
    }

    @Test
    @DisplayName("recordStageFailed creates counter with correct tags")
    void testRecordStageFailed() {
      ReindexingMetrics metrics = ReindexingMetrics.getInstance();
      metrics.recordStageFailed("sink", "dashboard", 3);

      Counter counter =
          meterRegistry
              .find("reindexing.stage.failed")
              .tag("stage", "sink")
              .tag("entity_type", "dashboard")
              .counter();
      assertNotNull(counter);
      assertEquals(3.0, counter.count());
    }

    @Test
    @DisplayName("recordStageWarnings creates counter with correct tags")
    void testRecordStageWarnings() {
      ReindexingMetrics metrics = ReindexingMetrics.getInstance();
      metrics.recordStageWarnings("reader", "pipeline", 5);

      Counter counter =
          meterRegistry
              .find("reindexing.stage.warnings")
              .tag("stage", "reader")
              .tag("entity_type", "pipeline")
              .counter();
      assertNotNull(counter);
      assertEquals(5.0, counter.count());
    }

    @Test
    @DisplayName("Stage counters accumulate across calls")
    void testStageCountersAccumulate() {
      ReindexingMetrics metrics = ReindexingMetrics.getInstance();
      metrics.recordStageSuccess("process", "table", 100);
      metrics.recordStageSuccess("process", "table", 50);

      Counter counter =
          meterRegistry
              .find("reindexing.stage.success")
              .tag("stage", "process")
              .tag("entity_type", "table")
              .counter();
      assertNotNull(counter);
      assertEquals(150.0, counter.count());
    }

    @Test
    @DisplayName("Different entity types produce separate counters")
    void testDifferentEntityTypes() {
      ReindexingMetrics metrics = ReindexingMetrics.getInstance();
      metrics.recordStageSuccess("reader", "table", 10);
      metrics.recordStageSuccess("reader", "topic", 20);

      Counter tableCounter =
          meterRegistry
              .find("reindexing.stage.success")
              .tag("stage", "reader")
              .tag("entity_type", "table")
              .counter();
      Counter topicCounter =
          meterRegistry
              .find("reindexing.stage.success")
              .tag("stage", "reader")
              .tag("entity_type", "topic")
              .counter();
      assertNotNull(tableCounter);
      assertNotNull(topicCounter);
      assertEquals(10.0, tableCounter.count());
      assertEquals(20.0, topicCounter.count());
    }
  }

  @Nested
  @DisplayName("Bulk Request Metrics")
  class BulkRequestTests {

    @Test
    @DisplayName("Bulk request timer records successful request")
    void testBulkRequestSuccess() {
      ReindexingMetrics metrics = ReindexingMetrics.getInstance();
      Timer.Sample sample = metrics.startBulkRequestTimer();
      metrics.recordBulkRequestCompleted(sample, true);

      Timer timer = meterRegistry.find("reindexing.bulk.duration").tag("success", "true").timer();
      assertNotNull(timer);
      assertEquals(1, timer.count());
    }

    @Test
    @DisplayName("Bulk request timer records failed request")
    void testBulkRequestFailure() {
      ReindexingMetrics metrics = ReindexingMetrics.getInstance();
      Timer.Sample sample = metrics.startBulkRequestTimer();
      metrics.recordBulkRequestCompleted(sample, false);

      Timer timer = meterRegistry.find("reindexing.bulk.duration").tag("success", "false").timer();
      assertNotNull(timer);
      assertEquals(1, timer.count());
    }

    @Test
    @DisplayName("recordBulkRequestCompleted handles null sample gracefully")
    void testBulkRequestNullSample() {
      ReindexingMetrics metrics = ReindexingMetrics.getInstance();
      metrics.recordBulkRequestCompleted(null, true);

      Timer timer = meterRegistry.find("reindexing.bulk.duration").tag("success", "true").timer();
      assertNotNull(timer);
      assertEquals(0, timer.count());
    }

    @Test
    @DisplayName("Payload size is recorded in distribution summary")
    void testRecordPayloadSize() {
      ReindexingMetrics metrics = ReindexingMetrics.getInstance();
      metrics.recordPayloadSize(1024);
      metrics.recordPayloadSize(2048);

      DistributionSummary summary = meterRegistry.find("reindexing.bulk.payload.size").summary();
      assertNotNull(summary);
      assertEquals(2, summary.count());
      assertEquals(3072.0, summary.totalAmount());
    }

    @Test
    @DisplayName("Pending bulk requests gauge tracks increment and decrement")
    void testPendingBulkRequests() {
      ReindexingMetrics metrics = ReindexingMetrics.getInstance();
      metrics.incrementPendingBulkRequests();
      metrics.incrementPendingBulkRequests();
      assertEquals(2.0, getGaugeValue("reindexing.sink.pending"));

      metrics.decrementPendingBulkRequests();
      assertEquals(1.0, getGaugeValue("reindexing.sink.pending"));
    }
  }

  @Nested
  @DisplayName("Backpressure")
  class BackpressureTests {

    @Test
    @DisplayName("recordBackpressureEvent increments counter")
    void testRecordBackpressureEvent() {
      ReindexingMetrics metrics = ReindexingMetrics.getInstance();
      metrics.recordBackpressureEvent();
      metrics.recordBackpressureEvent();
      metrics.recordBackpressureEvent();

      assertEquals(3, getCounterValue("reindexing.backpressure.events"));
    }
  }

  @Nested
  @DisplayName("Promotion Metrics")
  class PromotionTests {

    @Test
    @DisplayName("recordPromotionSuccess creates counter with correct tags")
    void testRecordPromotionSuccess() {
      ReindexingMetrics metrics = ReindexingMetrics.getInstance();
      metrics.recordPromotionSuccess("table");

      Counter counter =
          meterRegistry
              .find("reindexing.promotion")
              .tag("entity_type", "table")
              .tag("result", "success")
              .counter();
      assertNotNull(counter);
      assertEquals(1.0, counter.count());
    }

    @Test
    @DisplayName("recordPromotionFailure creates counter with correct tags")
    void testRecordPromotionFailure() {
      ReindexingMetrics metrics = ReindexingMetrics.getInstance();
      metrics.recordPromotionFailure("dashboard");

      Counter counter =
          meterRegistry
              .find("reindexing.promotion")
              .tag("entity_type", "dashboard")
              .tag("result", "failure")
              .counter();
      assertNotNull(counter);
      assertEquals(1.0, counter.count());
    }

    @Test
    @DisplayName("Promotion success and failure tracked independently per entity type")
    void testPromotionPerEntityType() {
      ReindexingMetrics metrics = ReindexingMetrics.getInstance();
      metrics.recordPromotionSuccess("table");
      metrics.recordPromotionSuccess("table");
      metrics.recordPromotionFailure("table");
      metrics.recordPromotionSuccess("topic");

      Counter tableSuccess =
          meterRegistry
              .find("reindexing.promotion")
              .tag("entity_type", "table")
              .tag("result", "success")
              .counter();
      Counter tableFailure =
          meterRegistry
              .find("reindexing.promotion")
              .tag("entity_type", "table")
              .tag("result", "failure")
              .counter();
      Counter topicSuccess =
          meterRegistry
              .find("reindexing.promotion")
              .tag("entity_type", "topic")
              .tag("result", "success")
              .counter();

      assertNotNull(tableSuccess);
      assertNotNull(tableFailure);
      assertNotNull(topicSuccess);
      assertEquals(2.0, tableSuccess.count());
      assertEquals(1.0, tableFailure.count());
      assertEquals(1.0, topicSuccess.count());
    }
  }

  private long getCounterValue(String name) {
    Counter counter = meterRegistry.find(name).counter();
    return counter != null ? (long) counter.count() : 0;
  }

  private long getCounterValue(String name, String tagKey, String tagValue) {
    Counter counter = meterRegistry.find(name).tag(tagKey, tagValue).counter();
    return counter != null ? (long) counter.count() : 0;
  }

  private double getGaugeValue(String name) {
    Gauge gauge = meterRegistry.find(name).gauge();
    return gauge != null ? gauge.value() : 0.0;
  }
}
