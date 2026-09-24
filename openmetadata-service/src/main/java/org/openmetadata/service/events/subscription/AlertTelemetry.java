package org.openmetadata.service.events.subscription;

import io.micrometer.core.instrument.Metrics;
import java.util.concurrent.TimeUnit;

/**
 * What the alert pipeline counts about itself. The reconciler, the compare-and-set and the
 * best-effort writes all absorb failures quietly, which is right for delivery and wrong for
 * operations, so each one counts what it absorbs. These are server metrics; nothing is stored.
 */
public final class AlertTelemetry {

  public static final String POSITION_MOVED_BY_SOMEONE_ELSE = "position moved by someone else";
  public static final String ALERT_DELETED_DURING_TICK = "alert deleted during the tick";
  public static final String COUNTERS_GIVEN_UP = "counters given up after a retry";
  public static final String DIAGNOSTIC_WRITE_FAILED = "diagnostic write failed";
  public static final String GAP_STEPPED_OVER = "gap stepped over";
  public static final String EVENT_SET_ASIDE_AS_INTERRUPTED = "event set aside as interrupted";
  public static final String FOREIGN_JOB_REFUSED = "job naming no alert refused";

  private static final String TICK_DURATION = "alert_tick_duration";
  private static final String TRIGGER_LATENESS = "alert_trigger_lateness";
  private static final String LAG = "alert_lag_events";
  private static final String ABSORBED = "alert_absorbed";
  private static final String CHANNEL_OUTCOMES = "alert_channel_outcomes";
  private static final String STOPPED_BY_BUDGET = "alert_ticks_stopped_by_budget";
  private static final String IMMEDIATE_RERUNS = "alert_immediate_reruns";
  private static final String ATTEMPTS_ON_UNREACHABLE = "alert_attempts_on_unreachable_target";

  private AlertTelemetry() {}

  public static void tickTook(long durationMs) {
    Metrics.timer(TICK_DURATION).record(durationMs, TimeUnit.MILLISECONDS);
  }

  /** The time a tick fired minus the time it was scheduled for: the sign of a full thread pool. */
  public static void triggerWasLate(long latenessMs) {
    Metrics.timer(TRIGGER_LATENESS).record(Math.max(0, latenessMs), TimeUnit.MILLISECONDS);
  }

  public static void lag(long eventsNotReadYet) {
    Metrics.summary(LAG).record(Math.max(0, eventsNotReadYet));
  }

  public static void tickStoppedByBudget() {
    Metrics.counter(STOPPED_BY_BUDGET).increment();
  }

  public static void ranAgainAtOnce() {
    Metrics.counter(IMMEDIATE_RERUNS).increment();
  }

  /**
   * A target whose connection had already failed in the same tick was reached for again. Counted
   * whether or not the attempt was then made, because this number decides if it should be.
   */
  public static void attemptOnUnreachableTarget(boolean skipped) {
    Metrics.counter(ATTEMPTS_ON_UNREACHABLE, "skipped", String.valueOf(skipped)).increment();
  }

  public static void absorbed(String what) {
    Metrics.counter(ABSORBED, "what", what).increment();
  }

  public static void channelOutcomes(int succeeded, int failed) {
    Metrics.counter(CHANNEL_OUTCOMES, "outcome", "success").increment(succeeded);
    Metrics.counter(CHANNEL_OUTCOMES, "outcome", "failed").increment(failed);
  }
}
