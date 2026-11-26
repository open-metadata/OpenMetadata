package org.openmetadata.service.search.vector;

/**
 * Vector search cannot run: no index it reads can hold the embedding model's vectors until they
 * are rebuilt. The message says which, and the way out.
 */
public class VectorSearchUnavailableException extends RuntimeException {
  public VectorSearchUnavailableException(String message) {
    super(message);
  }
}
