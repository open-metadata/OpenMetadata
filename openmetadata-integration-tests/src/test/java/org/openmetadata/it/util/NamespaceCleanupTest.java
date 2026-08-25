package org.openmetadata.it.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import org.awaitility.pollinterval.FixedPollInterval;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class NamespaceCleanupTest {

  @Test
  @DisplayName("Cleanup checks the cascade immediately instead of sleeping through a poll delay")
  void cascadePollIsNotFixed() {
    // Awaitility derives the poll *delay* — the wait before the very first check — from the poll
    // interval when that interval is a FixedPollInterval and no delay is set explicitly (see
    // ConditionFactory#pollInterval). Under a flat 5s interval every namespace cleanup therefore
    // idled 5s before it ever asked whether the cascade was done: 5265 cleanups x ~5s in a single
    // parallel lane, which is what pushed the lane past its 65m budget.
    assertFalse(
        NamespaceCleanup.CASCADE_POLL instanceof FixedPollInterval,
        "A fixed poll interval makes Awaitility sleep one full interval before the first check");

    Duration firstInterval = NamespaceCleanup.CASCADE_POLL.next(1, Duration.ofSeconds(30));
    assertTrue(
        firstInterval.compareTo(Duration.ofMillis(500)) <= 0,
        "First poll must land in well under a second, was " + firstInterval);
  }

  @Test
  @DisplayName("Cascade polling backs off so a long delete is not hammered")
  void cascadePollBacksOffUpToTheCap() {
    Duration first = NamespaceCleanup.CASCADE_POLL.next(1, Duration.ZERO);
    Duration second = NamespaceCleanup.CASCADE_POLL.next(2, first);

    assertTrue(second.compareTo(first) > 0, "Interval should grow between polls");
    assertEquals(
        NamespaceCleanup.MAX_CASCADE_POLL,
        NamespaceCleanup.CASCADE_POLL.next(9, NamespaceCleanup.MAX_CASCADE_POLL),
        "Backoff must stop at the cap so a 15-minute cascade stays cheap");
  }
}
