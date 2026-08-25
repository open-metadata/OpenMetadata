package org.openmetadata.sdk.exceptions;

public class OpenMetadataException extends RuntimeException {
  private final int statusCode;
  private final String errorCode;

  public OpenMetadataException(String message) {
    this(message, null, -1, null);
  }

  public OpenMetadataException(String message, Throwable cause) {
    this(message, cause, -1, null);
  }

  public OpenMetadataException(String message, int statusCode) {
    this(message, null, statusCode, null);
  }

  public OpenMetadataException(String message, int statusCode, String errorCode) {
    this(message, null, statusCode, errorCode);
  }

  public OpenMetadataException(String message, Throwable cause, int statusCode, String errorCode) {
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

  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append(getClass().getSimpleName());
    if (statusCode > 0) {
      sb.append(" (").append(statusCode).append(")");
    }
    if (errorCode != null) {
      sb.append(" [").append(errorCode).append("]");
    }
    sb.append(": ").append(getMessage());
    return sb.toString();
  }
}
