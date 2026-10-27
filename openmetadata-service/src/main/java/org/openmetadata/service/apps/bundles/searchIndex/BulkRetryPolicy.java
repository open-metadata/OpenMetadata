package org.openmetadata.service.apps.bundles.searchIndex;

import java.util.List;
import java.util.Locale;

/**
 * How a failed bulk request is re-sent: how many times, the exponential backoff between attempts,
 * and which failures are worth re-sending at all. Reindex sinks build it from the app's Max
 * Retries / Initial Backoff / Max Backoff settings; live-indexing sinks keep {@link #DEFAULT}.
 */
public record BulkRetryPolicy(int maxRetries, long initialBackoffMillis, long maxBackoffMillis) {
  public static final BulkRetryPolicy DEFAULT = new BulkRetryPolicy(3, 100, 10_000);

  private static final int MAX_BACKOFF_DOUBLINGS = 20;
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
  }

  boolean shouldRetry(int attemptNumber, Throwable error) {
    return attemptNumber < maxRetries && isRetryable(error);
  }

  long backoffMillis(int attemptNumber) {
    long backoff = initialBackoffMillis << Math.min(attemptNumber, MAX_BACKOFF_DOUBLINGS);
    return Math.min(maxBackoffMillis, backoff);
  }

  private static boolean isRetryable(Throwable error) {
    return BulkConnectionBudget.isPoolWaitTimeout(error) || hasRetryableMessage(error.getMessage());
  }

  private static boolean hasRetryableMessage(String message) {
    return message == null || containsRetryableMarker(message.toLowerCase(Locale.ROOT));
  }

  private static boolean containsRetryableMarker(String lowerCaseMessage) {
    return RETRYABLE_ERROR_MARKERS.stream().anyMatch(lowerCaseMessage::contains);
  }
}
