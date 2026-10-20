package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.runApp;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.apps.scheduler.AppAlreadyRunningException;

class RunAppImplTest {
  private static final String APP = "DataInsightsApplication";

  @Test
  void aBusyAppIsRetriedWithBackoffUntilItAcceptsTheRun() {
    AtomicInteger calls = new AtomicInteger();
    List<Long> pauses = new ArrayList<>();

    boolean triggered =
        RunAppImpl.triggerWithRetry(
            APP,
            () -> {
              if (calls.incrementAndGet() <= 2) {
                throw new AppAlreadyRunningException(APP);
              }
            },
            pauses::add);

    assertTrue(triggered);
    assertEquals(3, calls.get());
    assertEquals(List.of(10_000L, 20_000L), pauses);
  }

  @Test
  void anAppStillBusyAfterTheLastAttemptIsNotRun() {
    AtomicInteger calls = new AtomicInteger();
    List<Long> pauses = new ArrayList<>();

    boolean triggered =
        RunAppImpl.triggerWithRetry(
            APP,
            () -> {
              calls.incrementAndGet();
              throw new AppAlreadyRunningException(APP);
            },
            pauses::add);

    assertFalse(triggered);
    assertEquals(5, calls.get());
    assertEquals(List.of(10_000L, 20_000L, 40_000L, 60_000L), pauses);
  }

  @Test
  void anyOtherFailureIsNotRetried() {
    List<Long> pauses = new ArrayList<>();
    IllegalStateException failure = new IllegalStateException("app is disabled");

    IllegalStateException thrown =
        assertThrows(
            IllegalStateException.class,
            () ->
                RunAppImpl.triggerWithRetry(
                    APP,
                    () -> {
                      throw failure;
                    },
                    pauses::add));

    assertEquals(failure, thrown);
    assertTrue(pauses.isEmpty());
  }
}
