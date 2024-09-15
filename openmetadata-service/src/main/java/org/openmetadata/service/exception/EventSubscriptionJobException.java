package org.openmetadata.service.exception;

public class EventSubscriptionJobException extends RuntimeException {
  public EventSubscriptionJobException(String message) {
    super(message);
  }

  public EventSubscriptionJobException(Throwable throwable) {
    super(throwable);
  }
}
