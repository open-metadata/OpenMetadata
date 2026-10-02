package org.openmetadata.service.search;

import jakarta.ws.rs.core.Response;
import java.util.List;
import org.openmetadata.sdk.exception.SearchException;

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
 */
public final class SearchEngineErrors {

  private static final int BAD_REQUEST = 400;

  private SearchEngineErrors() {}

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
