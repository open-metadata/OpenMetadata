package org.openmetadata.service.alerting;

import com.github.benmanes.caffeine.cache.AsyncCache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Supplier;
import org.openmetadata.service.events.consumer.ledger.PendingCount;

/**
 * The pending count an alert's page shows. Counting evaluates unread events against the alert's
 * rules, so requests for the same alert at the same position share one count for a short while,
 * and at most {@link #COUNTS_AT_ONCE} counts run at a time across the server, however many pages
 * are open.
 */
public final class PendingCounts implements AutoCloseable {

  /** The alert, its rules' version, its position and the newest event: a count holds until one moves. */
  public record Key(UUID alertId, Double version, long currentOffset, long latestOffset) {}

  private static final int COUNTS_AT_ONCE = 4;
  private static final Duration REUSED_FOR = Duration.ofSeconds(15);
  private static final int ALERTS_REMEMBERED = 1000;

  private static final PendingCounts SHARED =
      new PendingCounts(
          Executors.newFixedThreadPool(
              COUNTS_AT_ONCE,
              Thread.ofPlatform().name("alert-pending-count-", 0).daemon().factory()));

  private final ExecutorService counters;
  private final AsyncCache<Key, PendingCount> counts;

  PendingCounts(ExecutorService counters) {
    this.counters = counters;
    this.counts =
        Caffeine.newBuilder()
            .executor(counters)
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
          .get(key, (unused, executor) -> CompletableFuture.supplyAsync(count, executor))
          .join();
    } catch (CompletionException e) {
      throw e.getCause() instanceof RuntimeException cause ? cause : e;
    }
  }

  @Override
  public void close() {
    counters.shutdownNow();
  }
}
