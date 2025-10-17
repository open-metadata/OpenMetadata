package org.openmetadata.service.search;

import jakarta.ws.rs.core.Response;
import java.io.IOException;
import org.openmetadata.schema.search.AggregationRequest;

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
}
