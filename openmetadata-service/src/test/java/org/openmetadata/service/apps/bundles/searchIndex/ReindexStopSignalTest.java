package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class ReindexStopSignalTest {

  private final ReindexStopSignal stopSignal = new ReindexStopSignal();

  @Test
  void stopRunsEachRegisteredActionOnce() {
    AtomicInteger first = new AtomicInteger();
    AtomicInteger second = new AtomicInteger();
    stopSignal.onStop(first::incrementAndGet);
    stopSignal.onStop(second::incrementAndGet);

    assertFalse(stopSignal.isStopRequested());
    stopSignal.requestStop();
    stopSignal.requestStop();

    assertTrue(stopSignal.isStopRequested());
    assertEquals(1, first.get());
    assertEquals(1, second.get());
  }

  /** The guarantee the reindex pieces rely on: one created after the stop still hears of it. */
  @Test
  void actionRegisteredAfterTheStopRunsAtOnce() {
    AtomicInteger late = new AtomicInteger();
    stopSignal.requestStop();

    stopSignal.onStop(late::incrementAndGet);

    assertEquals(1, late.get());
  }

  @Test
  void failingActionDoesNotKeepTheOthersFromRunning() {
    AtomicInteger after = new AtomicInteger();
    stopSignal.onStop(
        () -> {
          throw new IllegalStateException("stop action failed");
        });
    stopSignal.onStop(after::incrementAndGet);

    stopSignal.requestStop();

    assertTrue(stopSignal.isStopRequested());
    assertEquals(1, after.get());
  }
}
