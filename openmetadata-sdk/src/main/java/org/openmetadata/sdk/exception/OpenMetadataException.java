package org.openmetadata.sdk.exception;

public class OpenMetadataException extends Exception {
  private int statusCode;
  private String errorCode;

  public OpenMetadataException(String message) {
    super(message);
  }

  public OpenMetadataException(String message, Throwable cause) {
    super(message, cause);
  }

  public OpenMetadataException(int statusCode, String message) {
    super(message);
    this.statusCode = statusCode;
  }

  public OpenMetadataException(int statusCode, String errorCode, String message) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }

  public OpenMetadataException(int statusCode, String errorCode, String message, Throwable cause) {
    super(message, cause);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }

  public int getStatusCode() {
    return statusCode;
  }

  public String getErrorCode() {
    return errorCode;
  }
}
