package org.openmetadata.service.apps.bundles.searchIndex;

import java.util.List;

/**
 * One bulk request on its way to the cluster: what it carries, which send this is, and the deadline
 * fixed when it was flushed. Waiting for permits, retries, and pauses behind an open circuit all
 * carry the same deadline, so none of them can keep a bulk alive past it.
 *
 * <p>{@code bulkAlreadyCounted} is the bulk circuit breaker's per-bulk "counts once" memory: it is
 * false on the first send and stays false while the bulk only ever waits for a pooled connection
 * (those attempts never reach the cluster and never count), but flips to true once a real cluster
 * failure has been recorded, so one bulk's retries cannot open the circuit on their own — and a
 * pool-wait first attempt can no longer hide the real cluster error on the retry. ADR:2026-10-27.
 */
record BulkAttempt<T>(
    List<T> operations,
    long executionId,
    int attemptNumber,
    long deadlineMillis,
    boolean bulkAlreadyCounted) {

  static <T> BulkAttempt<T> first(
      List<T> operations, long executionId, BulkRetryPolicy retryPolicy) {
    long deadline = System.currentTimeMillis() + retryPolicy.maxLifetimeMillis();
    return new BulkAttempt<>(operations, executionId, 0, deadline, false);
  }

  BulkAttempt<T> next() {
    return new BulkAttempt<>(
        operations, executionId, attemptNumber + 1, deadlineMillis, bulkAlreadyCounted);
  }

  /**
   * The retry that follows a failed attempt. A pool-wait timeout never reached the cluster and is
   * not counted by the breaker, so it leaves {@code bulkAlreadyCounted} unchanged; any other failure
   * is a real cluster verdict and marks the bulk as counted so its later retries don't re-count.
   */
  BulkAttempt<T> nextAfterFailure(Throwable error) {
    boolean counted = bulkAlreadyCounted || !BulkConnectionBudget.isPoolWaitTimeout(error);
    return new BulkAttempt<>(operations, executionId, attemptNumber + 1, deadlineMillis, counted);
  }

  int size() {
    return operations.size();
  }

  long remainingMillis() {
    return deadlineMillis - System.currentTimeMillis();
  }

  boolean hasExpired() {
    return remainingMillis() <= 0;
  }

  /** True if waiting {@code delayMillis} would still end before the deadline. */
  boolean outlasts(long delayMillis) {
    return delayMillis < remainingMillis();
  }
}
