package org.openmetadata.sdk.exception;

import jakarta.ws.rs.core.Response;

public class EntityUpdateException extends WebServiceException {
  private static final String BY_NAME_MESSAGE = "Entity Update Exception [%s] due to [%s].";
  private static final String ERROR_TYPE = "ENTITY_UPDATE_EXCEPTION";

  public EntityUpdateException(String message) {
    super(Response.Status.BAD_REQUEST, ERROR_TYPE, message);
  }

  public EntityUpdateException(Response.Status status, String message) {
    super(status, ERROR_TYPE, message);
  }

  public static EntityUpdateException byMessage(
      String name, String errorMessage, Response.Status status) {
    return new EntityUpdateException(status, buildMessageByName(name, errorMessage));
  }

  public static EntityUpdateException byMessage(String name, String errorMessage) {
    return new EntityUpdateException(
        Response.Status.BAD_REQUEST, buildMessageByName(name, errorMessage));
  }

  private static String buildMessageByName(String name, String errorMessage) {
    return String.format(BY_NAME_MESSAGE, name, errorMessage);
  }
}
