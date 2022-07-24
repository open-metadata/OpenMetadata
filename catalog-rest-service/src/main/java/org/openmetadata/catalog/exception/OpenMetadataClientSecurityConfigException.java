package org.openmetadata.catalog.exception;

import javax.ws.rs.core.Response;

public class OpenMetadataClientSecurityConfigException extends WebServiceException {
  private static final String BY_NAME_MESSAGE = "Airflow Exception [%s] due to [%s].";

  public OpenMetadataClientSecurityConfigException(String message) {
    super(Response.Status.BAD_REQUEST, message);
  }

  private OpenMetadataClientSecurityConfigException(Response.Status status, String message) {
    super(status, message);
  }

  public static OpenMetadataClientSecurityConfigException byMessage(
      String name, String errorMessage, Response.Status status) {
    return new OpenMetadataClientSecurityConfigException(status, buildMessageByName(name, errorMessage));
  }

  public static OpenMetadataClientSecurityConfigException byMessage(String name, String errorMessage) {
    return new OpenMetadataClientSecurityConfigException(
        Response.Status.BAD_REQUEST, buildMessageByName(name, errorMessage));
  }

  private static String buildMessageByName(String name, String errorMessage) {
    return String.format(BY_NAME_MESSAGE, name, errorMessage);
  }
}
