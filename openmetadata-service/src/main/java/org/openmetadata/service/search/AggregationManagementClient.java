package org.openmetadata.service.search;

import jakarta.json.JsonObject;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import org.openmetadata.schema.search.AggregationRequest;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.tests.DataQualityReport;

/**
 * Interface for search aggregation operations.
 * Provides methods for executing aggregation queries against search indices.
 */
public interface AggregationManagementClient {

  /**
   * Execute an aggregation query based on the provided request.
   *
   * @param request the aggregation request containing query parameters, field names, and other
   *     aggregation settings
   * @return the response containing aggregation results
   * @throws IOException if the aggregation operation fails
   */
  Response aggregate(AggregationRequest request) throws IOException;

  /**
   * Execute a generic aggregation for data quality reporting.
   *
   * @param query the search query
   * @param index the index to search
   * @param aggregationMetadata the aggregation metadata
   * @return the data quality report
   * @throws IOException if the aggregation operation fails
   */
  DataQualityReport genericAggregation(
      String query, String index, SearchAggregation aggregationMetadata) throws IOException;

  /**
   * Execute an aggregation query and return aggregation results.
   *
   * @param query the search query
   * @param index the index to search
   * @param searchAggregation the search aggregation configuration
   * @param filter additional filter query
   * @return the aggregation results as JsonObject
   * @throws IOException if the aggregation operation fails
   */
  JsonObject aggregate(
      String query, String index, SearchAggregation searchAggregation, String filter)
      throws IOException;

  /**
   * Get entity type counts with aggregation.
   * Returns count of entities grouped by entity type.
   *
   * @param request the search request containing query and filter parameters
   * @param index the index to search (or "all" for all indexes)
   * @return the response containing entity type counts in aggregations
   * @throws IOException if the aggregation operation fails
   */
  Response getEntityTypeCounts(SearchRequest request, String index) throws IOException;
}
