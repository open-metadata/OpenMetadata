package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.runApp;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.apps.scheduler.AppAlreadyRunningException;

class RunAppImplTest {
  @Test
  void aBusyAppIsRetriedWithBackoffUntilItAcceptsTheRun() {
    AtomicInteger calls = new AtomicInteger();
    List<Long> pauses = new ArrayList<>();

    boolean triggered =
        RunAppImpl.triggerWithRetry(
            "DataInsightsApplication",
            () -> {
              if (calls.incrementAndGet() <= 2) {
                throw new AppAlreadyRunningException();
              }
            },
            pauses::add);

    assertTrue(triggered);
    assertEquals(3, calls.get());
    assertEquals(List.of(10_000L, 20_000L), pauses);
  }
}
