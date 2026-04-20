package org.openmetadata.service.exception;

import jakarta.ws.rs.core.Response;
import org.openmetadata.sdk.exception.WebServiceException;

public class SystemSettingsException extends WebServiceException {
  private static final String ERROR_TYPE = "SYSTEM_SETTINGS_EXCEPTION";

  public SystemSettingsException(String message) {
    super(Response.Status.BAD_REQUEST, ERROR_TYPE, message);
  }

  private SystemSettingsException(Response.Status status, String message) {
    super(status, ERROR_TYPE, message);
  }

  public static SystemSettingsException forbidden(String message) {
    return new SystemSettingsException(Response.Status.FORBIDDEN, message);
  }
}
