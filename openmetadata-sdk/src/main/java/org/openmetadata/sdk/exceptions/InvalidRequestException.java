package org.openmetadata.sdk.exceptions;

public class InvalidRequestException extends OpenMetadataException {
  public InvalidRequestException(String message) {
    super(message, 400);
  }

  public InvalidRequestException(String message, Throwable cause) {
    super(message, cause, 400, null);
  }

  public InvalidRequestException(String message, String errorCode) {
    super(message, 400, errorCode);
  }
}
