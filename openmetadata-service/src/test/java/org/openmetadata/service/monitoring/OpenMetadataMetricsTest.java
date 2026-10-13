/*
 *  Copyright 2026 Collate
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.zaxxer.hikari.metrics.IMetricsTracker;
import com.zaxxer.hikari.metrics.PoolStats;
import com.zaxxer.hikari.metrics.micrometer.MicrometerMetricsTrackerFactory;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import io.micrometer.prometheusmetrics.PrometheusConfig;
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry;
import java.lang.ref.WeakReference;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * {@code db.pool.connections} replaces a Counter that nothing ever incremented, so
 * {@code db_connections_total} sat at zero for every deployment that scraped it (#26555).
 *
 * <p>The gauge derives its value from HikariCP's own instrumentation, so these tests drive the real
 * {@link MicrometerMetricsTrackerFactory} rather than hand-registering meters under names HikariCP
 * is merely assumed to use — a rename upstream has to fail here, not in production.
 */
class OpenMetadataMetricsTest {
  private static final String REQUEST_POOL = "openmetadata-hikari-pool";
  private static final String QUARTZ_POOL = "openmetadata-quartz-pool";
  private static final String POOL_CONNECTIONS = "db.pool.connections";

  private SimpleMeterRegistry registry;

  @BeforeEach
  void setUp() {
    registry = new SimpleMeterRegistry();
  }

  @Test
  void readsZeroBeforeAnyPoolPublishesMetrics() {
    new OpenMetadataMetrics(registry);

    // Metrics are bound during bundle initialization, before the data source exists; a scrape in
    // that window must not blow up on the missing HikariCP gauges.
    assertEquals(0.0, poolConnections(), 0.01);
  }

  @Test
  void reportsConnectionsHeldByThePool() {
    ControllablePoolStats requestPool = new ControllablePoolStats(5, 15);
    try (IMetricsTracker tracker = attachPool(REQUEST_POOL, requestPool)) {
      assertNotNull(tracker);
      new OpenMetadataMetrics(registry);

      assertEquals(20.0, poolConnections(), 0.01);
    }
  }

  @Test
  void followsThePoolAsConnectionsAreBorrowedAndOpened() {
    ControllablePoolStats requestPool = new ControllablePoolStats(5, 15);
    try (IMetricsTracker tracker = attachPool(REQUEST_POOL, requestPool)) {
      assertNotNull(tracker);
      new OpenMetadataMetrics(registry);

      requestPool.set(18, 2);
      assertEquals(
          20.0, poolConnections(), 0.01, "borrowing a connection does not change the total");

      requestPool.set(18, 12);
      assertEquals(30.0, poolConnections(), 0.01, "growing the pool raises the total");
    }
  }

  @Test
  void sumsEveryPoolRatherThanWhicheverOneIsFoundFirst() {
    // The request pool is no longer the only one: the Quartz job stores and the Flowable
    // engine each hold their own. Picking a single gauge would report an arbitrary one.
    try (IMetricsTracker request = attachPool(REQUEST_POOL, new ControllablePoolStats(4, 16));
        IMetricsTracker quartz = attachPool(QUARTZ_POOL, new ControllablePoolStats(1, 2))) {
      assertNotNull(request);
      assertNotNull(quartz);
      new OpenMetadataMetrics(registry);

      assertEquals(23.0, poolConnections(), 0.01);
    }
  }

  @Test
  void dropsPoolsThatHaveBeenShutDown() {
    ControllablePoolStats requestPool = new ControllablePoolStats(4, 16);
    try (IMetricsTracker request = attachPool(REQUEST_POOL, requestPool)) {
      assertNotNull(request);
      new OpenMetadataMetrics(registry);

      // Flowable closes its schema-update pool once the migration is done; its connections are gone
      // and must stop counting.
      IMetricsTracker migration =
          attachPool("openmetadata-flowable-migration", new ControllablePoolStats(0, 10));
      assertEquals(30.0, poolConnections(), 0.01);

      migration.close();
      assertEquals(20.0, poolConnections(), 0.01);
    }
  }

