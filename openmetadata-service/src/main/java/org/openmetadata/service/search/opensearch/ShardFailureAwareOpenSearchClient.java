package org.openmetadata.service.search.opensearch;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.io.IOException;
import java.util.List;
import org.openmetadata.service.search.SearchShardFailures;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch._types.ErrorCause;
import os.org.opensearch.client.opensearch._types.OpenSearchException;
import os.org.opensearch.client.opensearch._types.ShardFailure;
import os.org.opensearch.client.opensearch._types.ShardStatistics;
import os.org.opensearch.client.opensearch.core.SearchRequest;
import os.org.opensearch.client.opensearch.core.SearchResponse;
import os.org.opensearch.client.opensearch.core.search.HitsMetadata;
import os.org.opensearch.client.opensearch.core.search.TotalHits;
import os.org.opensearch.client.transport.OpenSearchTransport;

/**
 * The OpenSearch client every manager holds, extended to inspect {@code _shards.failed} on the way
 * out — see {@link SearchShardFailures} for why an unexamined partial response is a silent wrong
 * answer.
 *
 * <p>Overriding the client rather than each caller is what makes the check exhaustive. There are
 * around forty {@code client.search(...)} sites across the search, aggregation, column and lineage
 * managers, none of which looked at {@code _shards}; guarding them one by one would leave the next
 * one added unguarded. The builder-lambda overload is {@code final}, but it compiles to a call on
 * this method, so both call styles are covered.
 */
public class ShardFailureAwareOpenSearchClient extends OpenSearchClient {

  public ShardFailureAwareOpenSearchClient(OpenSearchTransport transport) {
    super(transport);
  }

  @Override
  public <T> SearchResponse<T> search(SearchRequest request, Class<T> documentClass)
      throws IOException, OpenSearchException {
    SearchResponse<T> response = super.search(request, documentClass);
    ShardStatistics shards = response.shards();
    // Healthy searches are the hot path and must not pay for the diagnostic: nothing below is
    // computed until the engine has already said a shard failed.
    if (shards != null && shards.failed() > 0) {
      SearchShardFailures.check(
          shards.failed(),
          shards.total(),
          returnedNoDocuments(request, response),
          describe(shards.failures()));
    }
    return response;
  }

  /**
   * Whether this response asked for documents and verifiably came back without any — the only
   * outcome {@link SearchShardFailures} refuses.
   *
   * <p>Two responses look empty without being untrustworthy. An aggregation-only request ({@code
   * size: 0}, as every aggregation and data-insight query here issues) carries its payload in the
   * buckets, so its hit count measures nothing. And a response that reports no total at all cannot
   * distinguish an empty page — a deep offset past the end of the result set — from an empty result
   * set. Neither is evidence that results went missing, so neither is rejected.
   */
  private static boolean returnedNoDocuments(SearchRequest request, SearchResponse<?> response) {
    Integer requestedSize = request.size();
    if (requestedSize != null && requestedSize == 0) {
      return false;
    }
    HitsMetadata<?> hits = response.hits();
    TotalHits total = hits == null ? null : hits.total();
    return total != null && total.value() == 0;
  }

  static List<String> describe(List<ShardFailure> failures) {
    return listOrEmpty(failures).stream().map(ShardFailureAwareOpenSearchClient::describe).toList();
  }

  private static String describe(ShardFailure failure) {
    ErrorCause cause = failure.reason();
    String type = cause == null || nullOrEmpty(cause.type()) ? "unknown_error" : cause.type();
    String reason = cause == null ? null : cause.reason();
    return nullOrEmpty(reason)
        ? String.format("%s[%d]: %s", failure.index(), failure.shard(), type)
        : String.format("%s[%d]: %s - %s", failure.index(), failure.shard(), type, reason);
  }
}
