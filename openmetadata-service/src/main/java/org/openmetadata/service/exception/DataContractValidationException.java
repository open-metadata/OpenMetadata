package org.openmetadata.service.exception;

import jakarta.ws.rs.core.Response;
import org.openmetadata.sdk.exception.WebServiceException;

public class DataContractValidationException extends WebServiceException {
  public static final String DATACONTRACT_VALIDATION_ERROR = "DATACONTRACT_VALIDATION_ERROR";

  public DataContractValidationException(String message) {
    super(Response.Status.INTERNAL_SERVER_ERROR, DATACONTRACT_VALIDATION_ERROR, message);
  }

  public DataContractValidationException(Response.Status status, String message) {
    super(status.getStatusCode(), DATACONTRACT_VALIDATION_ERROR, message);
  }

  public static DataContractValidationException byMessage(String errorMessage) {
    return new DataContractValidationException(errorMessage);
  }
}
