package org.openmetadata.sdk.exception;

import jakarta.ws.rs.core.Response;

public class AttachmentException extends WebServiceException {
  private static final String BY_NAME_MESSAGE = "Attachment Exception [%s] due to [%s].";
  private static final String ERROR_TYPE = "ATTACHMENT_ERROR";

  public AttachmentException(String message) {
    super(Response.Status.BAD_REQUEST, ERROR_TYPE, message);
  }

  public AttachmentException(Response.Status status, String message) {
    super(status, ERROR_TYPE, message);
  }

  public static AttachmentException byMessage(
      String name, String errorMessage, Response.Status status) {
    return new AttachmentException(status, buildMessageByName(name, errorMessage));
  }

  public static AttachmentException byMessage(String name, String errorMessage) {
    return new AttachmentException(
        Response.Status.BAD_REQUEST, buildMessageByName(name, errorMessage));
  }

  private static String buildMessageByName(String name, String errorMessage) {
    return String.format(BY_NAME_MESSAGE, name, errorMessage);
  }
}
