package org.openmetadata.service.lineage;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.EntityLineage;
import org.openmetadata.schema.type.EntityReference;

/**
 * Narrows an {@link EntityLineage} to the sub-graph a caller may see.
 *
 * <p>Two callers decide visibility differently - domain-restricted access
 * ({@code LineageRepository.pruneLineageByDomain}) and per-node VIEW_BASIC
 * ({@link LineagePermissionFilter}) - but both need the same graph surgery afterwards, so the walk
 * lives here rather than being duplicated.
 *
 * <p>Visibility alone is not enough to decide what to return. Dropping a node in the middle of a
 * chain would otherwise leave the nodes behind it floating, connected to the root only through an
 * edge that no longer exists, which reads as direct lineage it is not. So the kept set is the
 * nodes reachable from the root <em>through visible nodes only</em>, and edges are filtered to
 * that set so none dangle.
 */
public final class LineageGraphPruner {

  private LineageGraphPruner() {}

  /**
   * Retains the visible nodes still reachable from the root, and the edges between them. Mutates
   * {@code lineage} in place.
   *
   * @param visible ids the caller may see; the root's own id must be present or everything is
   *     dropped
   * @return how many nodes were removed
   */
  public static int retainReachable(EntityLineage lineage, Set<UUID> visible) {
    int before = listOrEmpty(lineage.getNodes()).size();
    Set<UUID> keep = reachableNodeIds(lineage.getEntity().getId(), visible, lineage);
    lineage.setNodes(filterNodes(lineage.getNodes(), keep));
    lineage.setUpstreamEdges(filterEdges(lineage.getUpstreamEdges(), keep));
    lineage.setDownstreamEdges(filterEdges(lineage.getDownstreamEdges(), keep));
    return before - lineage.getNodes().size();
  }

  private static Set<UUID> reachableNodeIds(UUID rootId, Set<UUID> visible, EntityLineage lineage) {
    Set<UUID> reachable = new HashSet<>();
    if (visible.contains(rootId)) {
      Map<UUID, Set<UUID>> adjacency = buildAdjacency(lineage, visible);
      Deque<UUID> queue = new ArrayDeque<>();
      queue.add(rootId);
      reachable.add(rootId);
      while (!queue.isEmpty()) {
        for (UUID neighbor : adjacency.getOrDefault(queue.poll(), Set.of())) {
          if (reachable.add(neighbor)) {
            queue.add(neighbor);
          }
        }
      }
    }
    return reachable;
  }

  /**
   * Undirected on purpose: reachability here answers "is this node still attached to the root",
   * which does not care which way the data flows.
   */
  private static Map<UUID, Set<UUID>> buildAdjacency(EntityLineage lineage, Set<UUID> visible) {
    Map<UUID, Set<UUID>> adjacency = new HashMap<>();
    List<Edge> edges = new ArrayList<>(listOrEmpty(lineage.getUpstreamEdges()));
    edges.addAll(listOrEmpty(lineage.getDownstreamEdges()));
    for (Edge edge : edges) {
      linkVisibleNodes(adjacency, visible, edge.getFromEntity(), edge.getToEntity());
    }
    return adjacency;
  }

  private static void linkVisibleNodes(
      Map<UUID, Set<UUID>> adjacency, Set<UUID> visible, UUID from, UUID to) {
    if (from != null && to != null && visible.contains(from) && visible.contains(to)) {
      adjacency.computeIfAbsent(from, key -> new HashSet<>()).add(to);
      adjacency.computeIfAbsent(to, key -> new HashSet<>()).add(from);
    }
  }

  private static List<EntityReference> filterNodes(List<EntityReference> nodes, Set<UUID> keep) {
    List<EntityReference> filtered = new ArrayList<>();
    for (EntityReference node : listOrEmpty(nodes)) {
      if (keep.contains(node.getId())) {
        filtered.add(node);
      }
    }
    return filtered;
  }

  private static List<Edge> filterEdges(List<Edge> edges, Set<UUID> keep) {
    List<Edge> filtered = new ArrayList<>();
    for (Edge edge : listOrEmpty(edges)) {
      if (keep.contains(edge.getFromEntity()) && keep.contains(edge.getToEntity())) {
        filtered.add(edge);
      }
    }
    return filtered;
  }
}
