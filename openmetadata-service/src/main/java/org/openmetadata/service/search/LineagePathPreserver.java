package org.openmetadata.service.search;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.type.lineage.NodeInformation;

/**
 * Utility class to preserve paths in lineage results when filters are applied.
 * Ensures that intermediate nodes between the root and filtered nodes are included.
 */
@Slf4j
public class LineagePathPreserver {

  private LineagePathPreserver() {}

  /**
   * Preserves paths from root to matching nodes using unfiltered result's edges.
   * This method finds all intermediate nodes between root and matching nodes.
   *
   * @param unfilteredResult The unfiltered lineage result containing all nodes and edges
   * @param rootFqn The fully qualified name of the root entity
   * @param matchingNodeFqns Set of node FQNs that match the filter criteria
   * @return Modified result with paths preserved
   */
  public static SearchLineageResult preservePathsWithEdges(
      SearchLineageResult unfilteredResult, String rootFqn, Set<String> matchingNodeFqns) {

    if (unfilteredResult == null
        || unfilteredResult.getNodes() == null
        || matchingNodeFqns == null) {
      return unfilteredResult;
    }

    Set<String> requiredNodes = new HashSet<>();

    // Add root
    requiredNodes.add(rootFqn);

    // For each matching node, trace path back to root using unfiltered edges
    // The tracing will add both the matching nodes and all intermediate nodes
    for (String nodeFqn : matchingNodeFqns) {
      if (!nodeFqn.equals(rootFqn)) {
        tracePathToRoot(
            nodeFqn, rootFqn, unfilteredResult, unfilteredResult.getNodes(), requiredNodes);
      }
    }

    // Create result with only required nodes
    Map<String, NodeInformation> preservedNodes = new HashMap<>();
    for (String fqn : requiredNodes) {
      if (unfilteredResult.getNodes().containsKey(fqn)) {
        preservedNodes.put(fqn, unfilteredResult.getNodes().get(fqn));
      }
    }

    // Filter edges to only include those connected to required nodes
    SearchLineageResult result = new SearchLineageResult();
    result.setNodes(preservedNodes);
    result.setUpstreamEdges(unfilteredResult.getUpstreamEdges());
    result.setDownstreamEdges(unfilteredResult.getDownstreamEdges());

    filterEdgesByNodes(result, requiredNodes);

    return result;
  }

  /**
   * Preserves paths from root to all nodes in the result.
   * This ensures that when filters are applied, intermediate nodes are not lost.
   *
   * @param result The lineage result containing nodes and edges
   * @param rootFqn The fully qualified name of the root entity
   * @param allNodesBeforeFilter All nodes before filtering was applied
   * @return Modified result with paths preserved
   */
  public static SearchLineageResult preservePaths(
      SearchLineageResult result,
      String rootFqn,
      Map<String, NodeInformation> allNodesBeforeFilter) {

    if (result == null || result.getNodes() == null || allNodesBeforeFilter == null) {
      return result;
    }

    Set<String> requiredNodes = new HashSet<>();

    // Add root
    requiredNodes.add(rootFqn);

    // Add all currently filtered nodes
    requiredNodes.addAll(result.getNodes().keySet());

    // For each filtered node, trace path back to root
    for (String nodeFqn : new HashSet<>(result.getNodes().keySet())) {
      if (!nodeFqn.equals(rootFqn)) {
        tracePathToRoot(nodeFqn, rootFqn, result, allNodesBeforeFilter, requiredNodes);
      }
    }

    // Add all required nodes that were filtered out
    Map<String, NodeInformation> preservedNodes = new HashMap<>(result.getNodes());
    for (String fqn : requiredNodes) {
      if (!preservedNodes.containsKey(fqn) && allNodesBeforeFilter.containsKey(fqn)) {
        preservedNodes.put(fqn, allNodesBeforeFilter.get(fqn));
      }
    }

    result.setNodes(preservedNodes);
    return result;
  }

