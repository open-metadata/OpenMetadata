package org.openmetadata.service.exception;

import jakarta.ws.rs.core.Response;
import org.openmetadata.sdk.exception.WebServiceException;

/**
 * Exception thrown when importing ODCS data contracts fails
 */
public class DataContractImportException extends WebServiceException {
  private static final String ERROR_TYPE = "DATA_CONTRACT_IMPORT_ERROR";

  public DataContractImportException(String message) {
    super(Response.Status.CONFLICT, ERROR_TYPE, message);
  }

  public DataContractImportException(String message, Throwable cause) {
    super(Response.Status.CONFLICT, ERROR_TYPE, message, cause);
  }
}
