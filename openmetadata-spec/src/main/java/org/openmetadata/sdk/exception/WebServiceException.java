package org.openmetadata.sdk.exception;

import jakarta.ws.rs.core.Response;

public class WebServiceException extends RuntimeException {
  /**
   * Raw HTTP status code as passed by the caller. Kept as an int (not a {@link Response.Status})
   * so non-enum codes such as 424 (Failed Dependency) survive end-to-end: {@code
   * Response.Status.fromStatusCode(424)} returns {@code null}, which would otherwise make {@link
   * #getResponse()} throw {@link IllegalArgumentException} inside the exception mapper and surface
   * as a generic 500. Restores the pre-bb1395fc72 contract where the int-accepting constructor
   * built {@code Response.status(int)} directly.
   */
  private final int statusCode;

  private final String errorType;
  private final String message;

  public WebServiceException(Response.Status status, String errorType, String message) {
    super(message);
    this.statusCode = status.getStatusCode();
    this.errorType = errorType;
    this.message = message;
  }

  public WebServiceException(int status, String errorType, String message) {
    super(message);
    this.statusCode = status;
    this.errorType = errorType;
    this.message = message;
  }

  public WebServiceException(
      Response.Status status, String errorType, String message, Throwable cause) {
    super(message, cause);
    this.statusCode = status.getStatusCode();
    this.errorType = errorType;
    this.message = message;
  }

  public String getErrorType() {
    return errorType;
  }

  public Response getResponse() {
    return Response.status(statusCode)
        .type(jakarta.ws.rs.core.MediaType.APPLICATION_JSON_TYPE)
        .entity(new ErrorMessage(statusCode, errorType, message))
        .build();
  }

  public static class ErrorMessage {
    private final int code;
    private final String errorType;
    private final String message;

    public ErrorMessage(int code, String errorType, String message) {
      this.code = code;
      this.errorType = errorType;
      this.message = message;
    }

    public int getCode() {
      return code;
    }

    public String getErrorType() {
      return errorType;
    }

    public String getMessage() {
      return message;
    }
  }
}
