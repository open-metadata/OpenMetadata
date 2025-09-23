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

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.util.TestUtils;

/**
 * Test class for StreamableLogsMetrics.
 * Verifies that all metrics are properly initialized and recorded.
 */
class StreamableLogsMetricsTest {

  private SimpleMeterRegistry meterRegistry;
  private StreamableLogsMetrics metrics;

  @BeforeEach
  void setUp() {
    meterRegistry = new SimpleMeterRegistry();
    metrics = new StreamableLogsMetrics(meterRegistry);
  }

  @Test
  void testMetricsInitialization() {
    assertNotNull(metrics);

    // Verify all counters are registered
    assertNotNull(meterRegistry.find("om_streamable_logs_sent_total").counter());
    assertNotNull(meterRegistry.find("om_streamable_logs_failed_total").counter());
    assertNotNull(meterRegistry.find("om_s3_writes_total").counter());
    assertNotNull(meterRegistry.find("om_s3_reads_total").counter());
    assertNotNull(meterRegistry.find("om_s3_errors_total").counter());
    assertNotNull(meterRegistry.find("om_streamable_logs_circuit_breaker_trips_total").counter());
    assertNotNull(
        meterRegistry.find("om_streamable_logs_circuit_breaker_recoveries_total").counter());
    assertNotNull(meterRegistry.find("om_streamable_logs_queue_overflows_total").counter());
    assertNotNull(meterRegistry.find("om_streamable_logs_sessions_created_total").counter());
    assertNotNull(meterRegistry.find("om_streamable_logs_sessions_reused_total").counter());
    assertNotNull(meterRegistry.find("om_ingestion_logs_queued_total").counter());
    assertNotNull(meterRegistry.find("om_ingestion_logs_dropped_total").counter());

    // Verify timers are registered
    assertNotNull(meterRegistry.find("om_streamable_logs_latency_seconds").timer());
    assertNotNull(meterRegistry.find("om_s3_operation_duration_seconds").timer());

    // Verify gauges are registered
    assertNotNull(meterRegistry.find("om_streamable_logs_circuit_breaker_state").gauge());
    assertNotNull(meterRegistry.find("om_streamable_logs_queue_size").gauge());
    assertNotNull(meterRegistry.find("om_s3_multipart_uploads_active").gauge());
    assertNotNull(meterRegistry.find("om_s3_write_throughput_bytes").gauge());
    assertNotNull(meterRegistry.find("om_streamable_logs_sessions_active").gauge());
  }

  @Test
  void testLogsSentCounter() {
    long initialCount = getCounterValue("om_streamable_logs_sent_total");

    metrics.recordLogsSent(10);

    assertEquals(initialCount + 10, getCounterValue("om_streamable_logs_sent_total"));
  }

  @Test
  void testLogsFailedCounter() {
    long initialCount = getCounterValue("om_streamable_logs_failed_total");

    metrics.recordLogsFailed();

    assertEquals(initialCount + 1, getCounterValue("om_streamable_logs_failed_total"));
  }

  @Test
  void testBatchSize() {
    metrics.recordBatchSize(100);

    // Distribution summary records values, not a simple counter
    DistributionSummary summary = meterRegistry.find("om_streamable_logs_batch_size").summary();
    assertNotNull(summary);
    assertEquals(1, summary.count());
  }

  @Test
  void testCompressionRatio() {
    metrics.recordCompressionRatio(0.65);

    DistributionSummary summary =
        meterRegistry.find("om_streamable_logs_compression_ratio").summary();
    assertNotNull(summary);
    assertEquals(1, summary.count());
  }

  @Test
  void testS3Operations() {
    long initialWrites = getCounterValue("om_s3_writes_total");
    long initialReads = getCounterValue("om_s3_reads_total");
    long initialErrors = getCounterValue("om_s3_errors_total");

    metrics.recordS3Write();
    metrics.recordS3Read();
    metrics.recordS3Error();

    assertEquals(initialWrites + 1, getCounterValue("om_s3_writes_total"));
    assertEquals(initialReads + 1, getCounterValue("om_s3_reads_total"));
    assertEquals(initialErrors + 1, getCounterValue("om_s3_errors_total"));
  }

