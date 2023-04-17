package org.openmetadata.service.exception;

import javax.ws.rs.core.Response;
import org.openmetadata.sdk.exception.WebServiceException;

public class CustomExceptionMessage extends WebServiceException {
  public CustomExceptionMessage(Response.Status status, String message) {
    super(status.getStatusCode(), message);
  }

  public CustomExceptionMessage(int status, String message) {
    super(status, message);
  }
}
