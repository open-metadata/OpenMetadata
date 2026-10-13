package org.openmetadata.service.events.scheduled;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** A round that fails or never comes shows in the reconciler's series. */
class ReconcilerMetricsTest {
  private final SimpleMeterRegistry registry = new SimpleMeterRegistry();

  @BeforeEach
  void listen() {
    Metrics.addRegistry(registry);
  }

  @AfterEach
  void stopListening() {
    Metrics.removeRegistry(registry);
  }

  // An alert rule on a series that does not exist yet never fires.
  @Test
  void everySeriesExistsBeforeTheFirstRound() {
    ReconcilerMetrics.started(System.currentTimeMillis());

    for (String outcome : List.of("completed", "partial", ReconcilerMetrics.FAILED)) {
      assertNotNull(
          registry.find(ReconcilerMetrics.ROUNDS).tag("outcome", outcome).counter(), outcome);
    }
    for (String store : ReconcileRound.STORES) {
      assertNotNull(
          registry.find(ReconcilerMetrics.FOREIGN_KEYS).tag("store", store).gauge(), store);
    }
    assertNotNull(registry.find(ReconcilerMetrics.LAST_FINISHED).timeGauge());
  }

  @Test
  void onlyAFinishedRoundMovesTheLastFinishedTime() {
    ReconcilerMetrics.started(1_000L);
    ReconcilerMetrics.failed();
    assertEquals(1_000.0, lastFinishedMs());

    ReconcilerMetrics.finished(round(ReconcileRound.Outcome.PARTIAL, List.of()));
    assertTrue(lastFinishedMs() > 1_000.0, "one alert that cannot be repaired is not a dead loop");
  }

  @Test
  void aFinishedRoundReportsTheKeysThatNameNoAlertByStore() {
    ReconcilerMetrics.finished(round(ReconcileRound.Outcome.COMPLETED, List.of("stray")));

    assertEquals(1.0, foreignKeys(ReconcileRound.JOBS));
    assertEquals(0.0, foreignKeys(ReconcileRound.LEDGER));
  }

  private static ReconcileRound round(ReconcileRound.Outcome outcome, List<String> foreignJobs) {
    return new ReconcileRound(
        outcome,
        1,
        0,
        0,
        Map.of(
            ReconcileRound.ALERTS, List.of(),
            ReconcileRound.JOBS, foreignJobs,
            ReconcileRound.LEDGER, List.of()));
  }

  private double lastFinishedMs() {
    return registry.get(ReconcilerMetrics.LAST_FINISHED).timeGauge().value(TimeUnit.MILLISECONDS);
  }

  private double foreignKeys(String store) {
    return registry.get(ReconcilerMetrics.FOREIGN_KEYS).tag("store", store).gauge().value();
  }
}
