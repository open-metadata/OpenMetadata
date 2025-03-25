package org.openmetadata.sdk.exception;

import jakarta.ws.rs.core.Response;

public class WebServiceException extends RuntimeException {
  private final Response.Status status;
  private final String errorType;
  private final String message;

  public WebServiceException(Response.Status status, String errorType, String message) {
    super(message);
    this.status = status;
    this.errorType = errorType;
    this.message = message;
  }

  public WebServiceException(Response.Status status, String errorType, String message, Throwable cause) {
    super(message, cause);
    this.status = status;
    this.errorType = errorType;
    this.message = message;
  }

  public Response getResponse() {
    return Response.status(status)
        .type(jakarta.ws.rs.core.MediaType.APPLICATION_JSON_TYPE)
        .entity(new ErrorMessage(status.getStatusCode(), errorType, message))
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