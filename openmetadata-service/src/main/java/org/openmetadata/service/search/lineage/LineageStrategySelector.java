package org.openmetadata.service.search.lineage;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import lombok.extern.slf4j.Slf4j;

/**
 * Selects the appropriate lineage graph building strategy based on query context.
 * Uses chain of responsibility pattern with priority-based selection.
 */
@Slf4j
public class LineageStrategySelector {

  private final List<LineageGraphStrategy> strategies;

  public LineageStrategySelector(LineageGraphExecutor executor) {
    this.strategies = new ArrayList<>();

    // Register strategies in priority order (highest priority first after sorting)
    strategies.add(new SmallGraphStrategy(executor));
    strategies.add(new MediumGraphStrategy(executor));
    strategies.add(new LargeGraphStrategy(executor));
    strategies.add(new StreamingGraphStrategy(executor));

    // Sort by priority (highest first)
    strategies.sort(Comparator.comparingInt(LineageGraphStrategy::getPriority).reversed());
  }

  /**
   * Selects the most appropriate strategy for the given context.
   * Returns the first strategy that can handle the context, preferring higher priority.
   *
   * @param context The lineage query context
   * @return Selected strategy
   * @throws IllegalStateException if no strategy can handle the context
   */
  public LineageGraphStrategy selectStrategy(LineageQueryContext context) {
    for (LineageGraphStrategy strategy : strategies) {
      if (strategy.canHandle(context)) {
        LOG.debug(
            "Selected strategy: {} for graph with ~{} nodes",
            strategy.getStrategyName(),
            context.getEstimatedNodeCount());
        return strategy;
      }
    }

    // Fallback: should not happen if SmallGraphStrategy has no upper bound
    LOG.warn(
        "No strategy found for context with {} nodes, falling back to SmallGraphStrategy",
        context.getEstimatedNodeCount());
    return strategies.get(0);
  }

  /**
   * Registers a new strategy.
   * Useful for testing or adding custom strategies.
   *
   * @param strategy Strategy to register
   */
  public void registerStrategy(LineageGraphStrategy strategy) {
    strategies.add(strategy);
    strategies.sort(Comparator.comparingInt(LineageGraphStrategy::getPriority).reversed());
  }

  /**
   * Gets all registered strategies.
   *
   * @return List of strategies
   */
  public List<LineageGraphStrategy> getStrategies() {
    return new ArrayList<>(strategies);
  }
}
