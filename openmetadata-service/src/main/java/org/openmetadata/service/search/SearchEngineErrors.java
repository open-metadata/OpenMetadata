package org.openmetadata.service.search;

import jakarta.ws.rs.core.Response;
import java.util.List;
import org.openmetadata.sdk.exception.SearchException;
import org.openmetadata.sdk.exception.SearchIndexNotFoundException;
import org.openmetadata.service.Entity;

/**
 * Translates a search engine's own HTTP failure into the status OpenMetadata reports to its caller.
 *
 * <p>Both engine managers used to report every failure as a 500. The engine answers {@code 400} when
 * the request it was handed is invalid — a malformed Lucene expression in {@code q}, or a {@code
 * queryFilter} that is well-formed JSON but not a query — so a caller's own bad input was being
 * reported as a server fault and logged as a backend error. Issue #27990.
 *
 * <p>Only {@code 400} is re-mapped. Everything else, including the {@code 429} the engine returns
 * when a circuit breaker trips, stays a 500: those are genuinely not the caller's doing.
 *
 * <p>A missing index ({@code 404}) depends on whose name it is. A name OpenMetadata does not manage
 * is the caller's mistake and is a 400. A managed index that is missing from the cluster, for
 * example after a failed reindex, is an outage and stays a 500. Issue #31878.
 */
public final class SearchEngineErrors {

  private static final int BAD_REQUEST = 400;

  private SearchEngineErrors() {}

  /** Classifies a missing index using the names the running server manages. */
  public static SearchIndexNotFoundException indexNotFound(String resolvedIndex) {
    SearchRepository searchRepository = Entity.getSearchRepository();
    List<String> unknownNames =
        searchRepository == null ? List.of() : searchRepository.unknownIndexNames(resolvedIndex);
    return indexNotFound(resolvedIndex, unknownNames);
  }

  /**
   * @param resolvedIndex the index expression sent to the engine
   * @param unknownNames the names in it that OpenMetadata does not manage, as the caller typed them
   */
  public static SearchIndexNotFoundException indexNotFound(
      String resolvedIndex, List<String> unknownNames) {
    if (unknownNames.isEmpty()) {
      return new SearchIndexNotFoundException(
          String.format("Failed to find index %s", resolvedIndex));
    }
    return SearchIndexNotFoundException.withStatus(
        Response.Status.BAD_REQUEST,
        String.format("Unknown search index [%s]", String.join(", ", unknownNames)));
  }

  /**
   * @param upstreamStatus HTTP status the search engine returned
   * @param message the engine's own message
   * @param rootCauses engine root causes, already rendered as {@code type: reason}
   */
  public static SearchException searchFailure(
      int upstreamStatus, String message, List<String> rootCauses) {
    String detail =
        rootCauses.isEmpty()
            ? message
            : String.format("%s | Root cause: [%s]", message, String.join("; ", rootCauses));
    return SearchException.withStatus(
        statusFor(upstreamStatus), String.format("Search failed due to %s", detail));
  }

  private static Response.Status statusFor(int upstreamStatus) {
    return upstreamStatus == BAD_REQUEST
        ? Response.Status.BAD_REQUEST
        : Response.Status.INTERNAL_SERVER_ERROR;
  }
}
