package org.openmetadata.service.elasticsearch;

import org.openmetadata.service.events.errors.RetriableException;

public class ElasticSearchRetriableException extends RetriableException {
  private static final long serialVersionUID = 1L;

  public ElasticSearchRetriableException(String message, Throwable cause) {
    super(message, cause);
  }

  public ElasticSearchRetriableException(String message) {
    super(message);
  }
}
