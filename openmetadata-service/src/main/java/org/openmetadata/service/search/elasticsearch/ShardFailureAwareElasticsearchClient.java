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
    if (shards != null) {
      SearchShardFailures.check(
          count(shards.failed()),
          count(shards.total()),
          matchedHits(response),
          describe(shards.failures()));
    }
    return response;
  }

  private static int count(Number shardCount) {
    return shardCount == null ? 0 : shardCount.intValue();
  }

  /**
   * Documents the query matched, which is what decides whether an empty answer is trustworthy. Falls
   * back to the returned page when the caller turned off {@code track_total_hits} and the engine
   * therefore reports no total.
   */
  private static long matchedHits(SearchResponse<?> response) {
    HitsMetadata<?> hits = response.hits();
    if (hits == null) {
      return 0L;
    }
    TotalHits total = hits.total();
    return total != null ? total.value() : listOrEmpty(hits.hits()).size();
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