  @Test
  void testCircuitBreakerMetrics() {
    metrics.setCircuitBreakerState(StreamableLogsMetrics.STATE_OPEN);
    assertEquals(1.0, getGaugeValue("om_streamable_logs_circuit_breaker_state"));

    metrics.setCircuitBreakerState(StreamableLogsMetrics.STATE_CLOSED);
    assertEquals(0.0, getGaugeValue("om_streamable_logs_circuit_breaker_state"));
  }

  @Test
  void testMultipartUploadMetrics() {
    double initialActive = getGaugeValue("om_s3_multipart_uploads_active");

    metrics.incrementMultipartUploads();
    assertEquals(initialActive + 1, getGaugeValue("om_s3_multipart_uploads_active"));

    metrics.decrementMultipartUploads();
    assertEquals(initialActive, getGaugeValue("om_s3_multipart_uploads_active"));
  }

  @Test
  void testQueueMetrics() {
    long initialOverflows = getCounterValue("om_streamable_logs_queue_overflows_total");

    metrics.updateQueueSize(100);
    assertEquals(100.0, getGaugeValue("om_streamable_logs_queue_size"));

    metrics.recordQueueOverflow();
    assertEquals(initialOverflows + 1, getCounterValue("om_streamable_logs_queue_overflows_total"));
  }

  @Test
  void testSessionMetrics() {
    long initialCreated = getCounterValue("om_streamable_logs_sessions_created_total");
    long initialReused = getCounterValue("om_streamable_logs_sessions_reused_total");
    double initialActive = getGaugeValue("om_streamable_logs_sessions_active");

    metrics.recordSessionCreated();
    assertEquals(initialCreated + 1, getCounterValue("om_streamable_logs_sessions_created_total"));
    assertEquals(initialActive + 1, getGaugeValue("om_streamable_logs_sessions_active"));

    metrics.recordSessionReused();
    assertEquals(initialReused + 1, getCounterValue("om_streamable_logs_sessions_reused_total"));

    metrics.recordSessionClosed();
    assertEquals(initialActive, getGaugeValue("om_streamable_logs_sessions_active"));
  }

  @Test
  void testThroughputMetrics() {
    metrics.updateWriteThroughput(1024000L);
    assertEquals(1024000.0, getGaugeValue("om_s3_write_throughput_bytes"));
  }

  @Test
  void testTimerMetrics() {
    Timer timer = meterRegistry.find("om_streamable_logs_latency_seconds").timer();
    assertNotNull(timer);

    Timer.Sample sample = Timer.start(meterRegistry);
    assertNotNull(sample);
    TestUtils.simulateWork(10);

    metrics.recordLogShipment(sample);

    assertTrue(timer.count() > 0);
    assertTrue(timer.totalTime(TimeUnit.MILLISECONDS) > 0);
  }

  @Test
  void testS3OperationTimer() {
    Timer timer = meterRegistry.find("om_s3_operation_duration_seconds").timer();
    assertNotNull(timer);

    Timer.Sample sample = Timer.start(meterRegistry);
    assertNotNull(sample);

    TestUtils.simulateWork(5);

    metrics.recordS3Operation(sample);

    assertTrue(timer.count() > 0);
    assertTrue(timer.totalTime(TimeUnit.MILLISECONDS) > 0);
  }

  @Test
  void testIngestionMetrics() {
    long initialQueued = getCounterValue("om_ingestion_logs_queued_total");
    long initialDropped = getCounterValue("om_ingestion_logs_dropped_total");
    long initialFallback = getCounterValue("om_ingestion_fallback_active_total");

    metrics.recordIngestionLogsQueued(5);
    assertEquals(initialQueued + 5, getCounterValue("om_ingestion_logs_queued_total"));

    metrics.recordIngestionLogsDropped(2);
    assertEquals(initialDropped + 2, getCounterValue("om_ingestion_logs_dropped_total"));

    metrics.recordIngestionFallbackActive();
    assertEquals(initialFallback + 1, getCounterValue("om_ingestion_fallback_active_total"));
  }

