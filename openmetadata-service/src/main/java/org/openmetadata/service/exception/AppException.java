package org.openmetadata.service.exception;

import jakarta.ws.rs.core.Response;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.sdk.exception.WebServiceException;

public class AppException extends WebServiceException {
  public static final String APP_EXTENSION_NOT_FOUND = "No Available Application Extension";
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

  public static AppException byExtension(AppExtension.ExtensionType extensionType) {
    return new AppException(
        String.format("%s: %s", APP_EXTENSION_NOT_FOUND, extensionType.toString()));
  }
}
