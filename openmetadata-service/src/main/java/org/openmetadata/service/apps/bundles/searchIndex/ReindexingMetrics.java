package org.openmetadata.service.apps.bundles.searchIndex;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class ReindexingMetrics {

  private static volatile ReindexingMetrics instance;
  private final MeterRegistry meterRegistry;

  // Job lifecycle
  private final Counter jobsStarted;
  private final Counter jobsCompleted;
  private final Counter jobsFailed;
  private final Counter jobsStopped;
  private final Timer jobDurationCompleted;
  private final Timer jobDurationFailed;
  private final Timer jobDurationStopped;
  private final AtomicLong activeJobs = new AtomicLong();

  // Bulk request metrics
  private final Timer bulkDurationSuccess;
  private final Timer bulkDurationFailure;
  private final DistributionSummary bulkPayloadSize;
  private final AtomicLong pendingBulkRequests = new AtomicLong();

  // Backpressure
  private final Counter backpressureEvents;

  // Circuit breaker
  private final Map<String, Counter> circuitBreakerCounters = new ConcurrentHashMap<>();

  // Vector timeouts
  private final Counter vectorTimeouts;

  // Queue fill ratio gauge
  private final AtomicLong queueFillRatio = new AtomicLong();

  private ReindexingMetrics(MeterRegistry meterRegistry) {
    this.meterRegistry = meterRegistry;

    // Job lifecycle counters
    this.jobsStarted =
        Counter.builder("reindexing.jobs")
            .description("Job lifecycle events")
            .tag("status", "started")
            .register(meterRegistry);

    this.jobsCompleted =
        Counter.builder("reindexing.jobs")
            .description("Job lifecycle events")
            .tag("status", "completed")
            .register(meterRegistry);

    this.jobsFailed =
        Counter.builder("reindexing.jobs")
            .description("Job lifecycle events")
            .tag("status", "failed")
            .register(meterRegistry);

    this.jobsStopped =
        Counter.builder("reindexing.jobs")
            .description("Job lifecycle events")
            .tag("status", "stopped")
            .register(meterRegistry);

    // Job duration timers
    this.jobDurationCompleted =
        Timer.builder("reindexing.job.duration")
            .description("Job wall-clock duration")
            .tag("status", "completed")
            .register(meterRegistry);

    this.jobDurationFailed =
        Timer.builder("reindexing.job.duration")
            .description("Job wall-clock duration")
            .tag("status", "failed")
            .register(meterRegistry);

    this.jobDurationStopped =
        Timer.builder("reindexing.job.duration")
            .description("Job wall-clock duration")
            .tag("status", "stopped")
            .register(meterRegistry);

    // Active jobs gauge
    Gauge.builder("reindexing.jobs.active", activeJobs, AtomicLong::get)
        .description("Currently running reindexing jobs")
        .register(meterRegistry);

    // Bulk request timers with SLA buckets
    this.bulkDurationSuccess =
        Timer.builder("reindexing.bulk.duration")
            .description("Bulk request latency")
            .tag("success", "true")
            .sla(
                Duration.ofMillis(50),
                Duration.ofMillis(100),
                Duration.ofMillis(500),
                Duration.ofSeconds(1),
                Duration.ofSeconds(5),
                Duration.ofSeconds(10),
                Duration.ofSeconds(30))
            .register(meterRegistry);

    this.bulkDurationFailure =
        Timer.builder("reindexing.bulk.duration")
            .description("Bulk request latency")
            .tag("success", "false")
            .sla(
                Duration.ofMillis(50),
                Duration.ofMillis(100),
                Duration.ofMillis(500),
                Duration.ofSeconds(1),
                Duration.ofSeconds(5),
                Duration.ofSeconds(10),
                Duration.ofSeconds(30))
            .register(meterRegistry);

    // Bulk payload size distribution
    this.bulkPayloadSize =
        DistributionSummary.builder("reindexing.bulk.payload.size")
            .description("Payload size in bytes")
            .baseUnit("bytes")
            .serviceLevelObjectives(
                64 * 1024d, 256 * 1024d, 1024 * 1024d, 5 * 1024 * 1024d, 20 * 1024 * 1024d)
            .register(meterRegistry);

    // Pending bulk requests gauge
    Gauge.builder("reindexing.sink.pending", pendingBulkRequests, AtomicLong::get)
        .description("In-flight bulk requests")
        .register(meterRegistry);

    // Backpressure counter
    this.backpressureEvents =
        Counter.builder("reindexing.backpressure.events")
            .description("Backpressure detections")
            .register(meterRegistry);

    // Vector timeouts counter
    this.vectorTimeouts =
        Counter.builder("reindexing.vector.timeouts")
            .description("Vector embedding completion timeouts")
            .register(meterRegistry);

    // Queue fill ratio gauge
    Gauge.builder("reindexing.queue.fill_ratio", queueFillRatio, AtomicLong::get)
        .description("Task queue fill ratio (0-100)")
        .register(meterRegistry);

    LOG.info("Reindexing metrics initialized");
  }

  public static synchronized void initialize(MeterRegistry meterRegistry) {
    if (instance == null) {
      instance = new ReindexingMetrics(meterRegistry);
    }
  }

  public static ReindexingMetrics getInstance() {
    return instance;
  }

  // --- Job lifecycle ---

  public Timer.Sample startJobTimer() {
    return Timer.start(meterRegistry);
  }

  public void recordJobStarted() {
    jobsStarted.increment();
    activeJobs.incrementAndGet();
  }

  public void recordJobCompleted(Timer.Sample sample) {
    jobsCompleted.increment();
    activeJobs.decrementAndGet();
    if (sample != null) {
      sample.stop(jobDurationCompleted);
    }
  }

  public void recordJobFailed(Timer.Sample sample) {
    jobsFailed.increment();
    activeJobs.decrementAndGet();
    if (sample != null) {
      sample.stop(jobDurationFailed);
    }
  }

  public void recordJobStopped(Timer.Sample sample) {
    jobsStopped.increment();
    activeJobs.decrementAndGet();
    if (sample != null) {
      sample.stop(jobDurationStopped);
    }
  }

  // --- Stage counters (dynamic tags) ---

  public void recordStageSuccess(String stage, String entityType, long count) {
    Counter.builder("reindexing.stage.success")
        .description("Records successfully processed per stage")
        .tag("stage", stage)
        .tag("entity_type", entityType)
        .register(meterRegistry)
        .increment(count);
  }

  public void recordStageFailed(String stage, String entityType, long count) {
    Counter.builder("reindexing.stage.failed")
        .description("Records failed per stage")
        .tag("stage", stage)
        .tag("entity_type", entityType)
        .register(meterRegistry)
        .increment(count);
  }

  public void recordStageWarnings(String stage, String entityType, long count) {
    Counter.builder("reindexing.stage.warnings")
        .description("Reader warnings")
        .tag("stage", stage)
        .tag("entity_type", entityType)
        .register(meterRegistry)
        .increment(count);
  }

  // --- Bulk request metrics ---

  public Timer.Sample startBulkRequestTimer() {
    return Timer.start(meterRegistry);
  }

  public void recordBulkRequestCompleted(Timer.Sample sample, boolean success) {
    if (sample != null) {
      sample.stop(success ? bulkDurationSuccess : bulkDurationFailure);
    }
  }

  public void recordPayloadSize(long sizeBytes) {
    bulkPayloadSize.record(sizeBytes);
  }

  public void incrementPendingBulkRequests() {
    pendingBulkRequests.incrementAndGet();
  }

  public void decrementPendingBulkRequests() {
    pendingBulkRequests.decrementAndGet();
  }

  // --- Backpressure ---

  public void recordBackpressureEvent() {
    backpressureEvents.increment();
  }

  // --- Promotion metrics (dynamic tags) ---

  public void recordPromotionSuccess(String entityType) {
    Counter.builder("reindexing.promotion")
        .description("Index promotion events")
        .tag("entity_type", entityType)
        .tag("result", "success")
        .register(meterRegistry)
        .increment();
  }

  public void recordPromotionFailure(String entityType) {
    Counter.builder("reindexing.promotion")
        .description("Index promotion events")
        .tag("entity_type", entityType)
        .tag("result", "failure")
        .register(meterRegistry)
        .increment();
  }

  // --- Circuit breaker ---

  public void recordCircuitBreakerTrip(String transition) {
    circuitBreakerCounters
        .computeIfAbsent(
            transition,
            t ->
                Counter.builder("reindexing.circuitbreaker.trips")
                    .description("Circuit breaker state transitions")
                    .tag("transition", t)
                    .register(meterRegistry))
        .increment();
  }

  // --- Vector timeouts ---

  public void recordVectorTimeout(int pendingCount) {
    vectorTimeouts.increment();
  }

  // --- Queue fill ratio ---

  public void updateQueueFillRatio(int percent) {
    queueFillRatio.set(percent);
  }
}
