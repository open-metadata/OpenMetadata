package org.openmetadata.sdk.exceptions;

/** Exception thrown when a request is forbidden (HTTP 403). */
public class ForbiddenException extends OpenMetadataException {

  public ForbiddenException(String message) {
    super(message, 403);
  }

  public ForbiddenException(String message, String responseBody) {
    super(message, 403, responseBody);
  }

  public ForbiddenException(String message, Throwable cause) {
    super(message, cause, 403, null);
  }
}
