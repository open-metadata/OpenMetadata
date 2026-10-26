package org.openmetadata.service.events.scheduled;

import com.github.benmanes.caffeine.cache.AsyncCache;
import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

/**
 * The pending count an alert's page shows. Counting evaluates unread events against the alert's
 * rules, so requests for the same alert at the same position share one count for a short while.
 * At most {@link #COUNTS_AT_ONCE} counts run at a time across the server, however many pages are
 * open, and at most {@link #COUNTS_WAITING} wait for them; a request past those is answered 429.
 */
public final class PendingCounts implements AutoCloseable {

  /** The alert, its rules' version, its position and the newest event: a count holds until one moves. */
  public record Key(UUID alertId, Double version, long currentOffset, long latestOffset) {}

  private static final int COUNTS_AT_ONCE = 4;
  private static final int COUNTS_WAITING = 16;
  private static final Duration REUSED_FOR = Duration.ofSeconds(15);
  private static final int ALERTS_REMEMBERED = 1000;

  private static final PendingCounts SHARED =
      new PendingCounts(
          new ThreadPoolExecutor(
              COUNTS_AT_ONCE,
              COUNTS_AT_ONCE,
              0,
              TimeUnit.MILLISECONDS,
              new ArrayBlockingQueue<>(COUNTS_WAITING),
              Thread.ofPlatform().name("alert-pending-count-", 0).daemon().factory(),
              new ThreadPoolExecutor.AbortPolicy()));

  private final ExecutorService counters;
  private final AsyncCache<Key, PendingCount> counts;

  PendingCounts(ExecutorService counters) {
    this.counters = counters;
    this.counts =
        Caffeine.newBuilder()
            .expireAfterWrite(REUSED_FOR)
            .maximumSize(ALERTS_REMEMBERED)
            .buildAsync();
  }

  public static PendingCount shared(Key key, Supplier<PendingCount> count) {
    return SHARED.get(key, count);
  }

  PendingCount get(Key key, Supplier<PendingCount> count) {
    try {
      return counts
          .get(key, (unused, cacheExecutor) -> CompletableFuture.supplyAsync(count, counters))
          .join();
    } catch (RejectedExecutionException e) {
      throw new WebApplicationException(
          "Too many alert counts are running; try again shortly",
          e,
          Response.Status.TOO_MANY_REQUESTS);
    } catch (CompletionException e) {
      throw unwrapped(e);
    }
  }

  private static RuntimeException unwrapped(CompletionException e) {
    if (e.getCause() instanceof Error error) {
      throw error;
    }
    return e.getCause() instanceof RuntimeException cause ? cause : e;
  }

  @Override
  public void close() {
    counters.shutdownNow();
  }
}
