package org.openmetadata.catalog.events.errors;

/** A retriable exception is a transient exception that if retried may succeed. */
public abstract class RetriableException extends EventPublisherException {

  private static final long serialVersionUID = 1L;

  protected RetriableException(String message, Throwable cause) {
    super(message, cause);
  }

  protected RetriableException(String message) {
    super(message);
  }

  protected RetriableException(Throwable cause) {
    super(cause);
  }
}
