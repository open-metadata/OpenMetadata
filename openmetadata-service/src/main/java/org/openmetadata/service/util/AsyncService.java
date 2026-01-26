package org.openmetadata.service.util;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class AsyncService {
  private static AsyncService instance;
  private final ExecutorService executorService;

  // Default retry configuration
  private static final int DEFAULT_MAX_RETRIES = 3;
  private static final long DEFAULT_INITIAL_RETRY_DELAY_MS = 1000; // 1 second
  private static final long DEFAULT_OPERATION_TIMEOUT_SECONDS = 60; // 60 seconds

  private AsyncService() {
    executorService = Executors.newVirtualThreadPerTaskExecutor();
  }

  public static synchronized AsyncService getInstance() {
    if (instance == null) {
      instance = new AsyncService();
    }
    return instance;
  }

  public ExecutorService getExecutorService() {
    return executorService;
  }

  // Optionally, provide a method to shut down the executor service
  public void shutdown() {
    executorService.shutdown();
  }

  /**
   * Executes an async operation with retry logic, exponential backoff, and timeout. This is a
   * generic utility that can be used for any async operation across OpenMetadata.
   *
   * @param task The task to execute
   * @param operationName Name of the operation for logging (e.g., "Read", "Write", "API Call")
   * @param context Context information for logging (e.g., asset ID, entity name)
   * @param <T> Return type of the operation
   * @return CompletableFuture with the result
   */
  public static <T> CompletableFuture<T> executeAsync(
      java.util.function.Supplier<T> task, String operationName, String context) {
    return executeAsync(
        task,
        operationName,
        context,
        DEFAULT_MAX_RETRIES,
        DEFAULT_INITIAL_RETRY_DELAY_MS,
        DEFAULT_OPERATION_TIMEOUT_SECONDS);
  }

  /**
   * Executes an async operation with custom retry configuration.
   *
   * @param task The task to execute
   * @param operationName Name of the operation for logging
   * @param context Context information for logging
   * @param maxRetries Maximum number of retry attempts
   * @param initialRetryDelayMs Initial retry delay in milliseconds (will be doubled each retry)
   * @param timeoutSeconds Timeout for the entire operation in seconds
   * @param <T> Return type of the operation
   * @return CompletableFuture with the result
   */
  public static <T> CompletableFuture<T> executeAsync(
      java.util.function.Supplier<T> task,
      String operationName,
      String context,
      int maxRetries,
      long initialRetryDelayMs,
      long timeoutSeconds) {
    ExecutorService executor = getInstance().getExecutorService();
    return CompletableFuture.supplyAsync(
            () -> executeWithRetry(task, operationName, context, maxRetries, initialRetryDelayMs),
            executor)
        .orTimeout(timeoutSeconds, TimeUnit.SECONDS)
        .exceptionally(
            ex -> {
              if (ex.getCause() instanceof TimeoutException) {
                throw new RuntimeException(
                    String.format(
                        "%s timeout for %s: Operation exceeded %d seconds",
                        operationName, context, timeoutSeconds),
                    ex);
              }
              throw new RuntimeException(
                  String.format("Failed to %s %s", operationName.toLowerCase(), context), ex);
            });
  }

  /**
   * Executes a task with retry logic and exponential backoff. Retries transient failures but not
   * timeouts.
   *
   * @param task The task to execute
   * @param operationName Name of the operation for logging
   * @param context Context information for logging
   * @param maxRetries Maximum number of retry attempts
   * @param initialRetryDelayMs Initial retry delay in milliseconds
   * @param <T> Return type of the operation
   * @return Result of the operation
   */
  private static <T> T executeWithRetry(
      java.util.function.Supplier<T> task,
      String operationName,
      String context,
      int maxRetries,
      long initialRetryDelayMs) {
    int attempt = 0;
    Throwable lastException = null;

    while (attempt <= maxRetries) {
      try {
        return task.get();
      } catch (Exception e) {
        lastException = e;
        attempt++;

        if (attempt > maxRetries) {
          throw e;
        }

        long delayMs = initialRetryDelayMs * (1L << (attempt - 1));
        try {
          Thread.sleep(delayMs);
        } catch (InterruptedException ie) {
          Thread.currentThread().interrupt();
          throw new RuntimeException(
              String.format("Retry interrupted for %s: %s", operationName, context), ie);
        }
      }
    }

    throw new RuntimeException(
        String.format("Failed to %s %s", operationName.toLowerCase(), context), lastException);
  }
}
