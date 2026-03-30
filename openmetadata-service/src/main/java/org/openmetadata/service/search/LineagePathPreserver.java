package org.openmetadata.service.search;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.type.lineage.NodeInformation;
import org.openmetadata.schema.utils.JsonUtils;

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

    // Build adjacency map once: toEntityFqn -> list of fromEntityFqns
    Map<String, List<String>> parentsByChild = buildParentAdjacencyMap(unfilteredResult);

    // For each matching node, trace path back to root using adjacency map
    Set<String> visitedNodes = new HashSet<>();
    for (String nodeFqn : matchingNodeFqns) {
      if (!nodeFqn.equals(rootFqn)) {
        tracePathToRootViaMap(nodeFqn, rootFqn, parentsByChild, requiredNodes, visitedNodes);
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

    // Build adjacency map once
    Map<String, List<String>> parentsByChild = buildParentAdjacencyMap(result);

    // For each filtered node, trace path back to root
    Set<String> visitedNodes = new HashSet<>();
    for (String nodeFqn : new HashSet<>(result.getNodes().keySet())) {
      if (!nodeFqn.equals(rootFqn)) {
        tracePathToRootViaMap(nodeFqn, rootFqn, parentsByChild, requiredNodes, visitedNodes);
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
    tracePathToRoot(nodeFqn, rootFqn, result, allNodes, requiredNodes, new HashSet<>());
  }

  private static void tracePathToRoot(
      String nodeFqn,
      String rootFqn,
      SearchLineageResult result,
      Map<String, NodeInformation> allNodes,
      Set<String> requiredNodes,
      Set<String> visitedNodes) {

    if (!visitedNodes.add(nodeFqn)) {
      return;
    }

    requiredNodes.add(nodeFqn);

    if (nodeFqn.equals(rootFqn)) {
      return;
    }

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
                  tracePathToRoot(
                      parentFqn, rootFqn, result, allNodes, requiredNodes, visitedNodes);
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
                  tracePathToRoot(
                      parentFqn, rootFqn, result, allNodes, requiredNodes, visitedNodes);
                }
              });
    }
  }

  /**
   * Builds an adjacency map from toEntity FQN to list of fromEntity FQNs.
   * Scans all edges once (O(E)) so that path tracing can use O(1) lookups.
   */
  static Map<String, List<String>> buildParentAdjacencyMap(SearchLineageResult result) {
    Map<String, List<String>> parentsByChild = new HashMap<>();

    if (result.getUpstreamEdges() != null) {
      for (org.openmetadata.schema.api.lineage.EsLineageData edge :
          result.getUpstreamEdges().values()) {
        if (edge.getToEntity() != null && edge.getFromEntity() != null) {
          parentsByChild
              .computeIfAbsent(edge.getToEntity().getFullyQualifiedName(), k -> new ArrayList<>())
              .add(edge.getFromEntity().getFullyQualifiedName());
        }
      }
    }

    if (result.getDownstreamEdges() != null) {
      for (org.openmetadata.schema.api.lineage.EsLineageData edge :
          result.getDownstreamEdges().values()) {
        if (edge.getToEntity() != null && edge.getFromEntity() != null) {
          parentsByChild
              .computeIfAbsent(edge.getToEntity().getFullyQualifiedName(), k -> new ArrayList<>())
              .add(edge.getFromEntity().getFullyQualifiedName());
        }
      }
    }

    return parentsByChild;
  }

  /**
   * Traces path from a node to root using pre-built adjacency map.
   * O(path_length) per call instead of O(E) per call.
   */
  private static void tracePathToRootViaMap(
      String nodeFqn,
      String rootFqn,
      Map<String, List<String>> parentsByChild,
      Set<String> requiredNodes,
      Set<String> visitedNodes) {

    if (!visitedNodes.add(nodeFqn)) {
      return;
    }

    requiredNodes.add(nodeFqn);

    if (nodeFqn.equals(rootFqn)) {
      return;
    }

    List<String> parents = parentsByChild.get(nodeFqn);
    if (parents != null) {
      for (String parentFqn : parents) {
        tracePathToRootViaMap(parentFqn, rootFqn, parentsByChild, requiredNodes, visitedNodes);
      }
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

    SearchLineageResult filteredResult = JsonUtils.deepCopy(result, SearchLineageResult.class);
    Set<String> matchingNodes =
        collectNodesFromMatchingEdges(filteredResult, columnFilter, rootFqn, null);
    preservePathsAndFilterEdges(filteredResult, matchingNodes, rootFqn);
    narrowColumnsOnEdges(filteredResult, columnFilter, null);
    retainOnlyNodes(filteredResult, matchingNodes);

    return filteredResult;
  }

  public static SearchLineageResult filterByColumnsWithMetadata(
      SearchLineageResult result,
      String columnFilter,
      String rootFqn,
      ColumnMetadataCache metadataCache) {

    if (result == null || columnFilter == null || columnFilter.trim().isEmpty()) {
      return result;
    }

    SearchLineageResult filteredResult = JsonUtils.deepCopy(result, SearchLineageResult.class);
    Set<String> matchingNodes =
        collectNodesFromMatchingEdges(filteredResult, columnFilter, rootFqn, metadataCache);
    preservePathsAndFilterEdges(filteredResult, matchingNodes, rootFqn);
    narrowColumnsOnEdges(filteredResult, columnFilter, metadataCache);
    retainOnlyNodes(filteredResult, matchingNodes);

    return filteredResult;
  }

  private static Set<String> collectNodesFromMatchingEdges(
      SearchLineageResult result,
      String columnFilter,
      String rootFqn,
      ColumnMetadataCache metadataCache) {
    Set<String> matchingNodes = new HashSet<>();
    matchingNodes.add(rootFqn);
    collectFromEdgeMap(result.getUpstreamEdges(), columnFilter, metadataCache, matchingNodes);
    collectFromEdgeMap(result.getDownstreamEdges(), columnFilter, metadataCache, matchingNodes);
    return matchingNodes;
  }

  private static void collectFromEdgeMap(
      Map<String, org.openmetadata.schema.api.lineage.EsLineageData> edges,
      String columnFilter,
      ColumnMetadataCache metadataCache,
      Set<String> matchingNodes) {
    if (edges == null) {
      return;
    }
    for (org.openmetadata.schema.api.lineage.EsLineageData edge : edges.values()) {
      boolean matches =
          metadataCache != null
              ? ColumnFilterMatcher.matchesColumnFilter(edge, columnFilter, metadataCache)
              : ColumnFilterMatcher.matchesColumnFilter(edge, columnFilter);
      if (matches) {
        addEdgeEndpoints(edge, matchingNodes);
      }
    }
  }

  private static void addEdgeEndpoints(
      org.openmetadata.schema.api.lineage.EsLineageData edge, Set<String> nodes) {
    if (edge.getFromEntity() != null) {
      nodes.add(edge.getFromEntity().getFullyQualifiedName());
    }
    if (edge.getToEntity() != null) {
      nodes.add(edge.getToEntity().getFullyQualifiedName());
    }
  }

  private static void preservePathsAndFilterEdges(
      SearchLineageResult result, Set<String> matchingNodes, String rootFqn) {
    Map<String, List<String>> parentsByChild = buildParentAdjacencyMap(result);
    Set<String> visitedNodes = new HashSet<>();
    for (String nodeFqn : new HashSet<>(matchingNodes)) {
      if (!nodeFqn.equals(rootFqn)) {
        tracePathToRootViaMap(nodeFqn, rootFqn, parentsByChild, matchingNodes, visitedNodes);
      }
    }
    filterEdgesByNodes(result, matchingNodes);
  }

  private static void narrowColumnsOnEdges(
      SearchLineageResult result, String columnFilter, ColumnMetadataCache metadataCache) {
    narrowColumnsOnEdgeMap(result.getUpstreamEdges(), columnFilter, metadataCache);
    narrowColumnsOnEdgeMap(result.getDownstreamEdges(), columnFilter, metadataCache);
  }

  private static void narrowColumnsOnEdgeMap(
      Map<String, org.openmetadata.schema.api.lineage.EsLineageData> edges,
      String columnFilter,
      ColumnMetadataCache metadataCache) {
    if (edges == null) {
      return;
    }
    for (org.openmetadata.schema.api.lineage.EsLineageData edge : edges.values()) {
      if (edge.getColumns() != null && !edge.getColumns().isEmpty()) {
        edge.setColumns(
            metadataCache != null
                ? ColumnFilterMatcher.filterMatchingColumnsWithMetadata(
                    edge, columnFilter, metadataCache)
                : ColumnFilterMatcher.filterMatchingColumns(edge, columnFilter));
      }
    }
  }

  private static void retainOnlyNodes(SearchLineageResult result, Set<String> matchingNodes) {
    Map<String, NodeInformation> filteredNodes = new HashMap<>();
    for (String fqn : matchingNodes) {
      if (result.getNodes().containsKey(fqn)) {
        filteredNodes.put(fqn, result.getNodes().get(fqn));
      }
    }
    result.setNodes(filteredNodes);
  }

  private static void filterEdgesByNodes(SearchLineageResult result, Set<String> includedNodes) {
    if (result.getUpstreamEdges() != null) {
      result.setUpstreamEdges(retainEdgesConnecting(result.getUpstreamEdges(), includedNodes));
    }
    if (result.getDownstreamEdges() != null) {
      result.setDownstreamEdges(retainEdgesConnecting(result.getDownstreamEdges(), includedNodes));
    }
  }

  private static Map<String, org.openmetadata.schema.api.lineage.EsLineageData>
      retainEdgesConnecting(
          Map<String, org.openmetadata.schema.api.lineage.EsLineageData> edges,
          Set<String> includedNodes) {
    Map<String, org.openmetadata.schema.api.lineage.EsLineageData> filtered = new HashMap<>();
    for (Map.Entry<String, org.openmetadata.schema.api.lineage.EsLineageData> entry :
        edges.entrySet()) {
      org.openmetadata.schema.api.lineage.EsLineageData edge = entry.getValue();
      String fromFqn =
          edge.getFromEntity() != null ? edge.getFromEntity().getFullyQualifiedName() : null;
      String toFqn = edge.getToEntity() != null ? edge.getToEntity().getFullyQualifiedName() : null;
      if (fromFqn != null
          && toFqn != null
          && includedNodes.contains(fromFqn)
          && includedNodes.contains(toFqn)) {
        filtered.put(entry.getKey(), edge);
      }
    }
    return filtered;
  }
}
