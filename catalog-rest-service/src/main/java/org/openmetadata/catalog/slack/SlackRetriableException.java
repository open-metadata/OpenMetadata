package org.openmetadata.catalog.slack;

import org.openmetadata.catalog.events.errors.RetriableException;

public class SlackRetriableException extends RetriableException {
  private static final long serialVersionUID = 1L;

  public SlackRetriableException() {
    super();
  }

  public SlackRetriableException(String message, Throwable cause) {
    super(message, cause);
  }

  public SlackRetriableException(String message) {
    super(message);
  }

  public SlackRetriableException(Throwable cause) {
    super(cause);
  }
}
