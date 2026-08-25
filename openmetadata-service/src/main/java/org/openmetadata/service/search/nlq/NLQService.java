package org.openmetadata.service.search.nlq;

import java.io.IOException;
import org.openmetadata.schema.search.SearchRequest;

/**
 * Interface for Natural Language Query (NLQ) processing services.
 * Implementations of this interface transform natural language queries
 * into structured search queries that can be executed by search engines
 * like Elasticsearch or OpenSearch.
 */
public interface NLQService {

  /**
   * Transform a natural language query into a structured search query.
   *
   * @param request The original search request containing the natural language query
   * @param additionalContext Optional additional context that may help with query transformation
   *                          (can be null if not needed)
   * @return A JSON string representing a valid Elasticsearch/OpenSearch query
   * @throws IOException If the transformation process fails
   */
  String transformNaturalLanguageQuery(SearchRequest request, String additionalContext)
      throws IOException;

  void cacheQuery(String query, String transformedQuery);

  /**
   * Check if the service is ready to process queries.
   *
   * @return true if the service is ready, false otherwise
   */
  default boolean isReady() {
    return true;
  }

  /**
   * Get the name of the NLQ service provider.
   *
   * @return The provider name (e.g., "bedrock", "openai", etc.)
   */
  default String getProviderName() {
    return this.getClass().getSimpleName().replace("NLQService", "").toLowerCase();
  }
}
