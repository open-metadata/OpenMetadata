package org.openmetadata.service.exception;

import org.openmetadata.service.events.errors.RetriableException;

public class AlertRetriableException extends RetriableException {
  private static final long serialVersionUID = 1L;

  public AlertRetriableException(String message) {
    super(message);
  }

  public AlertRetriableException(Throwable cause) {
    super(cause);
  }
}
