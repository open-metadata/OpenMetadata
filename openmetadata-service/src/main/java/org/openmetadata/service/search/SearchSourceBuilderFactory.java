package org.openmetadata.service.search;

import java.util.List;
import java.util.Map;

/**
 * Interface for creating search source builders for different entity types.
 * This interface provides a common contract for both ElasticSearch and OpenSearch implementations.
 *
 * @param <S> The SearchSourceBuilder type (different for ElasticSearch and OpenSearch)
 * @param <Q> The QueryBuilder type
 * @param <H> The HighlightBuilder type
 * @param <F> The FunctionScoreQueryBuilder type
 */
public interface SearchSourceBuilderFactory<S, Q, H, F> {

  /**
   * Get the appropriate search source builder based on the index name.
   *
   * @param index the index name
   * @param q the search query
   * @param from the starting offset
   * @param size the number of results to return
   * @return a search source builder configured for the specific entity type
   */
  S getSearchSourceBuilder(String index, String q, int from, int size);

  /**
   * Build a search query builder with the specified fields and weights.
   *
   * @param query the search query
   * @param fields map of field names to their boost weights
   * @return a query string query builder
   */
  Q buildSearchQueryBuilder(String query, Map<String, Float> fields);

  /**
   * Build highlights for the specified fields.
   *
   * @param fields list of field names to highlight
   * @return a highlight builder
   */
  H buildHighlights(List<String> fields);

  /**
   * Create a search source builder with the specified query builder, highlights, and pagination.
   *
   * @param queryBuilder the query builder
   * @param highlightBuilder the highlight builder
   * @param from the starting offset
   * @param size the number of results to return
   * @return a search source builder
   */
  S searchBuilder(Q queryBuilder, H highlightBuilder, int from, int size);

  /**
   * Apply boosting to a query string query builder.
   *
   * @param queryBuilder the query string query builder
   * @return a function score query builder with boosting applied
   */
  F boostScore(Q queryBuilder);
}
