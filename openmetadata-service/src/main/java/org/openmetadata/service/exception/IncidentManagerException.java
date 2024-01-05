package org.openmetadata.service.exception;

import javax.ws.rs.core.Response;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.sdk.exception.WebServiceException;

public class IncidentManagerException extends WebServiceException {

  protected IncidentManagerException(Response.Status status, String message) {
    super(status.getStatusCode(), message);
  }

  public IncidentManagerException(String message) {
    super(Response.Status.INTERNAL_SERVER_ERROR, message);
  }

  public static IncidentManagerException invalidStatus(
      TestCaseResolutionStatusTypes lastStatus, TestCaseResolutionStatusTypes newStatus) {
    return new IncidentManagerException(
        Response.Status.BAD_REQUEST,
        String.format("Incident with status [%s] cannot be moved to [%s]", lastStatus, newStatus));
  }
}
