package org.openmetadata.service.apps.bundles.searchIndex;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class BulkSendPermitsTest {
  private final ScheduledExecutorService background = Executors.newScheduledThreadPool(2);

  @AfterEach
  void stopBackground() {
    background.shutdownNow();
  }

  @Test
  void aWaitingFlushOutlastsTheStallWindowWhileBulksKeepCompleting() throws Exception {
    BulkConnectionBudget budget = BulkConnectionBudget.forPoolCapacity(3);
    BulkSendPermits holder = new BulkSendPermits(1, budget, 0);
    BulkSendPermits waiter = new BulkSendPermits(1, budget, 0);
    waiter.setStallTimeoutMillisForTesting(1_000);
    assertTrue(holder.acquire());

    background.scheduleAtFixedRate(holder::recordAttemptCompleted, 0, 50, TimeUnit.MILLISECONDS);
    background.schedule(holder::release, 2_500, TimeUnit.MILLISECONDS);

    assertTrue(waiter.acquire(), "slow but moving bulks must never fail a waiting flush");
  }

  @Test
  void aFlushWaitsOutBulksParkedInBackoffWithoutCallingItALeak() throws Exception {
    BulkConnectionBudget budget = BulkConnectionBudget.forPoolCapacity(3);
    BulkSendPermits holder = new BulkSendPermits(1, budget, 1_000);
    BulkSendPermits waiter = new BulkSendPermits(1, budget, 1_000);
    waiter.setStallTimeoutMillisForTesting(300);
    assertTrue(holder.acquire());

    // The holder completes nothing while its bulk sits in a backoff shorter than its lifetime.
    background.schedule(holder::release, 1_000, TimeUnit.MILLISECONDS);

    assertTrue(waiter.acquire(), "a bulk parked within its lifetime is not a leaked future");
  }

  @Test
  void aWaitingFlushGivesUpWhenNothingCompletesAndKeepsItsOwnSlotFree() throws Exception {
    BulkConnectionBudget budget = BulkConnectionBudget.forPoolCapacity(3);
    BulkSendPermits holder = new BulkSendPermits(1, budget, 0);
    BulkSendPermits waiter = new BulkSendPermits(1, budget, 0);
    waiter.setStallTimeoutMillisForTesting(200);
    assertTrue(holder.acquire());

    assertFalse(waiter.acquire(), "a stalled pipeline is reported, not waited on forever");

    holder.release();
    assertTrue(waiter.acquire(), "the failed wait must not leak the waiter's processor slot");
  }

  @Test
  void aProcessorWaitsForItsOwnSlotEvenWhileTheSharedBudgetHasRoom() throws Exception {
    BulkSendPermits permits = new BulkSendPermits(1, BulkConnectionBudget.forPoolCapacity(100), 0);
    assertTrue(permits.acquire());

    CompletableFuture<Boolean> second =
        CompletableFuture.supplyAsync(() -> acquireQuietly(permits), background);

    await()
        .during(Duration.ofMillis(200))
        .atMost(Duration.ofSeconds(2))
        .until(() -> !second.isDone());
    permits.release();
    await().atMost(Duration.ofSeconds(5)).until(second::isDone);
    assertTrue(second.get());
  }

  private static boolean acquireQuietly(BulkSendPermits permits) {
    try {
      return permits.acquire();
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      return false;
    }
  }
}
