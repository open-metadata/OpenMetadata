package org.openmetadata.service.exception;

import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;

public class WebServiceException extends WebApplicationException {
  public WebServiceException(Response.Status status, String message) {
    super(message, status);
  }

  public WebServiceException(Response.Status status, String message, Throwable cause) {
    super(message, cause, status);
  }
}
