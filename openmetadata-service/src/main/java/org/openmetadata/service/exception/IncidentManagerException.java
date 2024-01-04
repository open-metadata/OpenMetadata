package org.openmetadata.service.exception;

import javax.ws.rs.core.Response;
import org.openmetadata.sdk.exception.WebServiceException;

public class IncidentManagerException extends WebServiceException {

  protected IncidentManagerException(Response.Status status, String message) {
    super(status.getStatusCode(), message);
  }

  public IncidentManagerException(String message) {
    super(Response.Status.INTERNAL_SERVER_ERROR, message);
  }
}
