package org.openmetadata.service.apps.bundles.changeEvent;

import java.time.Duration;
import java.util.function.LongSupplier;
import org.openmetadata.service.events.subscription.AlertingSettings;

/**
 * Tells a tick to end after the event, or the batch, it is working on: the server is stopping, or
 * the tick has held its thread for the time budget and other alerts are due a turn.
 */
public final class TickStopSignal {

  private final long startedAtNanos;
  private final Duration budget;
  private final LongSupplier nanoClock;

  TickStopSignal(Duration budget, LongSupplier nanoClock) {
    this.budget = budget;
    this.nanoClock = nanoClock;
    this.startedAtNanos = nanoClock.getAsLong();
  }

  static TickStopSignal startingNow(AlertingSettings settings) {
    return new TickStopSignal(settings.tickTimeBudget(), System::nanoTime);
  }

  public boolean isSet() {
    return ServerStopping.isSet() || budgetHasPassed();
  }

  /** At least a second, so a send made at the very end of a budget can still hear an answer. */
  Duration timeLeft(Duration withoutABudget) {
    Duration left = withoutABudget;
    if (budget.isPositive()) {
      long spent = nanoClock.getAsLong() - startedAtNanos;
      left = Duration.ofNanos(Math.max(budget.toNanos() - spent, Duration.ofSeconds(1).toNanos()));
    }
    return left;
  }

  boolean budgetHasPassed() {
    return budget.isPositive() && nanoClock.getAsLong() - startedAtNanos >= budget.toNanos();
  }
}
