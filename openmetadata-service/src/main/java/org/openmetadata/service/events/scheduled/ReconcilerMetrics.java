package org.openmetadata.service.events.scheduled;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.TimeGauge;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * What the reconciler reports about its rounds. Every series exists from the start, so a round that
 * fails or never comes is visible: the last finished round's time stops moving. The state is static
 * because a meter is registered once per process, and a gauge only holds a weak reference to it.
 */
final class ReconcilerMetrics {
  static final String ROUNDS = "alert_reconciler_rounds";
  static final String LAST_FINISHED = "alert_reconciler_last_finished_round_timestamp";
  static final String FOREIGN_KEYS = "alert_reconciler_foreign_keys";
  static final String REPAIRS = "alert_reconciler_repairs";
  static final String FAILED = "failed";

  private static final AtomicLong LAST_FINISHED_AT = new AtomicLong(System.currentTimeMillis());
  private static final Map<String, AtomicInteger> FOREIGN = new LinkedHashMap<>();

  static {
    TimeGauge.builder(LAST_FINISHED, LAST_FINISHED_AT, TimeUnit.MILLISECONDS, AtomicLong::get)
        .register(Metrics.globalRegistry);
    for (String store : ReconcileRound.STORES) {
      AtomicInteger count = new AtomicInteger();
      FOREIGN.put(store, count);
      Gauge.builder(FOREIGN_KEYS, count, AtomicInteger::get)
          .tag("store", store)
          .register(Metrics.globalRegistry);
    }
    for (ReconcileRound.Outcome outcome : ReconcileRound.Outcome.values()) {
      rounds(outcome.tag());
    }
    rounds(FAILED);
  }

  private ReconcilerMetrics() {}

  static void started(long atMs) {
    LAST_FINISHED_AT.set(atMs);
  }

  static void finished(ReconcileRound round) {
    rounds(round.outcome().tag()).increment();
    LAST_FINISHED_AT.set(System.currentTimeMillis());
    round.foreignKeys().forEach((store, keys) -> FOREIGN.get(store).set(keys.size()));
  }

  static void failed() {
    rounds(FAILED).increment();
  }

  static void repaired(String reason) {
    Metrics.counter(REPAIRS, "reason", reason).increment();
  }

  private static Counter rounds(String outcome) {
    return Metrics.counter(ROUNDS, "outcome", outcome);
  }
}
