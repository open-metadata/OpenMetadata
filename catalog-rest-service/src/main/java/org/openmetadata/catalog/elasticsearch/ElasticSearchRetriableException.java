package org.openmetadata.catalog.elasticsearch;

import org.openmetadata.catalog.events.errors.RetriableException;

public class ElasticSearchRetriableException extends RetriableException {
  private static final long serialVersionUID = 1L;

  public ElasticSearchRetriableException() {
    super();
  }

  public ElasticSearchRetriableException(String message, Throwable cause) {
    super(message, cause);
  }

  public ElasticSearchRetriableException(String message) {
    super(message);
  }

  public ElasticSearchRetriableException(Throwable cause) {
    super(cause);
  }
}
