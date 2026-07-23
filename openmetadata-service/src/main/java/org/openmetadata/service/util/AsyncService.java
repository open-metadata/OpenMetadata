package org.openmetadata.service.util;

import java.util.concurrent.Callable;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;

/**
 * Single virtual-thread executor for all server-side async dispatch (CSV export/import,
 * bulk asset ops, async delete/restore).
 *
 * <p>Back-pressure is intentionally <em>not</em> enforced here. The old semaphore-based
 * bounded wrapper was fighting Project Loom — virtual threads scale to millions and are
 * basically free, while the real bottleneck under load is the JDBI connection pool. Letting
 * tasks queue on connection acquisition (with the pool's own timeout) is both simpler and
 * more accurate than guessing at "how many concurrent tasks ≈ connection pool capacity".
 *
 * <p>If a future use case genuinely needs admission control, it should live at the caller
 * boundary (e.g., a token bucket per user, or a per-operation queue with rejection) rather
 * than at this shared executor.
 */
@Slf4j
public class AsyncService {
  private static AsyncService instance;
  private final ExecutorService executorService;

  private static final int DEFAULT_MAX_RETRIES = 3;
  private static final long DEFAULT_INITIAL_RETRY_DELAY_MS = 1000;
  private static final long DEFAULT_OPERATION_TIMEOUT_SECONDS = 60;
  private static final long SHUTDOWN_TIMEOUT_SECONDS = 30;

  private AsyncService() {
    executorService =
        Executors.newThreadPerTaskExecutor(Thread.ofVirtual().name("om-async-", 0).factory());
    LOG.info("AsyncService initialized (virtual-thread-per-task executor)");
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

  public void execute(Runnable task) {
    executorService.execute(task);
  }

  public <T> CompletableFuture<T> submit(Callable<T> task) {
    return CompletableFuture.supplyAsync(
        () -> {
          try {
            return task.call();
          } catch (RuntimeException e) {
            throw e;
          } catch (Exception e) {
            throw new RuntimeException(e);
          }
        },
        executorService);
  }

  public void shutdown() {
    LOG.info("Shutting down AsyncService executor");
    executorService.shutdown();
    try {
      if (!executorService.awaitTermination(SHUTDOWN_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
        LOG.warn(
            "AsyncService executor did not terminate within {}s, forcing shutdown",
            SHUTDOWN_TIMEOUT_SECONDS);
        executorService.shutdownNow();
      }
    } catch (InterruptedException e) {
      executorService.shutdownNow();
      Thread.currentThread().interrupt();
    }
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
      Supplier<T> task, String operationName, String context) {
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
      Supplier<T> task,
      String operationName,
      String context,
      int maxRetries,
      long initialRetryDelayMs,
      long timeoutSeconds) {
    if (task == null) {
      throw new IllegalArgumentException("task cannot be null");
    }
    if (operationName == null || operationName.isBlank()) {
      throw new IllegalArgumentException("operationName cannot be null or blank");
    }
    if (context == null) {
      throw new IllegalArgumentException("context cannot be null");
    }
    if (maxRetries < 0) {
      throw new IllegalArgumentException("maxRetries must be non-negative");
    }
    if (initialRetryDelayMs <= 0) {
      throw new IllegalArgumentException("initialRetryDelayMs must be positive");
    }
    if (timeoutSeconds <= 0) {
      throw new IllegalArgumentException("timeoutSeconds must be positive");
    }

    ExecutorService executor = getInstance().getExecutorService();
    return CompletableFuture.supplyAsync(
            () -> executeWithRetry(task, operationName, context, maxRetries, initialRetryDelayMs),
            executor)
        .orTimeout(timeoutSeconds, TimeUnit.SECONDS)
        .exceptionally(
            ex -> {
              if (ex instanceof TimeoutException || ex.getCause() instanceof TimeoutException) {
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
      Supplier<T> task,
      String operationName,
      String context,
      int maxRetries,
      long initialRetryDelayMs) {
    Exception lastException = null;

    for (int attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return task.get();
      } catch (Exception e) {
        lastException = e;

        if (attempt == maxRetries) {
          break;
        }

        long delayMs = initialRetryDelayMs * (1L << attempt);

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
