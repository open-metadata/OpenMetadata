package org.openmetadata.service.search.lineage;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Queue;
import java.util.Set;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.api.lineage.LineageDirection;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.type.DependencyType;
import org.openmetadata.schema.type.lineage.NodeInformation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.LineagePathPreserver;

/**
 * Resolves transitive DIRECT vs INDIRECT dependency reachability from a root entity and filters
 * lineage results by effective dependency type.
 */
public final class LineageDependencyResolver {
  public static final String DEPENDENCY_TYPE_PROPERTY = "dependencyType";
  private static final String ALL_FILTER = "ALL";

  private LineageDependencyResolver() {}

  public static boolean isDirectEdge(final EsLineageData edge) {
    return edge == null || edge.getDependencyType() != DependencyType.INDIRECT;
  }

  public static DependencyType effectiveDependencyType(final boolean hasDirectPath) {
    return hasDirectPath ? DependencyType.DIRECT : DependencyType.INDIRECT;
  }

  public static boolean matchesFilter(
      final DependencyType effectiveType, final DependencyType filter) {
    return filter == null || effectiveType == filter;
  }

  public static boolean matchesEdgeFilter(
      final EsLineageData edge, final DependencyType filter) {
    boolean matches;
    if (filter == null) {
      matches = true;
    } else if (filter == DependencyType.DIRECT) {
      matches = isDirectEdge(edge);
    } else {
      matches = !isDirectEdge(edge);
    }
    return matches;
  }

  public static DependencyType parseDependencyTypeFilter(final String rawValue) {
    final DependencyType parsed;
    if (nullOrEmpty(rawValue) || rawValue.trim().isEmpty()) {
      parsed = null;
    } else {
      final String normalized = rawValue.trim().toUpperCase(Locale.ROOT);
      if (ALL_FILTER.equals(normalized)) {
        parsed = null;
      } else if (DependencyType.DIRECT.value().equals(normalized)) {
        parsed = DependencyType.DIRECT;
      } else if (DependencyType.INDIRECT.value().equals(normalized)) {
        parsed = DependencyType.INDIRECT;
      } else {
        throw new IllegalArgumentException(
            String.format(
                "Invalid dependencyType '%s'. Allowed values: DIRECT, INDIRECT, ALL.", rawValue));
      }
    }
    return parsed;
  }

  /**
   * Records reachability for {@code targetFqn}. Returns {@code true} when {@code targetFqn} is
   * newly discovered or upgraded from INDIRECT to DIRECT and therefore must be expanded again.
   */
  public static boolean recordReachability(
      final Map<String, Boolean> hasDirectPath,
      final String targetFqn,
      final boolean pathIsDirect) {
    final Boolean previous = hasDirectPath.get(targetFqn);
    final boolean shouldEnqueue;
    if (previous == null) {
      hasDirectPath.put(targetFqn, pathIsDirect);
      shouldEnqueue = true;
    } else if (!previous && pathIsDirect) {
      hasDirectPath.put(targetFqn, true);
      shouldEnqueue = true;
    } else {
      shouldEnqueue = false;
    }
    return shouldEnqueue;
  }

  public static void setNodeDependencyType(
      final NodeInformation node, final DependencyType dependencyType) {
    if (node != null && dependencyType != null) {
      node.setAdditionalProperty(DEPENDENCY_TYPE_PROPERTY, dependencyType.value());
    }
  }

  public static DependencyType getNodeDependencyType(final NodeInformation node) {
    final DependencyType resolved;
    if (node != null
        && node.getAdditionalProperties() != null
        && DependencyType.INDIRECT
            .value()
            .equals(node.getAdditionalProperties().get(DEPENDENCY_TYPE_PROPERTY))) {
      resolved = DependencyType.INDIRECT;
    } else {
      resolved = DependencyType.DIRECT;
    }
    return resolved;
  }

  public static Map<String, Boolean> computeTransitiveDirectPaths(
      final SearchLineageResult result, final String rootFqn, final LineageDirection direction) {
    final Map<String, Boolean> hasDirectPath = new HashMap<>();
    if (result != null && !nullOrEmpty(rootFqn)) {
      hasDirectPath.put(rootFqn, true);
      if (direction == null || direction == LineageDirection.DOWNSTREAM) {
        propagateDirection(rootFqn, buildForwardAdjacency(result.getDownstreamEdges()), hasDirectPath);
      }
      if (direction == null || direction == LineageDirection.UPSTREAM) {
        propagateDirection(rootFqn, buildReverseAdjacency(result.getUpstreamEdges()), hasDirectPath);
      }
    }
    return hasDirectPath;
  }

