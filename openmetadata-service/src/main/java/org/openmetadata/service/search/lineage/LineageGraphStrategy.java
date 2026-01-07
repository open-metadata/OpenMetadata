package org.openmetadata.service.search.lineage;

import java.io.IOException;
import org.openmetadata.schema.api.lineage.SearchLineageResult;

/**
 * Strategy interface for building lineage graphs.
 * Different implementations handle graphs of different sizes optimally.
 */
public interface LineageGraphStrategy {

  /**
   * Builds a lineage graph using this strategy.
   *
   * @param context The lineage query context containing request and metadata
   * @return The lineage result with nodes and edges
   * @throws IOException if search backend communication fails
   */
  SearchLineageResult buildGraph(LineageQueryContext context) throws IOException;

  /**
   * Checks if this strategy can handle the given context.
   *
   * @param context The lineage query context
   * @return true if this strategy is appropriate for the context
   */
  boolean canHandle(LineageQueryContext context);

  /**
   * Gets the name of this strategy for logging and metrics.
   *
   * @return Strategy name
   */
  String getStrategyName();

  /**
   * Gets the priority of this strategy when multiple strategies can handle a context.
   * Higher priority strategies are preferred.
   *
   * @return Priority value (higher = preferred)
   */
  default int getPriority() {
    return 0;
  }
}
