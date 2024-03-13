package org.openmetadata.service.apps;

import javax.ws.rs.core.Response;
import org.openmetadata.sdk.exception.WebServiceException;

public class AppException extends WebServiceException {

  private static final String BY_NAME_MESSAGE = "Application [%s] Exception [%s] due to [%s].";
  private static final String ERROR_TYPE = "PIPELINE_SERVICE_ERROR";

  public AppException(String message) {
    super(Response.Status.BAD_REQUEST, ERROR_TYPE, message);
  }

  private AppException(Response.Status status, String message) {
    super(status, ERROR_TYPE, message);
  }

  public static AppException byMessage(
      String appName, String name, String errorMessage, Response.Status status) {
    return new AppException(status, buildMessageByName(appName, name, errorMessage));
  }

  public static AppException byMessage(String appName, String name, String errorMessage) {
    return new AppException(
        Response.Status.BAD_REQUEST, buildMessageByName(appName, name, errorMessage));
  }

  private static String buildMessageByName(String appName, String name, String errorMessage) {
    return String.format(BY_NAME_MESSAGE, appName, name, errorMessage);
  }
}
