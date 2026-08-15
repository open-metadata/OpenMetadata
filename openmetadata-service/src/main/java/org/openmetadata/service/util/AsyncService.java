package org.openmetadata.service.util;

import io.micrometer.core.instrument.FunctionCounter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.Metrics;
import java.util.EnumMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.Callable;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.FutureTask;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.config.AsyncOperationsConfiguration;

/**
 * Shared virtual-thread executor with separate raw and database-bounded views.
 *
 * <p>The raw view is reserved for continuations and work that does not acquire a database
 * connection. Top-level DB-heavy operations use the bounded view so they cannot consume the entire
 * Hikari pool while request threads wait for a connection.
 *
 * <p>A task holding a database permit must not wait for another task that needs a permit. Nested
 * continuations must use {@link #getExecutorService()}.
 */
@Slf4j
public class AsyncService {
  private static AsyncService instance;
  private ExecutorService executorService;
  private final BoundedAsyncExecutor databaseExecutorService;
  private final int maxConcurrentDbTasks;
  private final Map<DatabaseOperation, OperationStats> operationStats;

  private static final int DEFAULT_MAX_RETRIES = 3;
  private static final long DEFAULT_INITIAL_RETRY_DELAY_MS = 1000;
  private static final long DEFAULT_OPERATION_TIMEOUT_SECONDS = 60;
  private static final long SHUTDOWN_TIMEOUT_SECONDS = 30;
  private static final String ACTIVE_TASKS_METRIC = "async.operations.db.active";
  private static final String QUEUED_TASKS_METRIC = "async.operations.db.queued";
  private static final String SUBMITTED_TASKS_METRIC = "async.operations.db.submitted";
  private static final String TASK_LIMIT_METRIC = "async.operations.db.limit";

  public enum DatabaseOperation {
    APP_OPERATION,
    AUDIT_LOG,
    AUDIT_PACK,
    BULK_ASSET_OPERATION,
    CSV_CHANGE_EVENT,
    CSV_IMPORT,
    ENTITY_DELETE_RESTORE,
    RDF_UPDATE,
    SEARCH_OPERATION,
    TEST_CASE_CLEANUP,
    USER_CLEANUP,
    WORKFLOW_TASK
  }

  private AsyncService() {
    this(new AsyncOperationsConfiguration());
  }

  private AsyncService(AsyncOperationsConfiguration config) {
    maxConcurrentDbTasks = config.getMaxConcurrentDbTasks();
    executorService =
        Executors.newThreadPerTaskExecutor(Thread.ofVirtual().name("om-async-", 0).factory());
    databaseExecutorService = new BoundedAsyncExecutor(executorService, maxConcurrentDbTasks);
    operationStats = new EnumMap<>(DatabaseOperation.class);
    for (DatabaseOperation operation : DatabaseOperation.values()) {
      operationStats.put(operation, new OperationStats());
    }
    LOG.info(
        "AsyncService initialized (virtual-thread-per-task executor, DB task limit={})",
        maxConcurrentDbTasks);
  }

  public static synchronized void initialize(AsyncOperationsConfiguration config) {
    if (instance == null) {
      instance = new AsyncService(Objects.requireNonNull(config));
      instance.registerMetrics();
    }
  }

  public static synchronized AsyncService getInstance() {
    if (instance == null) {
      LOG.warn("AsyncService not initialized, using defaults");
      initialize(new AsyncOperationsConfiguration());
    }
    return instance;
  }

  public ExecutorService getExecutorService() {
    return executorService;
  }

  public ExecutorService getDatabaseExecutorService() {
    return databaseExecutorService;
  }

  public int getOperationActiveCount(DatabaseOperation operation) {
    return operationStats.get(operation).active.get();
  }

  public int getOperationQueuedCount(DatabaseOperation operation) {
    return operationStats.get(operation).queued.get();
  }

  public void executeDatabaseTask(DatabaseOperation operation, String context, Runnable task) {
    final OperationStats stats = recordSubmission(operation, context);
    try {
      databaseExecutorService.execute(() -> stats.run(task), stats::cancelSubmission);
    } catch (RuntimeException e) {
      stats.cancelSubmission();
      throw e;
    }
  }

