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

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Singleton
public class StreamableLogsMetrics {
  private final MeterRegistry meterRegistry;

  private final Counter logsSentCounter;
  private final Counter logsFailedCounter;
  private final Timer logShipmentLatency;
  private final DistributionSummary compressionRatio;
  private final DistributionSummary batchSize;

  private final AtomicInteger circuitBreakerState;
  private final Counter circuitBreakerTrips;
  private final Counter circuitBreakerRecoveries;

  private final AtomicLong currentQueueSize;
  private final Counter queueOverflows;
  private final Gauge queueUtilization;

  private final Counter s3WritesCounter;
  private final Counter s3ReadsCounter;
  private final Counter s3ErrorsCounter;
  private final Timer s3OperationLatency;
  private final AtomicInteger activeMultipartUploads;
  private final AtomicLong s3WriteThroughputBytes;
  private final AtomicInteger pendingPartUploads;

  private final Counter sessionCreated;
  private final Counter sessionReused;
  private final AtomicInteger activeSessions;

  private final Counter ingestionLogsQueued;
  private final Counter ingestionLogsDropped;
  private final Counter ingestionFallbackActive;

  public static final int STATE_CLOSED = 0;
  public static final int STATE_OPEN = 1;
  public static final int STATE_HALF_OPEN = 2;

  @Inject
  public StreamableLogsMetrics(MeterRegistry meterRegistry) {
    this.meterRegistry = meterRegistry;

    this.logsSentCounter =
        Counter.builder("om_streamable_logs_sent_total")
            .description("Total number of successfully shipped log batches")
            .register(meterRegistry);

    this.logsFailedCounter =
        Counter.builder("om_streamable_logs_failed_total")
            .description("Total number of failed log shipments")
            .register(meterRegistry);

    this.logShipmentLatency =
        Timer.builder("om_streamable_logs_latency_seconds")
            .description("End-to-end latency for log shipment")
            .publishPercentiles(0.5, 0.95, 0.99)
            .publishPercentileHistogram()
            .register(meterRegistry);

    this.compressionRatio =
        DistributionSummary.builder("om_streamable_logs_compression_ratio")
            .description("Compression effectiveness (compressed/original)")
            .publishPercentiles(0.5, 0.95)
            .register(meterRegistry);

    this.batchSize =
        DistributionSummary.builder("om_streamable_logs_batch_size")
            .description("Number of log lines per batch")
            .publishPercentiles(0.5, 0.95, 0.99)
            .register(meterRegistry);

    this.circuitBreakerState = new AtomicInteger(STATE_CLOSED);
    Gauge.builder(
            "om_streamable_logs_circuit_breaker_state", circuitBreakerState, AtomicInteger::get)
        .description("Circuit breaker state (0=closed, 1=open, 2=half-open)")
        .register(meterRegistry);

    this.circuitBreakerTrips =
        Counter.builder("om_streamable_logs_circuit_breaker_trips_total")
            .description("Total number of circuit breaker trips")
            .register(meterRegistry);

    this.circuitBreakerRecoveries =
        Counter.builder("om_streamable_logs_circuit_breaker_recoveries_total")
            .description("Total number of circuit breaker recoveries")
            .register(meterRegistry);

    this.currentQueueSize = new AtomicLong(0);
    Gauge.builder("om_streamable_logs_queue_size", currentQueueSize, AtomicLong::get)
        .description("Current number of logs in queue")
        .register(meterRegistry);

    this.queueOverflows =
        Counter.builder("om_streamable_logs_queue_overflows_total")
            .description("Total number of queue overflow events")
            .register(meterRegistry);

    this.queueUtilization =
        Gauge.builder(
                "om_streamable_logs_queue_utilization",
                this,
                StreamableLogsMetrics::calculateQueueUtilization)
            .description("Queue utilization percentage (0-1)")
            .register(meterRegistry);

    this.s3WritesCounter =
        Counter.builder("om_s3_writes_total")
            .description("Total S3 write operations")
            .tag("operation", "log_write")
            .register(meterRegistry);

    this.s3ReadsCounter =
        Counter.builder("om_s3_reads_total")
            .description("Total S3 read operations")
            .tag("operation", "log_read")
            .register(meterRegistry);

    this.s3ErrorsCounter =
        Counter.builder("om_s3_errors_total")
            .description("Total S3 operation errors")
            .register(meterRegistry);

    this.s3OperationLatency =
        Timer.builder("om_s3_operation_duration_seconds")
            .description("S3 operation latency")
            .publishPercentiles(0.5, 0.95, 0.99)
            .register(meterRegistry);

    this.activeMultipartUploads = new AtomicInteger(0);
    Gauge.builder("om_s3_multipart_uploads_active", activeMultipartUploads, AtomicInteger::get)
        .description("Currently active multipart uploads")
        .register(meterRegistry);

    this.s3WriteThroughputBytes = new AtomicLong(0);
    Gauge.builder("om_s3_write_throughput_bytes", s3WriteThroughputBytes, AtomicLong::get)
        .description("Current S3 write throughput in bytes/sec")
        .register(meterRegistry);

    // Add gauge for pending part uploads
    this.pendingPartUploads = new AtomicInteger(0);
    Gauge.builder("om_s3_pending_part_uploads", pendingPartUploads, AtomicInteger::get)
        .description("Number of pending S3 multipart part uploads")
        .register(meterRegistry);

    this.sessionCreated =
        Counter.builder("om_streamable_logs_sessions_created_total")
            .description("Total number of new sessions created")
            .register(meterRegistry);

    this.sessionReused =
        Counter.builder("om_streamable_logs_sessions_reused_total")
            .description("Total number of session reuses")
            .register(meterRegistry);

    this.activeSessions = new AtomicInteger(0);
    Gauge.builder("om_streamable_logs_sessions_active", activeSessions, AtomicInteger::get)
        .description("Currently active log streaming sessions")
        .register(meterRegistry);

    this.ingestionLogsQueued =
        Counter.builder("om_ingestion_logs_queued_total")
            .description("Total logs queued on ingestion side")
            .register(meterRegistry);

    this.ingestionLogsDropped =
        Counter.builder("om_ingestion_logs_dropped_total")
            .description("Total logs dropped on ingestion side")
            .register(meterRegistry);

    this.ingestionFallbackActive =
        Counter.builder("om_ingestion_fallback_active_total")
            .description("Number of times fallback to local logging was activated")
            .register(meterRegistry);
  }

