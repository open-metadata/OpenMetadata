package org.openmetadata.sdk.exceptions;

public class InvalidRequestException extends OpenMetadataException {
  private final String responseBody;

  public InvalidRequestException(String message) {
    super(message, 400);
    this.responseBody = null;
  }

  public InvalidRequestException(String message, Throwable cause) {
    super(message, cause, 400, null);
    this.responseBody = null;
  }

  public InvalidRequestException(String message, String errorCode) {
    super(message, 400, errorCode);
    this.responseBody = null;
  }

  public InvalidRequestException(String message, String errorCode, String responseBody) {
    super(message, 400, errorCode);
    this.responseBody = responseBody;
  }

  public String getResponseBody() {
    return responseBody;
  }
}
