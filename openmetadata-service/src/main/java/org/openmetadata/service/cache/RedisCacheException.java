package org.openmetadata.service.cache;

/**
 * Exception thrown when Redis cache operations fail
 */
public class RedisCacheException extends Exception {

  public RedisCacheException(String message) {
    super(message);
  }

  public RedisCacheException(String message, Throwable cause) {
    super(message, cause);
  }

  public RedisCacheException(Throwable cause) {
    super(cause);
  }
}
