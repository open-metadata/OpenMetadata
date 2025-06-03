package org.openmetadata.service.exception;

import jakarta.ws.rs.core.Response;
import org.openmetadata.sdk.exception.WebServiceException;

public class InvalidServiceConnectionException extends WebServiceException {
  private static final String BY_NAME_MESSAGE =
      "InvalidServiceConnectionException for service [%s] due to [%s].";
  private static final String ERROR_TYPE = "INVALID_SERVICE_EXCEPTION";

  public InvalidServiceConnectionException(String message) {
    super(Response.Status.BAD_REQUEST, ERROR_TYPE, message);
  }

  public InvalidServiceConnectionException(String message, Throwable e) {
    super(Response.Status.BAD_REQUEST, ERROR_TYPE, message, e);
  }

  private InvalidServiceConnectionException(Response.Status status, String message) {
    super(status, ERROR_TYPE, message);
  }

  public static InvalidServiceConnectionException byMessage(
      String name, String errorMessage, Response.Status status) {
    return new InvalidServiceConnectionException(status, buildMessageByName(name, errorMessage));
  }

  public static InvalidServiceConnectionException byMessage(String name, String errorMessage) {
    return new InvalidServiceConnectionException(
        Response.Status.BAD_REQUEST, buildMessageByName(name, errorMessage));
  }

  private static String buildMessageByName(String name, String errorMessage) {
    return String.format(BY_NAME_MESSAGE, name, errorMessage);
  }
}
