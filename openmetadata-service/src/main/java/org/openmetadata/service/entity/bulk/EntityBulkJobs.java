package org.openmetadata.service.entity.bulk;

import com.google.common.base.Ticker;
import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response.Status;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executor;
import java.util.concurrent.Semaphore;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.service.jdbi3.BulkExecutor;

/** Admits bounded asynchronous bulk work and retains a bounded, expiring completion history. */
@Slf4j
public final class EntityBulkJobs {
  private static final EntityBulkJobs SHARED =
      new EntityBulkJobs(() -> BulkExecutor.getInstance().getExecutor());

  public static EntityBulkJobs shared() {
    return SHARED;
  }

  public record Authorization(List<BulkResponse> failures, int totalRequests) {}

  public record Job(String id, CompletableFuture<BulkOperationResult> result) {}

  public record Policy(int active, int completed, Duration retention) {
    public Policy {
      if (active < 1 || completed < 1 || retention.isNegative() || retention.isZero()) {
        throw new IllegalArgumentException("Bulk job limits and retention must be positive");
      }
    }
  }

  private final Supplier<Executor> executor;
  private final Policy policy;
  private final Semaphore permits;
  // Admission permits bound this registry; active mutations must never be evicted or expire.
  private final ConcurrentHashMap<String, CompletableFuture<BulkOperationResult>> active =
      new ConcurrentHashMap<>();
  private final Cache<String, CompletableFuture<BulkOperationResult>> completed;

  public EntityBulkJobs(final Supplier<Executor> executor) {
    this(executor, new Policy(100, 1_000, Duration.ofMinutes(5)), Ticker.systemTicker());
  }

  public EntityBulkJobs(
      final Supplier<Executor> executor, final Policy policy, final Ticker ticker) {
    this.executor = executor;
    this.policy = policy;
    permits = new Semaphore(policy.active());
    completed =
        CacheBuilder.newBuilder()
            .maximumSize(policy.completed())
            .expireAfterWrite(policy.retention())
            .ticker(ticker)
            .build();
  }

  public Job submit(
      final List<?> entities,
      final Supplier<BulkOperationResult> operation,
      final Authorization authorization) {
    acquire();
    final String id = UUID.randomUUID().toString();
    final CompletableFuture<BulkOperationResult> worker;
    try {
      LOG.info(
          "Submitting async bulk operation with jobId: {} for {} entities", id, entities.size());
      worker =
          CompletableFuture.supplyAsync(() -> execute(id, entities, operation), executor.get());
    } catch (RuntimeException | Error failure) {
      permits.release();
      throw failure;
    }
    final CompletableFuture<BulkOperationResult> result =
        worker.thenApply(value -> merge(value, authorization));
    active.put(id, result);
    retireAfterExecution(id, worker, result);
    return new Job(id, result);
  }

  private void acquire() {
    if (!permits.tryAcquire()) {
      throw new WebApplicationException(
          "Too many concurrent bulk jobs (max " + policy.active() + "). Retry later.",
          Status.TOO_MANY_REQUESTS);
    }
  }

  private BulkOperationResult execute(
      final String id, final List<?> entities, final Supplier<BulkOperationResult> operation) {
    try {
      return operation.get();
    } catch (RuntimeException failure) {
      LOG.error("Async bulk operation failed for jobId: {}", id, failure);
      return new BulkOperationResult()
          .withStatus(ApiStatus.FAILURE)
          .withNumberOfRowsFailed(entities.size())
          .withNumberOfRowsPassed(0);
    }
  }

  private BulkOperationResult merge(
      final BulkOperationResult result, final Authorization authorization) {
    if (!authorization.failures().isEmpty()) {
      result.setNumberOfRowsFailed(
          result.getNumberOfRowsFailed() + authorization.failures().size());
      result.setNumberOfRowsProcessed(authorization.totalRequests());
      if (result.getFailedRequest() == null) {
        result.setFailedRequest(new ArrayList<>(authorization.failures()));
      } else {
        result.getFailedRequest().addAll(authorization.failures());
      }
      result.setStatus(
          result.getNumberOfRowsPassed() > 0 ? ApiStatus.PARTIAL_SUCCESS : ApiStatus.FAILURE);
    }
    return result;
  }

  private void retireAfterExecution(
      final String id,
      final CompletableFuture<BulkOperationResult> worker,
      final CompletableFuture<BulkOperationResult> result) {
    result.whenComplete(
        (value, failure) -> {
          if (worker.isDone()) {
            retire(id, result);
          } else {
            // Cancelling an observer cannot release capacity while its accepted DB mutation still
            // runs.
            worker.whenComplete((ignored, error) -> retire(id, result));
          }
        });
  }

  private void retire(final String id, final CompletableFuture<BulkOperationResult> result) {
    try {
      completed.put(id, result);
    } finally {
      active.remove(id);
      permits.release();
    }
  }

  public Optional<BulkOperationResult> status(final String id) {
    final CompletableFuture<BulkOperationResult> running = active.get(id);
    final CompletableFuture<BulkOperationResult> job =
        running != null ? running : completed.getIfPresent(id);
    if (job == null) {
      return Optional.empty();
    }
    if (job.isDone() && !job.isCompletedExceptionally()) {
      return completedResult(id, job);
    }
    return Optional.of(new BulkOperationResult().withStatus(ApiStatus.RUNNING));
  }

  private Optional<BulkOperationResult> completedResult(
      final String id, final CompletableFuture<BulkOperationResult> job) {
    try {
      return Optional.of(job.get());
    } catch (ExecutionException | InterruptedException failure) {
      LOG.error("Error retrieving job status for jobId: {}", id, failure);
      Thread.currentThread().interrupt();
      return Optional.empty();
    }
  }
}
