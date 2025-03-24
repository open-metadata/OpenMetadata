package org.openmetadata.service.exception;

public class EventSubscriptionJobException extends RuntimeException {
  public EventSubscriptionJobException(String message) {
    super(message);
  }

  public EventSubscriptionJobException(String message, Throwable throwable) {
    super(message, throwable);
  }

  public EventSubscriptionJobException(Throwable throwable) {
    super(throwable);
  }
}
