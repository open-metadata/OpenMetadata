package org.openmetadata.sdk.exceptions;

/** Exception thrown when a 409 Conflict HTTP status is received. */
public class ConflictException extends OpenMetadataException {
  public ConflictException(String message) {
    super(message, 409);
  }

  public ConflictException(String message, Throwable cause) {
    super(message, cause, 409, null);
  }

  public ConflictException(String message, String errorCode) {
    super(message, 409, errorCode);
  }
}
