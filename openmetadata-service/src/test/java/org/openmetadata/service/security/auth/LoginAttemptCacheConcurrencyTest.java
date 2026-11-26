package org.openmetadata.service.security.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.BrokenBarrierException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;

/**
 * Reproduces and guards against the lost-update race in {@link LoginAttemptCache#recordFailedLogin}.
 *
 * <p>The brute-force lockout counts failed logins per username on a JVM-wide singleton. Before the
 * fix, {@code recordFailedLogin} did a non-atomic {@code attemptsCache.get(key)} →
 * {@code attempts++} → {@code attemptsCache.put(key, attempts)}, so concurrent failed logins for
 * the same username overwrote each other's increments and only a fraction of the attempts were
 * counted. An attacker firing many wrong-password requests in parallel could therefore make far
 * more than {@code maxLoginFailAttempts} guesses per lockout window before {@code isLoginBlocked}
 * tripped. See the {@code LoginAttemptCache} source and the
 * docs/decisions/2026-10-15-basic-auth-failed-logins-count-against-the-stored-password.md ADR.
 */
@Slf4j
class LoginAttemptCacheConcurrencyTest {
  private static final int THREADS = 200;
  private static final int MAX_ATTEMPT = 3;
  private static final int BLOCK_TIME_SECONDS = 600;

  @RepeatedTest(5)
  void parallelFailedLoginsForTheSameKeyAreCountedExactly() throws Exception {
    LoginAttemptCache cache = new LoginAttemptCache(MAX_ATTEMPT, BLOCK_TIME_SECONDS);
    String attacker = "attacker";

    runInParallel(
        THREADS,
        () -> {
          cache.recordFailedLogin(attacker);
          return null;
        });

    int counted = cache.getUserFailedLoginCount(attacker);
    assertEquals(
        THREADS,
        counted,
        "every parallel failed login for the same key must be counted exactly once");
    assertTrue(cache.isLoginBlocked(attacker), "the lockout must engage once the count is reached");
  }

  @Test
  void theLockoutTripsAtExactlyMaxAttemptUnderConcurrency() throws Exception {
    LoginAttemptCache cache = new LoginAttemptCache(MAX_ATTEMPT, BLOCK_TIME_SECONDS);
    String attacker = "attacker";

    runInParallel(
        MAX_ATTEMPT,
        () -> {
          cache.recordFailedLogin(attacker);
          return null;
        });

    assertEquals(MAX_ATTEMPT, cache.getUserFailedLoginCount(attacker));
    assertTrue(
        cache.isLoginBlocked(attacker), "lockout must trip after exactly maxAttempt counted");
  }

  @Test
  void parallelFailedLoginsForDifferentKeysDoNotBleedIntoEachOther() throws Exception {
    LoginAttemptCache cache = new LoginAttemptCache(MAX_ATTEMPT, BLOCK_TIME_SECONDS);

    int perKey = 50;
    List<String> keys = new ArrayList<>();
    for (int i = 0; i < 4; i++) {
      keys.add("user-" + i);
    }

    ExecutorService pool = Executors.newFixedThreadPool(keys.size() * perKey);
    CyclicBarrier startGun = new CyclicBarrier(keys.size() * perKey);
    CountDownLatch done = new CountDownLatch(keys.size() * perKey);
    try {
      for (String key : keys) {
        for (int i = 0; i < perKey; i++) {
          pool.submit(
              () -> {
                try {
                  startGun.await();
                  cache.recordFailedLogin(key);
                } catch (InterruptedException e) {
                  Thread.currentThread().interrupt();
                } catch (BrokenBarrierException e) {
                  // ignore
                } finally {
                  done.countDown();
                }
              });
        }
      }
      assertTrue(done.await(60, TimeUnit.SECONDS), "all threads must complete");
    } finally {
      pool.shutdownNow();
      assertTrue(pool.awaitTermination(60, TimeUnit.SECONDS), "pool must terminate");
    }

    for (String key : keys) {
      assertEquals(perKey, cache.getUserFailedLoginCount(key), "key " + key + " lost updates");
    }
    for (String key : keys) {
      assertTrue(cache.isLoginBlocked(key), "key " + key + " should be locked at " + perKey);
    }
  }

  @Test
  void aSuccessfulLoginClearsTheCounterEvenAfterParallelFailures() throws Exception {
    LoginAttemptCache cache = new LoginAttemptCache(MAX_ATTEMPT, BLOCK_TIME_SECONDS);
    String attacker = "attacker";

    runInParallel(
        THREADS,
        () -> {
          cache.recordFailedLogin(attacker);
          return null;
        });

    assertEquals(THREADS, cache.getUserFailedLoginCount(attacker));
    assertTrue(cache.isLoginBlocked(attacker));

    cache.recordSuccessfulLogin(attacker);

    assertFalse(cache.isLoginBlocked(attacker));
    assertEquals(0, cache.getUserFailedLoginCount(attacker));
  }

  /** Releases {@code threads} workers simultaneously from a {@link CyclicBarrier}. */
  private <T> void runInParallel(int threads, java.util.concurrent.Callable<T> task)
      throws Exception {
    ExecutorService pool = Executors.newFixedThreadPool(threads);
    CyclicBarrier startGun = new CyclicBarrier(threads);
    CountDownLatch done = new CountDownLatch(threads);
    AtomicReference<Throwable> firstError = new AtomicReference<>();
    try {
      for (int i = 0; i < threads; i++) {
        pool.submit(
            () -> {
              try {
                startGun.await();
                task.call();
              } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
              } catch (BrokenBarrierException e) {
                // ignore
              } catch (Throwable t) {
                firstError.compareAndSet(null, t);
              } finally {
                done.countDown();
              }
            });
      }
      assertTrue(done.await(60, TimeUnit.SECONDS), "all threads must complete");
    } finally {
      pool.shutdownNow();
      assertTrue(pool.awaitTermination(60, TimeUnit.SECONDS), "pool must terminate");
    }
    Throwable error = firstError.get();
    if (error != null) {
      throw new AssertionError("worker failed", error);
    }
  }
}
