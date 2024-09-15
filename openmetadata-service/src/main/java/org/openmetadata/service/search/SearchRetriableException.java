package org.openmetadata.service.search;

import org.openmetadata.service.events.errors.RetriableException;

public class SearchRetriableException extends RetriableException {
  private static final long serialVersionUID = 1L;

  public SearchRetriableException(String message, Throwable cause) {
    super(message, cause);
  }

  public SearchRetriableException(String message) {
    super(message);
  }
}
