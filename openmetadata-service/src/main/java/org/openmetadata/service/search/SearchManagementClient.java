package org.openmetadata.service.search;

import jakarta.ws.rs.core.Response;
import java.io.IOException;

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
}
