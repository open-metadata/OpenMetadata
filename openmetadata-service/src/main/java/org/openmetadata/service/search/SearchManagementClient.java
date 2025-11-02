package org.openmetadata.service.search;

import jakarta.ws.rs.core.Response;
import java.io.IOException;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Interface for managing search operations.
 * This interface provides methods for executing various types of searches
 * including full-text search, NLQ search, direct query search, field-based search,
 * and pagination operations.
 */
public interface SearchManagementClient {

  /**
   * Search for entities by source URL.
   *
   * @param sourceUrl the source URL to search for
   * @return response containing matching entities
   * @throws IOException if search execution fails
   */
  Response searchBySourceUrl(String sourceUrl) throws IOException;

  /**
   * Search for entities by a specific field value.
   *
   * @param fieldName the name of the field to search
   * @param fieldValue the value to match (supports wildcards)
   * @param index the index to search in
   * @param deleted whether to include deleted entities
   * @return response containing matching entities
   * @throws IOException if search execution fails
   */
  Response searchByField(String fieldName, String fieldValue, String index, Boolean deleted)
      throws IOException;

  /**
   * List entities with pagination support.
   *
   * @param filter JSON filter to apply to the search
   * @param limit maximum number of results to return
   * @param offset starting position for results
   * @param index the index to search in
   * @param searchSortFilter sorting configuration
   * @param q search query string
   * @param queryString raw query DSL string
   * @return response containing paginated search results
   * @throws IOException if search execution fails
   */
  SearchResultListMapper listWithOffset(
      String filter,
      int limit,
      int offset,
      String index,
      SearchSortFilter searchSortFilter,
      String q,
      String queryString)
      throws IOException;

  /**
   * List entities with deep pagination using search_after.
   * This method uses the search_after parameter for efficient deep pagination.
   *
   * @param index the index to search in
   * @param query search query string
   * @param filter JSON filter to apply to the search
   * @param fields specific fields to include in results (or null for all fields)
   * @param searchSortFilter sorting configuration
   * @param size maximum number of results to return
   * @param searchAfter sort values from the last hit of the previous page (or null for first page)
   * @return response containing paginated search results with sort values for next page
   * @throws IOException if search execution fails
   */
  SearchResultListMapper listWithDeepPagination(
      String index,
      String query,
      String filter,
      String[] fields,
      SearchSortFilter searchSortFilter,
      int size,
      Object[] searchAfter)
      throws IOException;

  /**
   * Execute a direct query search with RBAC constraints.
   *
   * @param request the search request containing the direct query filter
   * @param subjectContext the subject context for RBAC evaluation
   * @return response containing search results
   * @throws IOException if search execution fails
   */
  Response searchWithDirectQuery(SearchRequest request, SubjectContext subjectContext)
      throws IOException;
}
