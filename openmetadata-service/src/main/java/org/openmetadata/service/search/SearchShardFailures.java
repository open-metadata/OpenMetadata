package org.openmetadata.service.search;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.sdk.exception.SearchException;

/**
 * What to do about a search response that reports {@code _shards.failed > 0}.
 *
 * <p>Both engines answer such a search with HTTP 200 and whatever the surviving shards produced, so
 * a broken query engine and a genuinely empty catalog are indistinguishable to the caller. The
 * shards that throw are the ones holding data — an empty index has nothing to score and always
 * succeeds — so the hits that failed to come back are exactly the ones the user was looking for.
 * That is how a search engine returning nothing at all still looks like an ordinary "no results"
 * screen (#32255).
 *
 * <p>Failures are always logged with the reason the engine gave, because a partial answer the caller
 * accepts is still an answer built on fewer shards than it asked for, and nothing downstream records
 * that. Rejecting is deliberately narrower: only a response that asked for documents and verifiably
 * returned none is refused, because that is the one outcome that cannot honestly be shown to anyone
 * as "no results". A response that lost shards and still returned rows is degraded rather than
 * wrong, and failing it would turn every rolling restart and shard relocation into a user-visible
 * outage. Whether a response qualifies is decided per engine by the calling client, which is the
 * only place that can see both the request and the response.
 */
@Slf4j
public final class SearchShardFailures {

  /**
   * Shard failures rendered into a message before the rest are summarised as a count. The engines
   * already cap the {@code failures} array, but a wide cluster can still fail enough shards to turn
   * one log line — and one HTTP 500 body — into kilobytes of near-identical text.
   */
  private static final int MAX_RENDERED_FAILURES = 5;

  private static final String NO_FAILURES_REPORTED = "<none reported>";

  private SearchShardFailures() {}

  /**
   * @param returnedNoDocuments whether the response asked for documents and verifiably returned
   *     none. False for an aggregation-only request, whose payload is in the buckets and whose hit
   *     count therefore says nothing, and false when the engine reported no total at all, since an
   *     empty page cannot then be told apart from an empty result set.
   * @param failureDetails one entry per failed shard, already rendered by the engine-specific
   *     client; empty when the engine reported a count without detail
   */
  public static void check(
      int failedShards, int totalShards, boolean returnedNoDocuments, List<String> failureDetails) {
    if (failedShards <= 0) {
      return;
    }

    String failures = render(failureDetails);
    LOG.warn(
        "Search completed with {} of {} shards failing. Shard failures: {}",
        failedShards,
        totalShards,
        failures);

    if (returnedNoDocuments) {
      throw new SearchException(
          String.format(
              "Search failed on %d of %d shards and returned no results, so an empty result cannot "
                  + "be trusted. Shard failures: %s",
              failedShards, totalShards, failures));
    }
  }

  private static String render(List<String> failureDetails) {
    List<String> details = listOrEmpty(failureDetails);
    if (details.isEmpty()) {
      return NO_FAILURES_REPORTED;
    }
    if (details.size() <= MAX_RENDERED_FAILURES) {
      return String.join("; ", details);
    }
    return String.join("; ", details.subList(0, MAX_RENDERED_FAILURES))
        + String.format("; ... (%d more)", details.size() - MAX_RENDERED_FAILURES);
  }
}
