package org.openmetadata.sdk.exception;

import jakarta.ws.rs.core.Response;
import java.util.Collection;
import java.util.Set;

public class SearchException extends WebServiceException {
  private static final String BY_NAME_MESSAGE =
      "Search Index Not Found Exception [%s] due to [%s].";
  private static final String ERROR_TYPE = "SEARCH_ERROR";

  private static final Set<String> CLIENT_ERROR_ROOT_CAUSE_TYPES =
      Set.of(
          "query_shard_exception",
          "parsing_exception",
          "illegal_argument_exception",
          "index_not_found_exception");

  public SearchException(String message) {
    super(Response.Status.INTERNAL_SERVER_ERROR, ERROR_TYPE, message);
  }

  public SearchException(Response.Status status, String message) {
    super(status, ERROR_TYPE, message);
  }

  public static Response.Status statusForRootCauseTypes(Collection<String> rootCauseTypes) {
    boolean isClientError =
        !rootCauseTypes.isEmpty()
            && rootCauseTypes.stream().allMatch(CLIENT_ERROR_ROOT_CAUSE_TYPES::contains);
    return isClientError ? Response.Status.BAD_REQUEST : Response.Status.INTERNAL_SERVER_ERROR;
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