  @Test
  void testHealthCheck() {
    // Initially healthy
    assertTrue(metrics.isHealthy());
    assertNotNull(metrics.getHealthStatus());
    assertTrue(metrics.getHealthStatus().contains("CircuitBreaker: CLOSED"));

    // Simulate high failure rate
    for (int i = 0; i < 15; i++) {
      metrics.recordLogsFailed();
    }
    metrics.recordLogsSent(5); // Few successes

    // Should still be healthy if circuit breaker is closed and queue is low
    if (metrics.isHealthy()) {
      assertTrue(
          getGaugeValue("om_streamable_logs_circuit_breaker_state")
              != StreamableLogsMetrics.STATE_OPEN);
      assertTrue(getGaugeValue("om_streamable_logs_queue_size") < 8000);
    }

    // Trip circuit breaker - should be unhealthy
    metrics.setCircuitBreakerState(StreamableLogsMetrics.STATE_OPEN);
    assertFalse(metrics.isHealthy());
    assertTrue(metrics.getHealthStatus().contains("CircuitBreaker: OPEN"));

    // High queue size also makes it unhealthy
    metrics.setCircuitBreakerState(StreamableLogsMetrics.STATE_CLOSED);
    metrics.updateQueueSize(9000);
    assertFalse(metrics.isHealthy());
  }

  @Test
  void testCircuitBreakerStateTransitions() {
    long initialTrips = getCounterValue("om_streamable_logs_circuit_breaker_trips_total");
    long initialRecoveries = getCounterValue("om_streamable_logs_circuit_breaker_recoveries_total");

    // Initial state should be CLOSED
    assertEquals(
        StreamableLogsMetrics.STATE_CLOSED,
        getGaugeValue("om_streamable_logs_circuit_breaker_state"));

    // Trip the circuit breaker
    metrics.setCircuitBreakerState(StreamableLogsMetrics.STATE_OPEN);
    assertEquals(
        StreamableLogsMetrics.STATE_OPEN,
        getGaugeValue("om_streamable_logs_circuit_breaker_state"));
    assertEquals(
        initialTrips + 1, getCounterValue("om_streamable_logs_circuit_breaker_trips_total"));

    // Move to HALF_OPEN
    metrics.setCircuitBreakerState(StreamableLogsMetrics.STATE_HALF_OPEN);
    assertEquals(
        StreamableLogsMetrics.STATE_HALF_OPEN,
        getGaugeValue("om_streamable_logs_circuit_breaker_state"));

    // Recover to CLOSED
    metrics.setCircuitBreakerState(StreamableLogsMetrics.STATE_CLOSED);
    assertEquals(
        StreamableLogsMetrics.STATE_CLOSED,
        getGaugeValue("om_streamable_logs_circuit_breaker_state"));
    assertEquals(
        initialRecoveries + 1,
        getCounterValue("om_streamable_logs_circuit_breaker_recoveries_total"));
  }

  @Test
  void testS3MetricsGetters() {
    // Test the getter methods for S3 metrics
    long initialWrites = metrics.getS3WritesCount();
    long initialReads = metrics.getS3ReadsCount();

    metrics.recordS3Write();
    metrics.recordS3Write();
    assertEquals(initialWrites + 2, metrics.getS3WritesCount());

    metrics.recordS3Read();
    assertEquals(initialReads + 1, metrics.getS3ReadsCount());
  }

  private long getCounterValue(String name) {
    Counter counter = meterRegistry.find(name).counter();
    return counter != null ? (long) counter.count() : 0;
  }

  private double getGaugeValue(String name) {
    Gauge gauge = meterRegistry.find(name).gauge();
    return gauge != null ? gauge.value() : 0.0;
  }
}
