/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.common.base.Ticker;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class RevocableLoadingCacheTest {
  private static final Duration TTL = Duration.ofMinutes(2);
  private static final long WAIT_SECONDS = 10;

  private final AtomicReference<String> source = new AtomicReference<>("old-grant");
  private final AtomicInteger loads = new AtomicInteger();
  private final FakeTicker ticker = new FakeTicker();
  private ExecutorService reader;

  @BeforeEach
  void startReader() {
    reader = Executors.newSingleThreadExecutor();
  }

  @AfterEach
  void stopReader() {
    reader.shutdownNow();
  }

  @Test
  void loadsOnceAndServesFromCache() throws ExecutionException {
    RevocableLoadingCache<String> cache = cacheLoadingFromSource();

    assertEquals("old-grant", cache.get("user"));
    assertEquals("old-grant", cache.get("user"));

    assertEquals(1, loads.get());
  }

  @Test
  void entriesExpireAfterTheConfiguredTtl() throws ExecutionException {
    RevocableLoadingCache<String> cache = cacheLoadingFromSource();
    cache.get("user");
    source.set("new-policy");

    ticker.advance(TTL.plusSeconds(1));

    assertEquals("new-policy", cache.get("user"));
  }

  @Test
  void invalidateAllDropsWarmEntries() throws ExecutionException {
    RevocableLoadingCache<String> cache = cacheLoadingFromSource();
    cache.get("user");
    source.set("new-policy");

    cache.invalidateAll();

    assertEquals("new-policy", cache.get("user"));
  }

  /**
   * The failure this class exists for: a load that read the old rows before the change finishes
   * after the invalidation and would otherwise be published as a brand-new entry.
   */
  @Test
  void loadStartedBeforeInvalidateAllNeverAnswersALaterRead() throws Exception {
    PausedLoad paused = new PausedLoad();
    RevocableLoadingCache<String> cache = cachePausingFirstLoad(paused);
    cache.get("warm-neighbour");
    CompletableFuture<String> inFlight = CompletableFuture.supplyAsync(() -> read(cache), reader);
    paused.awaitLoadStarted();

    source.set("new-policy");
    cache.invalidateAll();
    paused.release();
    inFlight.get(WAIT_SECONDS, TimeUnit.SECONDS);

    assertEquals("new-policy", cache.get("user"));
  }

  @Test
  void loadStartedBeforeTargetedInvalidationNeverAnswersALaterRead() throws Exception {
    PausedLoad paused = new PausedLoad();
    RevocableLoadingCache<String> cache = cachePausingFirstLoad(paused);
    CompletableFuture<String> inFlight = CompletableFuture.supplyAsync(() -> read(cache), reader);
    paused.awaitLoadStarted();

    source.set("new-policy");
    cache.invalidateUser("user");
    paused.release();
    String answeredToOverlappingReader = inFlight.get(WAIT_SECONDS, TimeUnit.SECONDS);

    assertEquals("new-policy", answeredToOverlappingReader);
    assertEquals("new-policy", cache.get("user"));
  }

  /** The case the epoch check missed: a reader that starts mid-load must not join the old load. */
  @Test
  void readerStartedAfterInvalidationDoesNotJoinTheLoadStillRunning() throws Exception {
    PausedLoad paused = new PausedLoad();
    RevocableLoadingCache<String> cache = cachePausingFirstLoad(paused);
    CompletableFuture<String> readerA = CompletableFuture.supplyAsync(() -> read(cache), reader);
    paused.awaitLoadStarted();

    source.set("new-policy");
    cache.invalidateUser("user");
    String readerB = readOnAnotherThread(cache);
    paused.release();
    readerA.get(WAIT_SECONDS, TimeUnit.SECONDS);

    assertEquals("new-policy", readerB);
  }

  @Test
  void invalidationAcceptsAnyCaseOfTheUserName() throws Exception {
    PausedLoad paused = new PausedLoad();
    RevocableLoadingCache<String> cache = cachePausingFirstLoad(paused);
    CompletableFuture<String> inFlight = CompletableFuture.supplyAsync(() -> read(cache), reader);
    paused.awaitLoadStarted();

    source.set("new-policy");
    cache.invalidateUser("USER");
    String readerB = readOnAnotherThread(cache);
    paused.release();
    inFlight.get(WAIT_SECONDS, TimeUnit.SECONDS);

    assertEquals("new-policy", readerB);
    assertEquals("new-policy", cache.get("user"));
  }

  @Test
  void invalidatingOneUserLeavesOtherShardsWarm() throws ExecutionException {
    RevocableLoadingCache<String> cache = cacheLoadingFromSource();
    String other = keyInAnotherShardThan("user");
    cache.get("user");
    cache.get(other);
    loads.set(0);

    cache.invalidateUser("user");
    cache.get(other);

    assertEquals(0, loads.get());
  }

  @Test
  void overlappingInvalidationsDoNotLeaveAStaleEntryBehind() throws Exception {
    PausedLoad paused = new PausedLoad();
    RevocableLoadingCache<String> cache = cachePausingFirstLoad(paused);
    CompletableFuture<String> inFlight = CompletableFuture.supplyAsync(() -> read(cache), reader);
    paused.awaitLoadStarted();

    source.set("new-policy");
    cache.invalidateAll();
    cache.invalidateUser("user");
    cache.invalidateAll();
    paused.release();
    inFlight.get(WAIT_SECONDS, TimeUnit.SECONDS);

    assertEquals("new-policy", cache.get("user"));
  }

  @Test
  void resizeReplacesTheCacheAndKeepsServingFreshLoads() throws ExecutionException {
    RevocableLoadingCache<String> cache = cacheLoadingFromSource();
    cache.get("user");
    source.set("new-policy");

    cache.resize(5);

    assertEquals("new-policy", cache.get("user"));
  }

  @Test
  void respectsTheConfiguredMaximumSize() throws ExecutionException {
    RevocableLoadingCache<String> cache = cacheLoadingFromSource();
    cache.resize(RevocableLoadingCache.SHARDS);
    for (int i = 0; i < 200; i++) {
      cache.get("user-" + i);
    }
    loads.set(0);

    for (int i = 0; i < 200; i++) {
      cache.get("user-" + i);
    }

    assertTrue(loads.get() > 150, "a cache capped at one entry per shard cannot keep 200 users");
  }

  /** Small caps are valid configuration; the shards must not round them up to one entry each. */
  @Test
  void neverRetainsMoreThanTheConfiguredMaximum() throws ExecutionException {
    for (int maximum : new int[] {2, 10, RevocableLoadingCache.SHARDS + 1}) {
      RevocableLoadingCache<String> cache = cacheLoadingFromSource();
      cache.resize(maximum);
      for (int i = 0; i < 500; i++) {
        cache.get("user-" + i);
      }
      loads.set(0);

      // Newest first: whatever a shard retained is the last user loaded into it, and is read
      // before any older user of the same shard can evict it.
      for (int i = 499; i >= 0; i--) {
        cache.get("user-" + i);
      }

      assertTrue(
          500 - loads.get() <= maximum,
          "a cache capped at " + maximum + " retained " + (500 - loads.get()));
    }
  }

  @Test
  void aLoadFailureReachesTheCaller() {
    RevocableLoadingCache<String> cache =
        new RevocableLoadingCache<>(
            10,
            TTL,
            ticker,
            key -> {
              throw new IllegalStateException("user not found");
            });

    assertThrows(Exception.class, () -> cache.get("missing"));
  }

  private String read(RevocableLoadingCache<String> cache) {
    try {
      return cache.get("user");
    } catch (ExecutionException e) {
      throw new IllegalStateException(e);
    }
  }

  private String readOnAnotherThread(RevocableLoadingCache<String> cache) throws Exception {
    ExecutorService other = Executors.newSingleThreadExecutor();
    try {
      return other.submit(() -> read(cache)).get(WAIT_SECONDS, TimeUnit.SECONDS);
    } finally {
      other.shutdownNow();
    }
  }

  private static String keyInAnotherShardThan(String key) {
    int shard = Math.floorMod(key.hashCode(), RevocableLoadingCache.SHARDS);
    for (int candidate = 0; ; candidate++) {
      String other = "other-" + candidate;
      if (Math.floorMod(other.hashCode(), RevocableLoadingCache.SHARDS) != shard) {
        return other;
      }
    }
  }

  private RevocableLoadingCache<String> cacheLoadingFromSource() {
    return new RevocableLoadingCache<>(
        100,
        TTL,
        ticker,
        key -> {
          loads.incrementAndGet();
          return source.get();
        });
  }

  /** The first load of {@code "user"} reads the source, then blocks until {@link #release()}. */
  private RevocableLoadingCache<String> cachePausingFirstLoad(PausedLoad paused) {
    AtomicInteger userLoads = new AtomicInteger();
    return new RevocableLoadingCache<>(
        100,
        TTL,
        ticker,
        key -> {
          String value = source.get();
          if ("user".equals(key) && userLoads.getAndIncrement() == 0) {
            paused.pause();
          }
          return value;
        });
  }

  private static final class PausedLoad {
    private final CountDownLatch started = new CountDownLatch(1);
    private final CountDownLatch released = new CountDownLatch(1);

    void pause() {
      started.countDown();
      awaitOrFail(released);
    }

    void awaitLoadStarted() {
      awaitOrFail(started);
    }

    void release() {
      released.countDown();
    }

    private static void awaitOrFail(CountDownLatch latch) {
      try {
        if (!latch.await(WAIT_SECONDS, TimeUnit.SECONDS)) {
          throw new IllegalStateException(new TimeoutException("latch was never released"));
        }
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        throw new IllegalStateException(e);
      }
    }
  }

  private static final class FakeTicker extends Ticker {
    private volatile long nanos;

    void advance(Duration duration) {
      nanos += duration.toNanos();
    }

    @Override
    public long read() {
      return nanos;
    }
  }
}
