package org.openmetadata.sdk.exception;

import lombok.Getter;

@Getter
public class SchemaProcessingException extends Exception {
  public enum ErrorType {
    RESOURCE_NOT_FOUND,
    UNSUPPORTED_URL,
    OTHER
  }

  private final ErrorType errorType;

  public SchemaProcessingException(String message, ErrorType errorType) {
    super(message);
    this.errorType = errorType;
  }

  public SchemaProcessingException(String message, Throwable cause, ErrorType errorType) {
    super(message, cause);
    this.errorType = errorType;
  }
}
