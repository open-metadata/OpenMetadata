package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class BulkSendPermitsTest {
  private final ScheduledExecutorService background = Executors.newScheduledThreadPool(1);

  @AfterEach
  void stopBackground() {
    background.shutdownNow();
  }

  @Test
  void aBulkWaitingOutABackoffLeavesTheServersConnectionsToOtherWriters() throws Exception {
    BulkConnectionBudget oneConnection = BulkConnectionBudget.forPoolCapacity(3);
    BulkSendPermits reindex = new BulkSendPermits(2, oneConnection);
    BulkSendPermits live = new BulkSendPermits(1, oneConnection);

    assertTrue(reindex.acquireSlot(lifetime(60_000)), "a paused bulk keeps only its slot");
    assertTrue(live.acquireSlot(lifetime(1_000)));

    assertTrue(live.acquireConnection(lifetime(1_000)));
  }

  @Test
  void aConnectionIsHeldUntilItsSendCompletes() throws Exception {
    BulkConnectionBudget oneConnection = BulkConnectionBudget.forPoolCapacity(3);
    BulkSendPermits sending = new BulkSendPermits(1, oneConnection);
    BulkSendPermits waiting = new BulkSendPermits(1, oneConnection);
    assertTrue(sending.acquireConnection(lifetime(1_000)));

    assertFalse(waiting.acquireConnection(lifetime(200)), "the wait ends at the bulk's deadline");
    sending.releaseConnection();
    assertTrue(waiting.acquireConnection(lifetime(1_000)));
  }

  @Test
  void aFlushWaitsForItsProcessorsSlotUntilTheBulksDeadline() throws Exception {
    BulkSendPermits permits = new BulkSendPermits(1, BulkConnectionBudget.forPoolCapacity(100));
    assertTrue(permits.acquireSlot(lifetime(1_000)));

    assertFalse(permits.acquireSlot(lifetime(200)));
    background.schedule(permits::releaseSlot, 200, TimeUnit.MILLISECONDS);
    assertTrue(permits.acquireSlot(lifetime(5_000)), "a slot freed before the deadline is taken");
  }

  @Test
  void aBulkPastItsDeadlineDoesNotWait() throws Exception {
    BulkSendPermits permits = new BulkSendPermits(1, BulkConnectionBudget.forPoolCapacity(100));
    assertTrue(permits.acquireSlot(lifetime(1_000)));

    assertFalse(permits.acquireSlot(lifetime(0)));
  }

  private static BulkAttempt<String> lifetime(long lifetimeMillis) {
    return BulkAttempt.first(
        List.of("doc"), 1L, new BulkRetryPolicy(3, 100, 1_000, lifetimeMillis));
  }
}
