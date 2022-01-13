package org.openmetadata.catalog.events.errors;

public class EventPublisherException extends RuntimeException {
  private static final long serialVersionUID = 1L;

  public EventPublisherException(String message, Throwable cause) {
    super(message, cause);
  }

  public EventPublisherException(String message) {
    super(message);
  }

  public EventPublisherException(Throwable cause) {
    super(cause);
  }

  public EventPublisherException() {
    super();
  }
}