  /**
   * Traces path from a node back to root by following upstream edges.
   */
  private static void tracePathToRoot(
      String nodeFqn,
      String rootFqn,
      SearchLineageResult result,
      Map<String, NodeInformation> allNodes,
      Set<String> requiredNodes) {

    if (nodeFqn.equals(rootFqn) || requiredNodes.contains(nodeFqn)) {
      return;
    }

    requiredNodes.add(nodeFqn);

    // Trace through upstream edges
    if (result.getUpstreamEdges() != null) {
      result.getUpstreamEdges().values().stream()
          .filter(
              edge ->
                  edge.getToEntity() != null
                      && edge.getToEntity().getFullyQualifiedName().equals(nodeFqn))
          .forEach(
              edge -> {
                if (edge.getFromEntity() != null) {
                  String parentFqn = edge.getFromEntity().getFullyQualifiedName();
                  tracePathToRoot(parentFqn, rootFqn, result, allNodes, requiredNodes);
                }
              });
    }

    // Trace through downstream edges (backwards from toEntity to fromEntity)
    if (result.getDownstreamEdges() != null) {
      result.getDownstreamEdges().values().stream()
          .filter(
              edge ->
                  edge.getToEntity() != null
                      && edge.getToEntity().getFullyQualifiedName().equals(nodeFqn))
          .forEach(
              edge -> {
                if (edge.getFromEntity() != null) {
                  String parentFqn = edge.getFromEntity().getFullyQualifiedName();
                  tracePathToRoot(parentFqn, rootFqn, result, allNodes, requiredNodes);
                }
              });
    }
  }

  /**
   * Filters nodes and edges based on column criteria while preserving paths.
   *
   * @param result The lineage result to filter
   * @param columnFilter Column filter expression
   * @param rootFqn Root entity FQN
   * @return Filtered result with paths preserved
   */
  public static SearchLineageResult filterByColumns(
      SearchLineageResult result, String columnFilter, String rootFqn) {

    if (result == null || columnFilter == null || columnFilter.trim().isEmpty()) {
      return result;
    }

    Set<String> matchingNodes = new HashSet<>();
    matchingNodes.add(rootFqn); // Always include root

    // Find all edges with matching columns
    if (result.getUpstreamEdges() != null) {
      result.getUpstreamEdges().values().stream()
          .filter(edge -> ColumnFilterMatcher.matchesColumnFilter(edge, columnFilter))
          .forEach(
              edge -> {
                if (edge.getFromEntity() != null) {
                  matchingNodes.add(edge.getFromEntity().getFullyQualifiedName());
                }
                if (edge.getToEntity() != null) {
                  matchingNodes.add(edge.getToEntity().getFullyQualifiedName());
                }
              });
    }

    if (result.getDownstreamEdges() != null) {
      result.getDownstreamEdges().values().stream()
          .filter(edge -> ColumnFilterMatcher.matchesColumnFilter(edge, columnFilter))
          .forEach(
              edge -> {
                if (edge.getFromEntity() != null) {
                  matchingNodes.add(edge.getFromEntity().getFullyQualifiedName());
                }
                if (edge.getToEntity() != null) {
                  matchingNodes.add(edge.getToEntity().getFullyQualifiedName());
                }
              });
    }

    // Create filtered result preserving only matching nodes and their paths
    Map<String, NodeInformation> filteredNodes = new HashMap<>();
    for (String fqn : matchingNodes) {
      if (result.getNodes().containsKey(fqn)) {
        filteredNodes.put(fqn, result.getNodes().get(fqn));
      }
    }

    result.setNodes(filteredNodes);

    // Filter edges to only include those connected to matching nodes
    filterEdgesByNodes(result, matchingNodes);

    return result;
  }