  public void recordLogsSent(int count) {
    logsSentCounter.increment(count);
  }

  public void recordLogsFailed() {
    logsFailedCounter.increment();
  }

  public Timer.Sample startLogShipment() {
    return Timer.start(meterRegistry);
  }

  public void recordLogShipment(Timer.Sample sample) {
    sample.stop(logShipmentLatency);
  }

  public void recordCompressionRatio(double ratio) {
    compressionRatio.record(ratio);
  }

  public void recordBatchSize(int size) {
    batchSize.record(size);
  }

  public void setCircuitBreakerState(int state) {
    int previousState = circuitBreakerState.getAndSet(state);

    if (previousState != state) {
      if (state == STATE_OPEN) {
        circuitBreakerTrips.increment();
        LOG.warn(
            "Circuit breaker tripped - state changed from {} to OPEN", getStateName(previousState));
      } else if (state == STATE_CLOSED && previousState == STATE_HALF_OPEN) {
        circuitBreakerRecoveries.increment();
        LOG.info("Circuit breaker recovered - state changed to CLOSED");
      }
    }
  }

  private String getStateName(int state) {
    switch (state) {
      case STATE_CLOSED:
        return "CLOSED";
      case STATE_OPEN:
        return "OPEN";
      case STATE_HALF_OPEN:
        return "HALF_OPEN";
      default:
        return "UNKNOWN";
    }
  }

  public void updateQueueSize(long size) {
    currentQueueSize.set(size);
  }

  public void recordQueueOverflow() {
    queueOverflows.increment();
  }

  private double calculateQueueUtilization() {
    return Math.min(1.0, currentQueueSize.get() / 10000.0);
  }

  public void recordS3Write() {
    s3WritesCounter.increment();
  }

  public void recordS3Read() {
    s3ReadsCounter.increment();
  }

  public void recordS3Error() {
    s3ErrorsCounter.increment();
  }

  public Timer.Sample startS3Operation() {
    return Timer.start(meterRegistry);
  }

  // Getter methods for testing
  public long getS3WritesCount() {
    return (long) s3WritesCounter.count();
  }

  public long getS3ReadsCount() {
    return (long) s3ReadsCounter.count();
  }

  public void recordS3Operation(Timer.Sample sample) {
    sample.stop(s3OperationLatency);
  }

  public void incrementMultipartUploads() {
    activeMultipartUploads.incrementAndGet();
  }

  public void decrementMultipartUploads() {
    activeMultipartUploads.decrementAndGet();
  }

  public void updateWriteThroughput(long bytesPerSecond) {
    s3WriteThroughputBytes.set(bytesPerSecond);
  }

  public void updatePendingPartUploads(int count) {
    pendingPartUploads.set(count);
  }

  public void incrementPendingPartUploads() {
    pendingPartUploads.incrementAndGet();
  }

  public void decrementPendingPartUploads() {
    pendingPartUploads.decrementAndGet();
  }

  public void recordSessionCreated() {
    sessionCreated.increment();
    activeSessions.incrementAndGet();
  }

  public void recordSessionReused() {
    sessionReused.increment();
  }

  public void recordSessionClosed() {
    activeSessions.decrementAndGet();
  }

  public void recordIngestionLogsQueued(int count) {
    ingestionLogsQueued.increment(count);
  }

  public void recordIngestionLogsDropped(int count) {
    ingestionLogsDropped.increment(count);
  }

  public void recordIngestionFallbackActive() {
    ingestionFallbackActive.increment();
  }

  public boolean isHealthy() {
    boolean circuitBreakerHealthy = circuitBreakerState.get() != STATE_OPEN;

    double totalAttempts = logsSentCounter.count() + logsFailedCounter.count();
    double failureRate = totalAttempts > 0 ? logsFailedCounter.count() / totalAttempts : 0;
    boolean failureRateHealthy = failureRate < 0.1;

    boolean queueHealthy = currentQueueSize.get() < 8000;

    return circuitBreakerHealthy && failureRateHealthy && queueHealthy;
  }

  public String getHealthStatus() {
    return String.format(
        "CircuitBreaker: %s, QueueSize: %d, FailureRate: %.2f%%",
        getStateName(circuitBreakerState.get()),
        currentQueueSize.get(),
        calculateFailureRate() * 100);
  }

  private double calculateFailureRate() {
    double totalAttempts = logsSentCounter.count() + logsFailedCounter.count();
    return totalAttempts > 0 ? logsFailedCounter.count() / totalAttempts : 0;
  }
}
