package org.openmetadata.service.exception;

import jakarta.ws.rs.core.Response;
import org.openmetadata.sdk.exception.WebServiceException;

public class LimitsException extends WebServiceException {
  private static final String ERROR_TYPE = "LIMITS_EXCEPTION";

  public LimitsException(String message) {
    super(Response.Status.TOO_MANY_REQUESTS, ERROR_TYPE, message);
  }
}
