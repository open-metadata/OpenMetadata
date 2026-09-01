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
 * that. Only a response carrying no hits is rejected: a search that lost shards and found nothing
 * cannot be shown to anyone as "no results", whereas one that lost shards and still found something
 * is degraded rather than wrong, and failing it would turn every rolling restart and shard
 * relocation into a user-visible outage.
 */
@Slf4j
public final class SearchShardFailures {
  private SearchShardFailures() {}

  /**
   * @param failureDetails one entry per failed shard, already rendered by the engine-specific
   *     client; empty when the engine reported a count without detail
   */
  public static void check(
      int failedShards, int totalShards, long hits, List<String> failureDetails) {
    if (failedShards <= 0) {
      return;
    }

    String failures = String.join("; ", listOrEmpty(failureDetails));
    LOG.warn(
        "Search completed with {} of {} shards failing, hits={}. Shard failures: {}",
        failedShards,
        totalShards,
        hits,
        failures.isEmpty() ? "<none reported>" : failures);

    if (hits == 0) {
      throw new SearchException(
          String.format(
              "Search failed on %d of %d shards and returned no results, so an empty result cannot "
                  + "be trusted. Shard failures: %s",
              failedShards, totalShards, failures.isEmpty() ? "<none reported>" : failures));
    }
  }
}
