package org.openmetadata.service.util;

import java.util.List;
import java.util.concurrent.AbstractExecutorService;
import java.util.concurrent.Callable;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Supplier;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.OpenMetadataApplicationConfigHolder;

@Slf4j
public class AsyncService {
  private static AsyncService instance;
  private final ExecutorService executorService;
  private final Semaphore concurrencyLimiter;
  @Getter private final int maxConcurrency;

  private static final int DEFAULT_MAX_RETRIES = 3;
  private static final long DEFAULT_INITIAL_RETRY_DELAY_MS = 1000;
  private static final long DEFAULT_OPERATION_TIMEOUT_SECONDS = 60;

  private static final long SHUTDOWN_TIMEOUT_SECONDS = 30;

  private AsyncService() {
    maxConcurrency = resolveMaxConcurrency();
    concurrencyLimiter = new Semaphore(maxConcurrency);
    executorService =
        new BoundedExecutorService(Executors.newVirtualThreadPerTaskExecutor(), concurrencyLimiter);
    LOG.info("AsyncService initialized with max concurrency: {}", maxConcurrency);
  }

  private static int resolveMaxConcurrency() {
    String env = System.getenv("ASYNC_SERVICE_MAX_CONCURRENCY");
    if (env != null) {
      try {
        int value = Integer.parseInt(env.trim());
        if (value > 0) {
          return value;
        }
      } catch (NumberFormatException ignored) {
      }
    }
    int cpuBudget = Runtime.getRuntime().availableProcessors() * 2;
    try {
      if (OpenMetadataApplicationConfigHolder.isInitialized()) {
        int poolSize =
            OpenMetadataApplicationConfigHolder.getInstance().getDataSourceFactory().getMaxSize();
        if (poolSize > 0) {
          return Math.max(4, Math.min(cpuBudget, poolSize / 3));
        }
      }
    } catch (Exception e) {
      LOG.warn(
          "Could not determine database pool size, using CPU-based concurrency budget: {}",
          e.getMessage());
    }
    return Math.max(4, cpuBudget);
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
    LOG.info("Shutting down AsyncService executor (max concurrency: {})", maxConcurrency);
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

  /**
   * ExecutorService wrapper that enforces concurrency limits via a semaphore. Every task submitted
   * through any method (execute, submit, invokeAll, invokeAny) acquires a permit before running and
   * releases it on completion. This ensures ALL callers — including those using getExecutorService()
   * directly — are bounded.
   */
  private static class BoundedExecutorService extends AbstractExecutorService {
    private final ExecutorService delegate;
    private final Semaphore semaphore;

    BoundedExecutorService(ExecutorService delegate, Semaphore semaphore) {
      this.delegate = delegate;
      this.semaphore = semaphore;
    }

    @Override
    public void execute(Runnable command) {
      delegate.execute(
          () -> {
            try {
              semaphore.acquire();
            } catch (InterruptedException e) {
              Thread.currentThread().interrupt();
              throw new RuntimeException("Interrupted waiting for concurrency permit", e);
            }
            try {
              command.run();
            } finally {
              semaphore.release();
            }
          });
    }

    @Override
    public void shutdown() {
      delegate.shutdown();
    }

    @Override
    public List<Runnable> shutdownNow() {
      return delegate.shutdownNow();
    }

    @Override
    public boolean isShutdown() {
      return delegate.isShutdown();
    }

    @Override
    public boolean isTerminated() {
      return delegate.isTerminated();
    }

    @Override
    public boolean awaitTermination(long timeout, TimeUnit unit) throws InterruptedException {
      return delegate.awaitTermination(timeout, unit);
    }
  }
}
