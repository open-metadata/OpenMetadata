package org.openmetadata.sdk.exception;

import jakarta.ws.rs.core.Response;

public class SearchException extends WebServiceException {
  private static final String BY_NAME_MESSAGE =
      "Search Index Not Found Exception [%s] due to [%s].";
  private static final String ERROR_TYPE = "SEARCH_ERROR";

  public SearchException(String message) {
    super(Response.Status.INTERNAL_SERVER_ERROR, ERROR_TYPE, message);
  }

  private SearchException(Response.Status status, String message) {
    super(status, ERROR_TYPE, message);
  }

  public static SearchException byMessage(
      String name, String errorMessage, Response.Status status) {
    return new SearchException(status, buildMessageByName(name, errorMessage));
  }

  public static SearchException byMessage(String name, String errorMessage) {
    return new SearchException(Response.Status.BAD_REQUEST, buildMessageByName(name, errorMessage));
  }

  private static String buildMessageByName(String name, String errorMessage) {
    return String.format(BY_NAME_MESSAGE, name, errorMessage);
  }
}