  public static void annotateNodeDependencyTypes(
      final SearchLineageResult result, final String rootFqn, final LineageDirection direction) {
    if (result != null && result.getNodes() != null && !nullOrEmpty(rootFqn)) {
      final Map<String, Boolean> hasDirectPath =
          computeTransitiveDirectPaths(result, rootFqn, direction);
      for (Map.Entry<String, NodeInformation> entry : result.getNodes().entrySet()) {
        final boolean direct = hasDirectPath.getOrDefault(entry.getKey(), true);
        setNodeDependencyType(entry.getValue(), effectiveDependencyType(direct));
      }
    }
  }

  public static SearchLineageResult filterByDependencyType(
      final SearchLineageResult result,
      final String rootFqn,
      final LineageDirection direction,
      final DependencyType filter,
      final boolean preservePaths) {
    final SearchLineageResult filtered;
    if (result == null || nullOrEmpty(rootFqn)) {
      filtered = result;
    } else {
      annotateNodeDependencyTypes(result, rootFqn, direction);
      if (filter == null) {
        filtered = result;
      } else if (filter == DependencyType.DIRECT) {
        filtered = retainDirectSubgraph(result, rootFqn, direction);
      } else {
        filtered = retainIndirectSubgraph(result, rootFqn, direction, preservePaths);
      }
    }
    return filtered;
  }

  public static Map<Integer, List<String>> filterEntitiesByDepth(
      final Map<Integer, List<String>> entitiesByDepth,
      final Map<String, Boolean> hasDirectPath,
      final DependencyType filter) {
    final Map<Integer, List<String>> filtered;
    if (filter == null || entitiesByDepth == null) {
      filtered = entitiesByDepth;
    } else {
      filtered = new LinkedHashMap<>();
      for (Map.Entry<Integer, List<String>> entry : entitiesByDepth.entrySet()) {
        final List<String> matching = filterFqns(entry.getValue(), hasDirectPath, filter);
        if (!matching.isEmpty()) {
          filtered.put(entry.getKey(), matching);
        }
      }
    }
    return filtered;
  }

  private static List<String> filterFqns(
      final List<String> fqns,
      final Map<String, Boolean> hasDirectPath,
      final DependencyType filter) {
    final List<String> matching = new ArrayList<>();
    for (String entityFqn : fqns) {
      final DependencyType effectiveType =
          effectiveDependencyType(Boolean.TRUE.equals(hasDirectPath.get(entityFqn)));
      if (matchesFilter(effectiveType, filter)) {
        matching.add(entityFqn);
      }
    }
    return matching;
  }

  private static void propagateDirection(
      final String rootFqn,
      final Map<String, List<DirectedEdge>> adjacency,
      final Map<String, Boolean> hasDirectPath) {
    final Queue<String> queue = new ArrayDeque<>();
    queue.add(rootFqn);
    while (!queue.isEmpty()) {
      final String current = queue.poll();
      final boolean currentDirect = Boolean.TRUE.equals(hasDirectPath.get(current));
      for (DirectedEdge next : adjacency.getOrDefault(current, List.of())) {
        final boolean candidateDirect = currentDirect && next.direct();
        if (recordReachability(hasDirectPath, next.targetFqn(), candidateDirect)) {
          queue.add(next.targetFqn());
        }
      }
    }
  }

  private static Map<String, List<DirectedEdge>> buildForwardAdjacency(
      final Map<String, EsLineageData> edges) {
    final Map<String, List<DirectedEdge>> adjacency = new HashMap<>();
    if (edges != null) {
      for (EsLineageData edge : edges.values()) {
        addDirectedEdge(adjacency, edge, true);
      }
    }
    return adjacency;
  }

  private static Map<String, List<DirectedEdge>> buildReverseAdjacency(
      final Map<String, EsLineageData> edges) {
    final Map<String, List<DirectedEdge>> adjacency = new HashMap<>();
    if (edges != null) {
      for (EsLineageData edge : edges.values()) {
        addDirectedEdge(adjacency, edge, false);
      }
    }
    return adjacency;
  }

  private static void addDirectedEdge(
      final Map<String, List<DirectedEdge>> adjacency,
      final EsLineageData edge,
      final boolean forward) {
    if (edge != null && edge.getFromEntity() != null && edge.getToEntity() != null) {
      final String fromFqn = edge.getFromEntity().getFullyQualifiedName();
      final String toFqn = edge.getToEntity().getFullyQualifiedName();
      if (!nullOrEmpty(fromFqn) && !nullOrEmpty(toFqn)) {
        final String source = forward ? fromFqn : toFqn;
        final String target = forward ? toFqn : fromFqn;
        adjacency
            .computeIfAbsent(source, key -> new ArrayList<>())
            .add(new DirectedEdge(target, isDirectEdge(edge)));
      }
    }
  }

