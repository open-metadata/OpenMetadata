package org.openmetadata.service.search.elasticsearch;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.ElasticsearchException;
import es.co.elastic.clients.elasticsearch._types.ErrorCause;
import es.co.elastic.clients.elasticsearch._types.ShardFailure;
import es.co.elastic.clients.elasticsearch._types.ShardStatistics;
import es.co.elastic.clients.elasticsearch.core.SearchRequest;
import es.co.elastic.clients.elasticsearch.core.SearchResponse;
import es.co.elastic.clients.elasticsearch.core.search.HitsMetadata;
import es.co.elastic.clients.elasticsearch.core.search.TotalHits;
import es.co.elastic.clients.transport.ElasticsearchTransport;
import java.io.IOException;
import java.util.List;
import org.openmetadata.service.search.SearchShardFailures;

/**
 * The Elasticsearch counterpart of {@link
 * org.openmetadata.service.search.opensearch.ShardFailureAwareOpenSearchClient}: inspects {@code
 * _shards.failed} on every search so a partial response cannot pass for an empty one. See {@link
 * SearchShardFailures} for the policy and why it lives on the client rather than on each caller.
 */
public class ShardFailureAwareElasticsearchClient extends ElasticsearchClient {

  public ShardFailureAwareElasticsearchClient(ElasticsearchTransport transport) {
    super(transport);
  }

  @Override
  public <T> SearchResponse<T> search(SearchRequest request, Class<T> documentClass)
      throws IOException, ElasticsearchException {
    SearchResponse<T> response = super.search(request, documentClass);
    ShardStatistics shards = response.shards();
    // Healthy searches are the hot path and must not pay for the diagnostic: nothing below is
    // computed until the engine has already said a shard failed.
    int failed = count(shards == null ? null : shards.failed());
    if (failed > 0) {
      SearchShardFailures.check(
          failed,
          count(shards.total()),
          returnedNoDocuments(request, response),
          describe(shards.failures()));
    }
    return response;
  }

  private static int count(Number shardCount) {
    return shardCount == null ? 0 : shardCount.intValue();
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
    return listOrEmpty(failures).stream()
        .map(ShardFailureAwareElasticsearchClient::describe)
        .toList();
  }

  private static String describe(ShardFailure failure) {
    ErrorCause cause = failure.reason();
    String type = cause == null || nullOrEmpty(cause.type()) ? "unknown_error" : cause.type();
    String reason = cause == null ? null : cause.reason();
    return nullOrEmpty(reason)
        ? String.format("%s[%s]: %s", failure.index(), failure.shard(), type)
        : String.format("%s[%s]: %s - %s", failure.index(), failure.shard(), type, reason);
  }
}
