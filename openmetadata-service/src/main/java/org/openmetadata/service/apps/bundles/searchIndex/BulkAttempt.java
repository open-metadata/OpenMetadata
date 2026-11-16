package org.openmetadata.service.apps.bundles.searchIndex;

import java.util.List;

/**
 * One bulk request on its way to the cluster: what it carries, which send this is, and the deadline
 * fixed when it was flushed. Waiting for permits, retries, and pauses behind an open circuit all
 * carry the same deadline, so none of them can keep a bulk alive past it.
 * ADR:2026-10-27-bulk-requests-never-outnumber-search-connections
 */
record BulkAttempt<T>(
    List<T> operations, long executionId, int attemptNumber, long deadlineMillis) {

  static <T> BulkAttempt<T> first(
      List<T> operations, long executionId, BulkRetryPolicy retryPolicy) {
    long deadline = System.currentTimeMillis() + retryPolicy.maxLifetimeMillis();
    return new BulkAttempt<>(operations, executionId, 0, deadline);
  }

  BulkAttempt<T> next() {
    return new BulkAttempt<>(operations, executionId, attemptNumber + 1, deadlineMillis);
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
