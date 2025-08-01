package org.openmetadata.sdk.exception;

import jakarta.ws.rs.core.Response;

public class SearchIndexNotFoundException extends WebServiceException {
  private static final String BY_NAME_MESSAGE =
      "Search Index Not Found Exception [%s] due to [%s].";
  private static final String ERROR_TYPE = "SEARCH_INDEX_NOT_FOUND";

  public SearchIndexNotFoundException(String message) {
    super(Response.Status.INTERNAL_SERVER_ERROR, ERROR_TYPE, message);
  }

  private SearchIndexNotFoundException(Response.Status status, String message) {
    super(status, ERROR_TYPE, message);
  }

  public static SearchIndexNotFoundException byMessage(
      String name, String errorMessage, Response.Status status) {
    return new SearchIndexNotFoundException(status, buildMessageByName(name, errorMessage));
  }

  public static SearchIndexNotFoundException byMessage(String name, String errorMessage) {
    return new SearchIndexNotFoundException(
        Response.Status.BAD_REQUEST, buildMessageByName(name, errorMessage));
  }

  private static String buildMessageByName(String name, String errorMessage) {
    return String.format(BY_NAME_MESSAGE, name, errorMessage);
  }
}