  private static void filterEdgesByNodes(SearchLineageResult result, Set<String> includedNodes) {
    // Filter upstream edges
    if (result.getUpstreamEdges() != null) {
      Map<String, org.openmetadata.schema.api.lineage.EsLineageData> filteredUpstream =
          new HashMap<>();
      result
          .getUpstreamEdges()
          .forEach(
              (docId, edge) -> {
                String fromFqn =
                    edge.getFromEntity() != null
                        ? edge.getFromEntity().getFullyQualifiedName()
                        : null;
                String toFqn =
                    edge.getToEntity() != null ? edge.getToEntity().getFullyQualifiedName() : null;

                if (fromFqn != null
                    && toFqn != null
                    && includedNodes.contains(fromFqn)
                    && includedNodes.contains(toFqn)) {
                  filteredUpstream.put(docId, edge);
                }
              });
      result.setUpstreamEdges(filteredUpstream);
    }

    // Filter downstream edges
    if (result.getDownstreamEdges() != null) {
      Map<String, org.openmetadata.schema.api.lineage.EsLineageData> filteredDownstream =
          new HashMap<>();
      result
          .getDownstreamEdges()
          .forEach(
              (docId, edge) -> {
                String fromFqn =
                    edge.getFromEntity() != null
                        ? edge.getFromEntity().getFullyQualifiedName()
                        : null;
                String toFqn =
                    edge.getToEntity() != null ? edge.getToEntity().getFullyQualifiedName() : null;

                if (fromFqn != null
                    && toFqn != null
                    && includedNodes.contains(fromFqn)
                    && includedNodes.contains(toFqn)) {
                  filteredDownstream.put(docId, edge);
                }
              });
      result.setDownstreamEdges(filteredDownstream);
    }
  }

  /**
   * Filters nodes and edges based on column criteria (including tag/glossary) while preserving paths.
   *
   * @param result The lineage result to filter
   * @param columnFilter Column filter expression
   * @param rootFqn Root entity FQN
   * @param metadataCache Cache containing column metadata (tags, glossary terms)
   * @return Filtered result with paths preserved
   */
  public static SearchLineageResult filterByColumnsWithMetadata(
      SearchLineageResult result,
      String columnFilter,
      String rootFqn,
      ColumnMetadataCache metadataCache) {

    if (result == null || columnFilter == null || columnFilter.trim().isEmpty()) {
      return result;
    }

    Set<String> matchingNodes = new HashSet<>();
    matchingNodes.add(rootFqn); // Always include root

    // Find all edges with matching columns (with metadata support)
    if (result.getUpstreamEdges() != null) {
      result.getUpstreamEdges().values().stream()
          .filter(
              edge -> ColumnFilterMatcher.matchesColumnFilter(edge, columnFilter, metadataCache))
          .forEach(
              edge -> {
                if (edge.getFromEntity() != null) {
                  matchingNodes.add(edge.getFromEntity().getFullyQualifiedName());
                }
                if (edge.getToEntity() != null) {
                  matchingNodes.add(edge.getToEntity().getFullyQualifiedName());
                }
              });
    }

    if (result.getDownstreamEdges() != null) {
      result.getDownstreamEdges().values().stream()
          .filter(
              edge -> ColumnFilterMatcher.matchesColumnFilter(edge, columnFilter, metadataCache))
          .forEach(
              edge -> {
                if (edge.getFromEntity() != null) {
                  matchingNodes.add(edge.getFromEntity().getFullyQualifiedName());
                }
                if (edge.getToEntity() != null) {
                  matchingNodes.add(edge.getToEntity().getFullyQualifiedName());
                }
              });
    }

    // Create filtered result preserving only matching nodes and their paths
    Map<String, NodeInformation> filteredNodes = new HashMap<>();
    for (String fqn : matchingNodes) {
      if (result.getNodes().containsKey(fqn)) {
        filteredNodes.put(fqn, result.getNodes().get(fqn));
      }
    }

    result.setNodes(filteredNodes);

    // Filter edges to only include those connected to matching nodes
    filterEdgesByNodes(result, matchingNodes);

    return result;
  }
}
