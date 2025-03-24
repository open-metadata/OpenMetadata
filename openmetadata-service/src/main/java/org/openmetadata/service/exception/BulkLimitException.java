package org.openmetadata.service.exception;

import javax.ws.rs.core.Response;
import org.openmetadata.sdk.exception.WebServiceException;

public class BulkLimitException extends WebServiceException {
  private static final String BATCH_ERROR_TYPE = "BULK_LIMIT_EXCEPTION";

  public BulkLimitException(String message) {
    super(Response.Status.REQUEST_ENTITY_TOO_LARGE, BATCH_ERROR_TYPE, message);
  }
}
