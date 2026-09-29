package org.openmetadata.service.search.vector.client;

/**
 * Thrown by {@link EmbeddingClient#embed} while the provider circuit breaker is open, so callers can
 * skip embedding as a soft, recoverable condition instead of treating it as a hard error worth a
 * per-entity stack trace.
 */
public class EmbeddingUnavailableException extends RuntimeException {
  public EmbeddingUnavailableException(String message) {
    super(message);
  }
}
