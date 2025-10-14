package org.openmetadata.service.exception;

import jakarta.ws.rs.core.Response;
import org.openmetadata.sdk.exception.WebServiceException;

public class CustomExceptionMessage extends WebServiceException {
  public CustomExceptionMessage(Response.Status status, String errorType, String message) {
    super(Response.Status.fromStatusCode(status.getStatusCode()), errorType, message);
  }

  public CustomExceptionMessage(Response response, String message) {
    super(Response.Status.fromStatusCode(response.getStatus()), response.toString(), message);
  }

  public CustomExceptionMessage(int status, String errorType, String message) {
    super(Response.Status.fromStatusCode(status), errorType, message);
  }
}
