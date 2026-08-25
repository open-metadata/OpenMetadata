package org.openmetadata.sdk.exceptions;

public class ApiException extends OpenMetadataException {
  private final String requestId;
  private final String responseBody;

  public ApiException(String message, int statusCode) {
    this(message, statusCode, null, null);
  }

  public ApiException(String message, int statusCode, String responseBody) {
    this(message, statusCode, responseBody, null);
  }

  public ApiException(String message, int statusCode, String responseBody, String requestId) {
    super(message, statusCode);
    this.responseBody = responseBody;
    this.requestId = requestId;
  }

  public ApiException(
      String message, Throwable cause, int statusCode, String responseBody, String requestId) {
    super(message, cause, statusCode, null);
    this.responseBody = responseBody;
    this.requestId = requestId;
  }

  public String getRequestId() {
    return requestId;
  }

  public String getResponseBody() {
    return responseBody;
  }
}
