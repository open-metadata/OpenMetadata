package org.openmetadata.service.events.scheduled;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.WebApplicationException;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class PendingCountsTest {

  private static final UUID ALERT = UUID.randomUUID();

  @Test
  void requestsForTheSameAlertAtTheSamePositionShareOneCount() throws Exception {
    AtomicInteger computed = new AtomicInteger();
    CountDownLatch release = new CountDownLatch(1);
    ExecutorService callers = Executors.newFixedThreadPool(8);
    try (PendingCounts counts = new PendingCounts(Executors.newFixedThreadPool(4))) {
      PendingCounts.Key key = new PendingCounts.Key(ALERT, 0.1, 42L, 50L);
      List<CompletableFuture<PendingCount>> answers =
          IntStream.range(0, 8)
              .mapToObj(
                  caller ->
                      CompletableFuture.supplyAsync(
                          () -> counts.get(key, () -> blockedCount(computed, release)), callers))
              .toList();

      release.countDown();

      for (CompletableFuture<PendingCount> answer : answers) {
        assertEquals(new PendingCount(7, false), answer.get(30, TimeUnit.SECONDS));
      }
      assertEquals(1, computed.get(), "eight requests, one count");
    } finally {
      callers.shutdownNow();
    }
  }

  @Test
  void aMovedPositionAnEditedAlertOrANewEventIsCountedAgain() {
    AtomicInteger computed = new AtomicInteger();
    try (PendingCounts counts = new PendingCounts(Executors.newFixedThreadPool(4))) {
      counts.get(new PendingCounts.Key(ALERT, 0.1, 42L, 50L), () -> counted(computed));
      counts.get(new PendingCounts.Key(ALERT, 0.1, 43L, 50L), () -> counted(computed));
      counts.get(new PendingCounts.Key(ALERT, 0.2, 43L, 50L), () -> counted(computed));
      counts.get(new PendingCounts.Key(ALERT, 0.2, 43L, 51L), () -> counted(computed));

      assertEquals(4, computed.get());
    }
  }

  @Test
  void aCountWithNoRoomToWaitIsAnsweredTooManyRequests() throws Exception {
    AtomicInteger computed = new AtomicInteger();
    CountDownLatch started = new CountDownLatch(1);
    CountDownLatch release = new CountDownLatch(1);
    ExecutorService oneCounterNoQueue =
        new ThreadPoolExecutor(1, 1, 0, TimeUnit.MILLISECONDS, new SynchronousQueue<>());
    ExecutorService caller = Executors.newSingleThreadExecutor();
    try (PendingCounts counts = new PendingCounts(oneCounterNoQueue)) {
      caller.submit(
          () ->
              counts.get(
                  new PendingCounts.Key(ALERT, 0.1, 42L, 50L),
                  () -> {
                    started.countDown();
                    return blockedCount(computed, release);
                  }));
      assertTrue(started.await(30, TimeUnit.SECONDS));

      WebApplicationException refused =
          assertThrows(
              WebApplicationException.class,
              () ->
                  counts.get(new PendingCounts.Key(ALERT, 0.1, 43L, 50L), () -> counted(computed)));

      assertEquals(429, refused.getResponse().getStatus());
      release.countDown();
    } finally {
      caller.shutdownNow();
    }
  }

  @Test
  void aFailedCountIsNotRemembered() {
    AtomicInteger computed = new AtomicInteger();
    try (PendingCounts counts = new PendingCounts(Executors.newFixedThreadPool(4))) {
      PendingCounts.Key key = new PendingCounts.Key(ALERT, 0.1, 42L, 50L);
      IllegalStateException failure =
          assertThrows(
              IllegalStateException.class,
              () ->
                  counts.get(
                      key,
                      () -> {
                        throw new IllegalStateException("database unavailable");
                      }));

      assertTrue(failure.getMessage().contains("database unavailable"));
      assertEquals(new PendingCount(1, false), counts.get(key, () -> counted(computed)));
    }
  }

  private static PendingCount blockedCount(AtomicInteger computed, CountDownLatch release) {
    computed.incrementAndGet();
    try {
      release.await(30, TimeUnit.SECONDS);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
    return new PendingCount(7, false);
  }

  private static PendingCount counted(AtomicInteger computed) {
    return new PendingCount(computed.incrementAndGet(), false);
  }
}