  private static SearchLineageResult retainDirectSubgraph(
      final SearchLineageResult result, final String rootFqn, final LineageDirection direction) {
    final SearchLineageResult copy = JsonUtils.deepCopy(result, SearchLineageResult.class);
    final Map<String, EsLineageData> directUpstream = filterEdges(copy.getUpstreamEdges(), true);
    final Map<String, EsLineageData> directDownstream =
        filterEdges(copy.getDownstreamEdges(), true);
    copy.setUpstreamEdges(directUpstream);
    copy.setDownstreamEdges(directDownstream);

    final Set<String> reachable = new HashSet<>();
    reachable.add(rootFqn);
    if (direction == null || direction == LineageDirection.DOWNSTREAM) {
      collectReachable(rootFqn, buildForwardAdjacency(directDownstream), reachable);
    }
    if (direction == null || direction == LineageDirection.UPSTREAM) {
      collectReachable(rootFqn, buildReverseAdjacency(directUpstream), reachable);
    }
    retainNodesAndConnectedEdges(copy, reachable);
    return copy;
  }

  private static SearchLineageResult retainIndirectSubgraph(
      final SearchLineageResult result,
      final String rootFqn,
      final LineageDirection direction,
      final boolean preservePaths) {
    final SearchLineageResult copy = JsonUtils.deepCopy(result, SearchLineageResult.class);
    final Map<String, Boolean> hasDirectPath =
        computeTransitiveDirectPaths(copy, rootFqn, direction);
    final Set<String> matchingNodes = new HashSet<>();
    matchingNodes.add(rootFqn);
    for (Map.Entry<String, Boolean> entry : hasDirectPath.entrySet()) {
      if (!entry.getKey().equals(rootFqn) && !Boolean.TRUE.equals(entry.getValue())) {
        matchingNodes.add(entry.getKey());
      }
    }

    final SearchLineageResult filtered;
    if (preservePaths) {
      filtered = LineagePathPreserver.preservePathsWithEdges(copy, rootFqn, matchingNodes);
    } else {
      retainNodesAndConnectedEdges(copy, matchingNodes);
      filtered = copy;
    }
    return filtered;
  }

  private static Map<String, EsLineageData> filterEdges(
      final Map<String, EsLineageData> edges, final boolean keepDirect) {
    final Map<String, EsLineageData> filtered = new HashMap<>();
    if (edges != null) {
      for (Map.Entry<String, EsLineageData> entry : edges.entrySet()) {
        if (isDirectEdge(entry.getValue()) == keepDirect) {
          filtered.put(entry.getKey(), entry.getValue());
        }
      }
    }
    return filtered;
  }

  private static void collectReachable(
      final String rootFqn,
      final Map<String, List<DirectedEdge>> adjacency,
      final Set<String> reachable) {
    final Queue<String> queue = new ArrayDeque<>();
    queue.add(rootFqn);
    while (!queue.isEmpty()) {
      final String current = queue.poll();
      for (DirectedEdge next : adjacency.getOrDefault(current, List.of())) {
        if (reachable.add(next.targetFqn())) {
          queue.add(next.targetFqn());
        }
      }
    }
  }

  private static void retainNodesAndConnectedEdges(
      final SearchLineageResult result, final Collection<String> keptFqns) {
    final Set<String> keptSet = new HashSet<>(keptFqns);
    if (result.getNodes() != null) {
      final Map<String, NodeInformation> keptNodes = new HashMap<>();
      for (Map.Entry<String, NodeInformation> entry : result.getNodes().entrySet()) {
        if (keptSet.contains(entry.getKey())) {
          keptNodes.put(entry.getKey(), entry.getValue());
        }
      }
      result.setNodes(keptNodes);
    }
    if (result.getUpstreamEdges() != null) {
      result.setUpstreamEdges(retainConnectedEdges(result.getUpstreamEdges(), keptSet));
    }
    if (result.getDownstreamEdges() != null) {
      result.setDownstreamEdges(retainConnectedEdges(result.getDownstreamEdges(), keptSet));
    }
  }

  private static Map<String, EsLineageData> retainConnectedEdges(
      final Map<String, EsLineageData> edges, final Set<String> keptNodes) {
    final Map<String, EsLineageData> filtered = new HashMap<>();
    for (Map.Entry<String, EsLineageData> entry : edges.entrySet()) {
      final EsLineageData edge = entry.getValue();
      final String fromFqn =
          edge.getFromEntity() != null ? edge.getFromEntity().getFullyQualifiedName() : null;
      final String toFqn =
          edge.getToEntity() != null ? edge.getToEntity().getFullyQualifiedName() : null;
      if (fromFqn != null && toFqn != null && keptNodes.contains(fromFqn) && keptNodes.contains(toFqn)) {
        filtered.put(entry.getKey(), edge);
      }
    }
    return filtered;
  }

  private record DirectedEdge(String targetFqn, boolean direct) {}
}
