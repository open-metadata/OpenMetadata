package org.openmetadata.service.apps.bundles.searchIndex;

import java.util.List;
import java.util.Locale;

/**
 * How a failed bulk request is re-sent: how many times, the exponential backoff between attempts,
 * which failures are worth re-sending at all, and how long a bulk may keep trying. Reindex sinks
 * build it from the app's Max Retries / Initial Backoff / Max Backoff settings; live indexing and the
 * search retry worker use {@link #LIVE}.
 */
public record BulkRetryPolicy(
    int maxRetries, long initialBackoffMillis, long maxBackoffMillis, long maxLifetimeMillis) {

  /**
   * How long after its flush a reindex bulk may wait for permits, retry, or wait out an open circuit.
   * A PartitionWorker reconciles sink operations still pending after roughly three minutes, so a
   * bulk must be written or recorded as failed well before that, whatever backoff is configured.
   */
  static final long DEFAULT_MAX_LIFETIME_MILLIS = 120_000;

  /**
   * How long a live write may try. Live indexing runs on the request thread, so a write that cannot
   * reach the cluster within this goes to the search retry queue instead of holding the request.
   */
  static final long LIVE_MAX_LIFETIME_MILLIS = 10_000;

  public static final BulkRetryPolicy LIVE =
      new BulkRetryPolicy(3, 100, 10_000, LIVE_MAX_LIFETIME_MILLIS);

  private static final int MAX_BACKOFF_DOUBLINGS = 20;
  private static final int TOO_MANY_REQUESTS = 429;
  private static final int SERVICE_UNAVAILABLE = 503;
  private static final List<String> CAPACITY_REJECTION_MARKERS =
      List.of(
          "rejected_execution_exception",
          "esrejectedexecutionexception",
          "circuit_breaking_exception",
          "too_many_requests");
  private static final List<String> RETRYABLE_ERROR_MARKERS =
      List.of(
          "rejected_execution_exception",
          "esrejectedexecutionexception",
          "remotetransportexception",
          "connectexception",
          "timeout",
          "request entity too large",
          "content too long",
          "413",
          "circuit_breaking_exception",
          "too_many_requests");

  public BulkRetryPolicy {
    maxRetries = Math.max(0, maxRetries);
    initialBackoffMillis = Math.max(0, initialBackoffMillis);
    maxBackoffMillis = Math.max(initialBackoffMillis, maxBackoffMillis);
    maxLifetimeMillis = Math.max(0, maxLifetimeMillis);
  }

  public BulkRetryPolicy(int maxRetries, long initialBackoffMillis, long maxBackoffMillis) {
    this(maxRetries, initialBackoffMillis, maxBackoffMillis, DEFAULT_MAX_LIFETIME_MILLIS);
  }

  boolean shouldRetry(int attemptNumber, Throwable error) {
    return attemptNumber < maxRetries && isRetryable(error);
  }

  long backoffMillis(int attemptNumber) {
    long backoff = initialBackoffMillis << Math.min(attemptNumber, MAX_BACKOFF_DOUBLINGS);
    return Math.min(maxBackoffMillis, backoff);
  }

  /**
   * True when the cluster turned a single bulk item away because it had no capacity for it right
   * then, rather than because the document itself is unacceptable. Indexing-pressure rejections
   * and circuit-breaker trips clear on their own, so the item is worth re-sending; a mapping
   * conflict, a version conflict or a missing document is not.
   * ADR:2026-11-24-bulk-items-rejected-for-capacity-are-re-sent
   */
  public static boolean isCapacityRejection(int status, String reason) {
    return status == TOO_MANY_REQUESTS
        || status == SERVICE_UNAVAILABLE
        || (reason != null
            && containsMarker(reason.toLowerCase(Locale.ROOT), CAPACITY_REJECTION_MARKERS));
  }

  private static boolean isRetryable(Throwable error) {
    return BulkConnectionBudget.isPoolWaitTimeout(error) || hasRetryableMessage(error.getMessage());
  }

  private static boolean hasRetryableMessage(String message) {
    return message == null
        || containsMarker(message.toLowerCase(Locale.ROOT), RETRYABLE_ERROR_MARKERS);
  }

  private static boolean containsMarker(String lowerCaseMessage, List<String> markers) {
    return markers.stream().anyMatch(lowerCaseMessage::contains);
  }
}
