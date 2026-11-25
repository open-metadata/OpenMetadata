package org.openmetadata.service.search.queries;

import org.openmetadata.schema.api.search.SearchSettings;

/**
 * Renders what OpenMetadata builds with its typed, engine-specific builders as query DSL JSON, so
 * a caller can compose its own request without naming an engine client.
 */
public interface SearchQueryDsl {

  /** The factory whose clauses {@link #toJson} can render. */
  QueryBuilderFactory queryBuilderFactory();

  /** {@code query} as one query clause, for example {@code {"bool":{...}}}. */
  String toJson(OMQueryBuilder query);

  /**
   * The query {@code /v1/search} runs for {@code queryText} over {@code indexName}. Its {@code
   * function_score} carries the ranking boosts of {@code searchSettings}.
   */
  String dataAssetQueryJson(SearchSettings searchSettings, String indexName, String queryText);
}
