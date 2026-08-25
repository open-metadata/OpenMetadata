package org.openmetadata.sdk.exception;

import jakarta.ws.rs.core.Response;

public class SuggestionException extends WebServiceException {
  private static final String BY_NAME_MESSAGE =
      "Search Index Not Found Exception [%s] due to [%s].";
  private static final String ERROR_TYPE = "SUGGESTION_EXCEPTION";

  public SuggestionException(String message) {
    super(Response.Status.INTERNAL_SERVER_ERROR, ERROR_TYPE, message);
  }

  private SuggestionException(Response.Status status, String message) {
    super(status, ERROR_TYPE, message);
  }

  public SuggestionException(Response.Status status, String errorType, String message) {
    super(status, errorType, message);
  }

  public static SuggestionException byMessage(
      String name, String errorMessage, Response.Status status) {
    return new SuggestionException(status, buildMessageByName(name, errorMessage));
  }

  public static SuggestionException byMessage(
      String name, String errorType, String errorMessage, Response.Status status) {
    return new SuggestionException(status, errorType, buildMessageByName(name, errorMessage));
  }

  public static SuggestionException byMessage(String name, String errorMessage) {
    return new SuggestionException(
        Response.Status.BAD_REQUEST, buildMessageByName(name, errorMessage));
  }

  private static String buildMessageByName(String name, String errorMessage) {
    return String.format(BY_NAME_MESSAGE, name, errorMessage);
  }
}
