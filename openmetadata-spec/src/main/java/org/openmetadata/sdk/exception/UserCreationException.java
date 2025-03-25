package org.openmetadata.sdk.exception;

import jakarta.ws.rs.core.Response;

public class UserCreationException extends WebServiceException {
  private static final String BY_NAME_MESSAGE = "User Creation Exception [%s] due to [%s].";
  private static final String ERROR_TYPE = "USER_CREATION_EXCEPTION";

  public UserCreationException(String message) {
    super(Response.Status.INTERNAL_SERVER_ERROR, ERROR_TYPE, message);
  }

  private UserCreationException(Response.Status status, String message) {
    super(status, ERROR_TYPE, message);
  }

  public UserCreationException(Response.Status status, String errorType, String message) {
    super(status, errorType, message);
  }

  public static UserCreationException byMessage(
      String name, String errorMessage, Response.Status status) {
    return new UserCreationException(status, buildMessageByName(name, errorMessage));
  }

  public static UserCreationException byMessage(
      String name, String errorType, String errorMessage, Response.Status status) {
    return new UserCreationException(status, errorType, buildMessageByName(name, errorMessage));
  }

  public static UserCreationException byMessage(String name, String errorMessage) {
    return new UserCreationException(
        Response.Status.BAD_REQUEST, buildMessageByName(name, errorMessage));
  }

  private static String buildMessageByName(String name, String errorMessage) {
    return String.format(BY_NAME_MESSAGE, name, errorMessage);
  }
}
