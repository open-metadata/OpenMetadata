package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class AsyncServiceTest {

  @Test
  void testSuccessfulExecutionNoRetry() {
    AtomicInteger attempts = new AtomicInteger(0);

    CompletableFuture<String> result =
        AsyncService.executeAsync(
            () -> {
              attempts.incrementAndGet();
              return "success";
            },
            "Test",
            "test-context");

    assertEquals("success", result.join());
    assertEquals(1, attempts.get());
  }

  @Test
  void testRetryOnFailureWithExponentialBackoff() {
    AtomicInteger attempts = new AtomicInteger(0);
    long startTime = System.currentTimeMillis();

    CompletableFuture<String> result =
        AsyncService.executeAsync(
            () -> {
              int attempt = attempts.incrementAndGet();
              if (attempt < 3) {
                throw new RuntimeException("Simulated failure attempt " + attempt);
              }
              return "success";
            },
            "Test",
            "retry-test");

    assertEquals("success", result.join());
    assertEquals(3, attempts.get());

    long duration = System.currentTimeMillis() - startTime;
    assertTrue(duration >= 3000, "Should take at least 3 seconds (1s + 2s delays)");
  }

  @Test
  void testTimeout() {
    CompletableFuture<String> result =
        AsyncService.executeAsync(
            () -> {
              try {
                Thread.sleep(70000);
              } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
              }
              return "should-not-reach";
            },
            "Test",
            "timeout-test",
            3,
            1000,
            2);

    CompletionException exception = assertThrows(CompletionException.class, result::join);
    assertTrue(
        exception.getCause() instanceof TimeoutException
            || exception.getMessage().contains("timeout"));
  }

  @Test
  void testCustomRetryConfiguration() {
    AtomicInteger attempts = new AtomicInteger(0);
    long startTime = System.currentTimeMillis();

    CompletableFuture<String> result =
        AsyncService.executeAsync(
            () -> {
              int attempt = attempts.incrementAndGet();
              if (attempt < 3) {
                throw new RuntimeException("Simulated failure");
              }
              return "success";
            },
            "CustomTest",
            "custom-retry",
            5,
            500,
            120);

    assertEquals("success", result.join());
    assertEquals(3, attempts.get());

    long duration = System.currentTimeMillis() - startTime;
    assertTrue(duration >= 1500, "Should take at least 1.5 seconds (500ms + 1000ms delays)");
  }

  @Test
  void testRetryWithDifferentExceptionTypes() {
    AtomicInteger attempts = new AtomicInteger(0);

    CompletableFuture<String> result =
        AsyncService.executeAsync(
            () -> {
              int attempt = attempts.incrementAndGet();
              if (attempt == 1) {
                throw new IllegalArgumentException("First failure");
              } else if (attempt == 2) {
                throw new IllegalStateException("Second failure");
              }
              return "recovered";
            },
            "Test",
            "exception-test");

    assertEquals("recovered", result.join());
    assertEquals(3, attempts.get());
  }

  @Test
  void testSuccessAfterMaxRetries() {
    AtomicInteger attempts = new AtomicInteger(0);

    CompletableFuture<String> result =
        AsyncService.executeAsync(
            () -> {
              int attempt = attempts.incrementAndGet();
              if (attempt <= 3) {
                throw new RuntimeException("Failure " + attempt);
              }
              return "success-on-4th";
            },
            "Test",
            "max-retry-success");

    assertEquals("success-on-4th", result.join());
    assertEquals(4, attempts.get());
  }
}
