package org.openmetadata.sdk.exceptions;

public class RateLimitException extends OpenMetadataException {
  private final long retryAfterSeconds;

  public RateLimitException(String message) {
    this(message, -1);
  }

  public RateLimitException(String message, long retryAfterSeconds) {
    super(message, 429);
    this.retryAfterSeconds = retryAfterSeconds;
  }

  public long getRetryAfterSeconds() {
    return retryAfterSeconds;
  }
}