  public <T> CompletableFuture<T> submitDatabaseTask(
      DatabaseOperation operation, String context, Callable<T> task) {
    final OperationStats stats = recordSubmission(operation, context);
    final CompletableFuture<T> future = new CompletableFuture<>();
    try {
      databaseExecutorService.execute(
          () -> completeDatabaseTask(stats, task, future), () -> cancelDatabaseTask(stats, future));
    } catch (RuntimeException e) {
      stats.cancelSubmission();
      throw e;
    }
    return future;
  }

  public <T> Future<T> submitCancellableDatabaseTask(
      DatabaseOperation operation, String context, Callable<T> task) {
    final OperationStats stats = recordSubmission(operation, context);
    final FutureTask<T> future = new FutureTask<>(() -> stats.call(task));
    try {
      databaseExecutorService.execute(future, () -> cancelDatabaseTask(stats, future));
    } catch (RuntimeException e) {
      stats.cancelSubmission();
      throw e;
    }
    return future;
  }

  private static <T> void completeDatabaseTask(
      OperationStats stats, Callable<T> task, CompletableFuture<T> future) {
    try {
      future.complete(callDatabaseTask(stats, task));
    } catch (RuntimeException | Error e) {
      future.completeExceptionally(e);
    }
  }

  private static <T> T callDatabaseTask(OperationStats stats, Callable<T> task) {
    try {
      return stats.call(task);
    } catch (RuntimeException e) {
      throw e;
    } catch (Exception e) {
      throw new CompletionException(e);
    }
  }

  private static void cancelDatabaseTask(OperationStats stats, Future<?> future) {
    stats.cancelSubmission();
    future.cancel(false);
  }

  private OperationStats recordSubmission(DatabaseOperation operation, String context) {
    Objects.requireNonNull(operation);
    Objects.requireNonNull(context);
    final OperationStats stats = operationStats.get(operation);
    final int queued = stats.recordSubmission();
    if (queued == maxConcurrentDbTasks + 1 || queued % 100 == 0) {
      LOG.warn(
          "Database async backlog operation={} context={} queued={} active={} limit={}",
          operation,
          context,
          queued,
          stats.active.get(),
          maxConcurrentDbTasks);
    }
    return stats;
  }

  private void registerMetrics() {
    for (Map.Entry<DatabaseOperation, OperationStats> entry : operationStats.entrySet()) {
      final String operation = entry.getKey().name().toLowerCase(Locale.ROOT);
      final OperationStats stats = entry.getValue();
      Gauge.builder(ACTIVE_TASKS_METRIC, stats, value -> value.active.get())
          .tag("operation", operation)
          .description("Running DB-heavy asynchronous operations")
          .register(Metrics.globalRegistry);
      Gauge.builder(QUEUED_TASKS_METRIC, stats, value -> value.queued.get())
          .tag("operation", operation)
          .description("Queued DB-heavy asynchronous operations")
          .register(Metrics.globalRegistry);
      FunctionCounter.builder(SUBMITTED_TASKS_METRIC, stats, value -> value.submitted.get())
          .tag("operation", operation)
          .description("Submitted DB-heavy asynchronous operations")
          .register(Metrics.globalRegistry);
    }
    Gauge.builder(TASK_LIMIT_METRIC, this, service -> service.maxConcurrentDbTasks)
        .description("Configured DB-heavy asynchronous operation limit")
        .register(Metrics.globalRegistry);
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

  private static final class OperationStats {
    private final AtomicInteger active = new AtomicInteger();
    private final AtomicInteger queued = new AtomicInteger();
    private final AtomicLong submitted = new AtomicLong();

    private int recordSubmission() {
      submitted.incrementAndGet();
      return queued.incrementAndGet();
    }

    private void cancelSubmission() {
      queued.decrementAndGet();
    }

    private void run(Runnable task) {
      queued.decrementAndGet();
      active.incrementAndGet();
      try {
        task.run();
      } finally {
        active.decrementAndGet();
      }
    }

    private <T> T call(Callable<T> task) throws Exception {
      queued.decrementAndGet();
      active.incrementAndGet();
      try {
        return task.call();
      } finally {
        active.decrementAndGet();
      }
    }
  }
}
