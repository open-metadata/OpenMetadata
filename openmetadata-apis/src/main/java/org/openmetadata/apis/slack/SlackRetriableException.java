package org.openmetadata.apis.slack;

import org.openmetadata.apis.events.errors.RetriableException;

public class SlackRetriableException extends RetriableException {
  private static final long serialVersionUID = 1L;

  public SlackRetriableException(String message) {
    super(message);
  }

  public SlackRetriableException(Throwable cause) {
    super(cause);
  }
}
