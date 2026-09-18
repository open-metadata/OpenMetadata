package org.openmetadata.service.apps.bundles.changeEvent;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class TickStopSignalTest {

  private final AtomicLong nanos = new AtomicLong();

  @AfterEach
  void serverIsRunningAgain() {
    ServerStopping.set(false);
  }

  @Test
  void setOnceTheBudgetHasPassed() {
    TickStopSignal signal = new TickStopSignal(Duration.ofSeconds(60), nanos::get);

    nanos.set(Duration.ofSeconds(59).toNanos());
    assertFalse(signal.isSet());

    nanos.set(Duration.ofSeconds(60).toNanos());
    assertTrue(signal.isSet());
  }

  @Test
  void budgetOfZeroIsNoBudget() {
    TickStopSignal signal = new TickStopSignal(Duration.ZERO, nanos::get);

    nanos.set(Duration.ofDays(1).toNanos());

    assertFalse(signal.isSet());
  }

  @Test
  void setAsSoonAsTheServerIsStopping() {
    TickStopSignal signal = new TickStopSignal(Duration.ofSeconds(60), nanos::get);

    ServerStopping.set(true);

    assertTrue(signal.isSet());
    assertFalse(signal.budgetHasPassed(), "and the two reasons stay apart");
  }
}
