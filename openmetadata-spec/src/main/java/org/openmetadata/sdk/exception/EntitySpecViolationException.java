package org.openmetadata.sdk.exception;

import jakarta.ws.rs.core.Response;

public class EntitySpecViolationException extends WebServiceException {
  private static final String BY_NAME_MESSAGE = "Entity Spec Violation [%s] due to [%s].";
  private static final String ERROR_TYPE = "ENTITY_SPEC_VIOLATION";

  public EntitySpecViolationException(String message) {
    super(Response.Status.BAD_REQUEST, ERROR_TYPE, message);
  }

  public EntitySpecViolationException(Response.Status status, String message) {
    super(status, ERROR_TYPE, message);
  }

  public static EntitySpecViolationException byMessage(
      String name, String errorMessage, Response.Status status) {
    return new EntitySpecViolationException(status, buildMessageByName(name, errorMessage));
  }

  public static EntitySpecViolationException byMessage(String name, String errorMessage) {
    return new EntitySpecViolationException(
        Response.Status.BAD_REQUEST, buildMessageByName(name, errorMessage));
  }

  private static String buildMessageByName(String name, String errorMessage) {
    return String.format(BY_NAME_MESSAGE, name, errorMessage);
  }
}
