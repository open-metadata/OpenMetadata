package org.openmetadata.service.exception;

import jakarta.ws.rs.core.Response;

public class AuthenticationException extends WebServiceException {
  private static final String MESSAGE = "Authentication failed";

  public AuthenticationException(String message) {
    super(Response.Status.UNAUTHORIZED, message);
  }

  public AuthenticationException(String message, Throwable cause) {
    super(Response.Status.UNAUTHORIZED, message, cause);
  }
}
