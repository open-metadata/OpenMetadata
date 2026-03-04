package org.openmetadata.service.search.lineage;

import java.io.IOException;
import org.openmetadata.schema.api.lineage.SearchLineageResult;

/**
 * Interface for executing lineage graph queries against search backends.
 * Implemented by ES and OpenSearch builders to provide backend-specific execution.
 */
public interface LineageGraphExecutor {

  /**
   * Executes lineage query with in-memory graph building.
   * Suitable for small to medium graphs.
   *
   * @param context The query context
   * @param batchSize Batch size for fetching nodes from search backend
   * @return Complete lineage result
   * @throws IOException if search backend communication fails
   */
  SearchLineageResult executeInMemory(LineageQueryContext context, int batchSize)
      throws IOException;

  /**
   * Estimates the number of nodes in the lineage graph.
   * Uses aggregation queries for efficient counting.
   *
   * @param context The query context
   * @return Estimated node count
   * @throws IOException if search backend communication fails
   */
  int estimateGraphSize(LineageQueryContext context) throws IOException;

  /**
   * Executes lineage query using scroll API for large result sets.
   * Provides better memory efficiency for graphs with 50K+ nodes.
   * Uses search backend scroll context to fetch results in batches.
   *
   * @param context The lineage query context containing request and metadata
   * @param batchSize Number of nodes to fetch per scroll batch
   * @return Complete lineage result with nodes and edges
   * @throws IOException if search backend communication fails
   */
  SearchLineageResult executeWithScroll(LineageQueryContext context, int batchSize)
      throws IOException;
}
