package org.openmetadata.catalog.exception;

import javax.ws.rs.core.Response;

public class InvalidServiceConnectionException extends WebServiceException {
  private static final String BY_NAME_MESSAGE = "InvalidServiceConnectionException for service [%s] due to [%s].";

  public InvalidServiceConnectionException(String message) {
    super(Response.Status.BAD_REQUEST, message);
  }

  private InvalidServiceConnectionException(Response.Status status, String message) {
    super(status, message);
  }

  public static InvalidServiceConnectionException byMessage(String name, String errorMessage, Response.Status status) {
    return new InvalidServiceConnectionException(status, buildMessageByName(name, errorMessage));
  }

  public static InvalidServiceConnectionException byMessage(String name, String errorMessage) {
    return new InvalidServiceConnectionException(Response.Status.BAD_REQUEST, buildMessageByName(name, errorMessage));
  }

  private static String buildMessageByName(String name, String errorMessage) {
    return String.format(BY_NAME_MESSAGE, name, errorMessage);
  }
}
