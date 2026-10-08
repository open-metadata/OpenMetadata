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
    cache.invalidate("user");
    paused.release();
    String answeredToOverlappingReader = inFlight.get(WAIT_SECONDS, TimeUnit.SECONDS);

    assertEquals("new-policy", answeredToOverlappingReader);
    assertEquals("new-policy", cache.get("user"));
  }

  @Test
  void loadStartedBeforePredicateInvalidationNeverAnswersALaterRead() throws Exception {
    PausedLoad paused = new PausedLoad();
    RevocableLoadingCache<String> cache = cachePausingFirstLoad(paused);
    CompletableFuture<String> inFlight = CompletableFuture.supplyAsync(() -> read(cache), reader);
    paused.awaitLoadStarted();

    source.set("new-policy");
    cache.invalidateMatching("USER"::equalsIgnoreCase);
    paused.release();
    inFlight.get(WAIT_SECONDS, TimeUnit.SECONDS);

    assertEquals("new-policy", cache.get("user"));
  }

  @Test
  void overlappingInvalidationsDoNotLeaveAStaleEntryBehind() throws Exception {
    PausedLoad paused = new PausedLoad();
    RevocableLoadingCache<String> cache = cachePausingFirstLoad(paused);
    CompletableFuture<String> inFlight = CompletableFuture.supplyAsync(() -> read(cache), reader);
    paused.awaitLoadStarted();

    source.set("new-policy");
    cache.invalidateAll();
    cache.invalidate("user");
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
    cache.resize(2);
    for (int i = 0; i < 50; i++) {
      cache.get("user-" + i);
    }
    loads.set(0);

    for (int i = 0; i < 50; i++) {
      cache.get("user-" + i);
    }

    assertTrue(loads.get() > 40, "a cache capped at 2 entries cannot keep 50 users warm");
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