  @Test
  void ignoresPoolsWhoseStatsHaveBeenCollected() {
    // Micrometer holds gauge state weakly: a pool dropped without close() reads NaN until the
    // registry catches up. Left in the sum it would take the whole metric to NaN.
    Gauge.builder("hikaricp.connections", () -> Double.NaN)
        .tag("pool", "collected")
        .register(registry);
    try (IMetricsTracker request = attachPool(REQUEST_POOL, new ControllablePoolStats(4, 16))) {
      assertNotNull(request);
      new OpenMetadataMetrics(registry);

      assertEquals(20.0, poolConnections(), 0.01);
    }
  }

  @Test
  void keepsReadingThePoolAfterGarbageCollection() {
    // Micrometer gauges reference their state weakly unless the builder opts out, and a gauge whose
    // state has been collected reports NaN forever. Registering this one through a supplier that
    // the registry does not hold strongly would swap the always-zero bug for an eventually-NaN one,
    // which no assertion taken immediately after registration can catch.
    try (IMetricsTracker request = attachPool(REQUEST_POOL, new ControllablePoolStats(5, 15))) {
      assertNotNull(request);
      new OpenMetadataMetrics(registry);
      assertEquals(20.0, poolConnections(), 0.01);

      assumeTrue(weakReferencesGetCleared(), "JVM never cleared a weak reference; probe is moot");

      assertEquals(20.0, poolConnections(), 0.01, "gauge must still read HikariCP after a GC");
    }
  }

  /** Runs GC until a throwaway weak reference is cleared, proving the probe above is meaningful. */
  private static boolean weakReferencesGetCleared() {
    WeakReference<Object> canary = new WeakReference<>(new Object());
    for (int attempt = 0; attempt < 20 && canary.get() != null; attempt++) {
      System.gc();
    }
    return canary.get() == null;
  }

  @Test
  void prometheusScrapeExposesTheGauge() {
    PrometheusMeterRegistry prometheusRegistry =
        new PrometheusMeterRegistry(PrometheusConfig.DEFAULT);
    try (IMetricsTracker request =
        attachPool(prometheusRegistry, REQUEST_POOL, new ControllablePoolStats(3, 7))) {
      assertNotNull(request);
      new OpenMetadataMetrics(prometheusRegistry);

      String scrape = prometheusRegistry.scrape();
      assertTrue(
          scrape.contains("# TYPE db_pool_connections gauge"),
          () -> "expected a db_pool_connections gauge in:\n" + scrape);
      assertTrue(
          scrape.contains("db_pool_connections 10.0"),
          () -> "expected db_pool_connections to report the pool size in:\n" + scrape);
      assertFalse(
          scrape.contains("db_connections_total"),
          () -> "the always-zero counter must be gone from:\n" + scrape);
    }
  }

  private double poolConnections() {
    Gauge gauge = registry.find(POOL_CONNECTIONS).gauge();
    assertNotNull(gauge, "db.pool.connections must be registered");
    return gauge.value();
  }

  private IMetricsTracker attachPool(String poolName, PoolStats stats) {
    return attachPool(registry, poolName, stats);
  }

  private static IMetricsTracker attachPool(
      MeterRegistry meterRegistry, String poolName, PoolStats stats) {
    return new MicrometerMetricsTrackerFactory(meterRegistry).create(poolName, stats);
  }

  /** A {@link PoolStats} whose counts the test drives, standing in for a live HikariCP pool. */
  private static final class ControllablePoolStats extends PoolStats {
    private final AtomicInteger active = new AtomicInteger();
    private final AtomicInteger idle = new AtomicInteger();

    private ControllablePoolStats(int active, int idle) {
      super(0L); // never cache, so a change is visible to the very next read
      set(active, idle);
    }

    private void set(int activeConnections, int idleConnections) {
      active.set(activeConnections);
      idle.set(idleConnections);
    }

    @Override
    protected void update() {
      activeConnections = active.get();
      idleConnections = idle.get();
      totalConnections = activeConnections + idleConnections;
      maxConnections = 100;
      minConnections = 10;
      pendingThreads = 0;
    }
  }
}
