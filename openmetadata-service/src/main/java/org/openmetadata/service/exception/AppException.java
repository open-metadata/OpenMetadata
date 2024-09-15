package org.openmetadata.service.exception;

import javax.ws.rs.core.Response;
import org.openmetadata.sdk.exception.WebServiceException;

public class AppException extends WebServiceException {
  public static final String APP_RUN_RECORD_NOT_FOUND = "No Available Application Run Records.";
  private static final String ERROR_TYPE = "APP_ERROR";

  public AppException(String message) {
    super(Response.Status.INTERNAL_SERVER_ERROR, ERROR_TYPE, message);
  }

  private AppException(Response.Status status, String message) {
    super(status, ERROR_TYPE, message);
  }

  public static AppException byMessage(Response.Status status, String errorMessage) {
    return new AppException(status, errorMessage);
  }
}
