package org.openmetadata.service.util;

/**
 * Custom assertion error that can be used for retryable test assertions.
 * This is used by test infrastructure to distinguish between errors that
 * should trigger a retry vs those that should fail immediately.
 */
public class RetryableAssertionError extends Exception {

  public RetryableAssertionError(String message) {
    super(message);
  }

  public RetryableAssertionError(String message, Throwable cause) {
    super(message, cause);
  }

  public RetryableAssertionError(Throwable cause) {
    super(cause);
  }
}
