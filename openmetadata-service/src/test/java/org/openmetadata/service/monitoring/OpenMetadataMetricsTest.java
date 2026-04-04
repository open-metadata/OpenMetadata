package org.openmetadata.service.monitoring;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import io.micrometer.prometheusmetrics.PrometheusConfig;
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OpenMetadataMetricsTest {

  private SimpleMeterRegistry registry;

  @BeforeEach
  void setUp() {
    registry = new SimpleMeterRegistry();
  }

  @Test
  void dbConnectionsTotalReflectsHikariCPPoolSize() {
    AtomicInteger activeConnections = new AtomicInteger(5);
    AtomicInteger idleConnections = new AtomicInteger(15);

    Gauge.builder("hikaricp.connections.active", activeConnections, AtomicInteger::doubleValue)
        .register(registry);
    Gauge.builder("hikaricp.connections.idle", idleConnections, AtomicInteger::doubleValue)
        .register(registry);

    new OpenMetadataMetrics(registry);

    Gauge total = registry.find("db.connections.total").gauge();
    assertNotNull(total, "db.connections.total gauge should be registered");
    assertEquals(20.0, total.value(), 0.01, "Should equal active + idle");

    activeConnections.set(10);
    idleConnections.set(10);
    assertEquals(20.0, total.value(), 0.01, "Should reflect updated pool state");

    activeConnections.set(0);
    idleConnections.set(0);
    assertEquals(0.0, total.value(), 0.01, "Should be zero when pool is empty");
  }

  @Test
  void dbConnectionsTotalReturnsZeroWithoutHikariCP() {
    new OpenMetadataMetrics(registry);

    Gauge total = registry.find("db.connections.total").gauge();
    assertNotNull(total, "db.connections.total gauge should be registered");
    assertEquals(0.0, total.value(), 0.01, "Should be zero when HikariCP metrics are absent");
  }

  @Test
  void prometheusScrapExposesDbConnectionsTotal() {
    PrometheusMeterRegistry promRegistry = new PrometheusMeterRegistry(PrometheusConfig.DEFAULT);

    AtomicInteger activeConnections = new AtomicInteger(3);
    AtomicInteger idleConnections = new AtomicInteger(7);

    Gauge.builder("hikaricp.connections.active", activeConnections, AtomicInteger::doubleValue)
        .register(promRegistry);
    Gauge.builder("hikaricp.connections.idle", idleConnections, AtomicInteger::doubleValue)
        .register(promRegistry);

    new OpenMetadataMetrics(promRegistry);

    String scrape = promRegistry.scrape();
    assertTrue(
        scrape.contains("db_connections_total"),
        "Prometheus scrape should contain db_connections_total metric");
    assertTrue(
        scrape.contains("# TYPE db_connections_total gauge"),
        "db_connections_total should be exposed as a gauge type");
  }
}
