package org.openmetadata.sdk.exception;

public class ResourceInitializationException extends RuntimeException {
  private final String entityType;
  private final String message;

  public ResourceInitializationException(String entityType, String message) {
    super(message);
    this.entityType = entityType;
    this.message = message;
  }

  public ResourceInitializationException(String entityType, String message, Throwable cause) {
    super(message, cause);
    this.entityType = entityType;
    this.message = message;
  }
}
