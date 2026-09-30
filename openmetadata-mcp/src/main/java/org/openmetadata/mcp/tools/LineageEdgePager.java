package org.openmetadata.mcp.tools;

import static java.util.Comparator.naturalOrder;
import static java.util.Comparator.nullsLast;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import org.openmetadata.mcp.tools.GetLineageTool.SlimEdge;
import org.openmetadata.mcp.tools.GetLineageTool.SlimLineage;
import org.openmetadata.mcp.util.McpResponseTrim;
import org.openmetadata.mcp.util.ResponseBudget;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Cuts one page out of a lineage graph's edges, in an order that is the same on every call so an
 * offset resumes exactly where the previous page stopped.
 *
 * <p>The repository returns edges depth-first with no ORDER BY, which is neither stable nor nearest
 * first. Here each direction is ordered nearest hop first, then by FQN, and the two directions are
 * interleaved so a page clipped by the size budget still shows both.
 */
final class LineageEdgePager {

  /**
   * Room kept for the markers added after a page is cut (counts, cursor, notes), so a page holding
   * one very large edge still lands under the dispatch cap.
   */
  private static final int ANNOTATION_HEADROOM_CHARS = 2_000;

  /**
   * The edges one page holds per direction, the index of its first edge, where the next page
   * starts, the graph's total, and any edges skipped because no response could hold them.
   */
  record Page(
      List<SlimEdge> upstream,
      List<SlimEdge> downstream,
      int start,
      int nextFrom,
      int total,
      List<SlimEdge> oversized) {
    boolean hasMore() {
      return nextFrom < total;
    }

    int returned() {
      return upstream.size() + downstream.size();
    }
  }

  private record DirectedEdge(boolean upstream, SlimEdge edge) {}

  private LineageEdgePager() {}

  static Page page(SlimLineage slim, int from) {
    List<DirectedEdge> ordered =
        interleave(
            nearestFirst(slim.upstream(), slim.root(), SlimEdge::toFQN, SlimEdge::fromFQN),
            nearestFirst(slim.downstream(), slim.root(), SlimEdge::fromFQN, SlimEdge::toFQN));
    int start = Math.clamp(from, 0, ordered.size());
    List<SlimEdge> oversized = new ArrayList<>();
    while (start < ordered.size() && isTooLargeForAnyResponse(slim, ordered.get(start))) {
      oversized.add(ordered.get(start).edge());
      start++;
    }
    List<DirectedEdge> window = ordered.subList(start, ordered.size());
    List<DirectedEdge> kept = window.subList(0, fittingCount(slim, window));
    return new Page(
        edgesOf(kept, true),
        edgesOf(kept, false),
        start,
        start + kept.size(),
        ordered.size(),
        oversized);
  }

  /**
   * Forward progress would still return such an edge alone, and the dispatch floor would then swap
   * the whole page for a stub with no cursor, stranding every edge after it. Skipping it keeps the
   * rest of the graph reachable.
   */
  private static boolean isTooLargeForAnyResponse(SlimLineage slim, DirectedEdge edge) {
    return McpResponseTrim.serializedLength(JsonUtils.getMap(withEdges(slim, List.of(edge))))
        > McpResponseTrim.MAX_RESPONSE_CHARS - ANNOTATION_HEADROOM_CHARS;
  }

  /**
   * The whole window when it fits under the dispatch cap (the common case, returned unchanged);
   * otherwise as many leading edges as fit the item budget, which is never zero while any remain.
   */
  private static int fittingCount(SlimLineage slim, List<DirectedEdge> window) {
    int count = window.size();
    if (McpResponseTrim.serializedLength(JsonUtils.getMap(withEdges(slim, window)))
        > McpResponseTrim.MAX_RESPONSE_CHARS) {
      long overhead =
          McpResponseTrim.serializedLength(JsonUtils.getMap(withEdges(slim, List.of())));
      long available = Math.max(0, ResponseBudget.defaultBudgetChars() - overhead);
      count =
          ResponseBudget.fitWithin(window.stream().map(DirectedEdge::edge).toList(), available)
              .count();
    }
    return count;
  }

  private static SlimLineage withEdges(SlimLineage slim, List<DirectedEdge> edges) {
    return new SlimLineage(
        slim.root(), slim.rootId(), slim.rootType(), edgesOf(edges, true), edgesOf(edges, false));
  }

  private static List<SlimEdge> edgesOf(List<DirectedEdge> edges, boolean upstream) {
    return edges.stream()
        .filter(edge -> edge.upstream() == upstream)
        .map(DirectedEdge::edge)
        .toList();
  }

  private static List<DirectedEdge> interleave(List<SlimEdge> upstream, List<SlimEdge> downstream) {
    List<DirectedEdge> merged = new ArrayList<>(upstream.size() + downstream.size());
    for (int i = 0; i < Math.max(upstream.size(), downstream.size()); i++) {
      if (i < upstream.size()) {
        merged.add(new DirectedEdge(true, upstream.get(i)));
      }
      if (i < downstream.size()) {
        merged.add(new DirectedEdge(false, downstream.get(i)));
      }
    }
    return merged;
  }

  /**
   * {@code near} is the endpoint closer to the root: the from-side for downstream edges, the to-side
   * for upstream ones. Edges not connected to the root sort last rather than being dropped.
   */
  private static List<SlimEdge> nearestFirst(
      List<SlimEdge> edges,
      String root,
      Function<SlimEdge, String> near,
      Function<SlimEdge, String> far) {
    Map<String, Integer> hops = hopsFromRoot(listOrEmpty(edges), root, near, far);
    Comparator<SlimEdge> order =
        Comparator.<SlimEdge>comparingInt(
                edge -> hops.getOrDefault(near.apply(edge), Integer.MAX_VALUE))
            .thenComparing(SlimEdge::fromFQN, nullsLast(naturalOrder()))
            .thenComparing(SlimEdge::toFQN, nullsLast(naturalOrder()))
            .thenComparing(SlimEdge::relationshipType, nullsLast(naturalOrder()));
    return listOrEmpty(edges).stream().sorted(order).toList();
  }

  private static Map<String, Integer> hopsFromRoot(
      List<SlimEdge> edges,
      String root,
      Function<SlimEdge, String> near,
      Function<SlimEdge, String> far) {
    Map<String, List<String>> next = nextHops(edges, near, far);
    Map<String, Integer> hops = new HashMap<>();
    Deque<String> queue = new ArrayDeque<>();
    if (root != null) {
      hops.put(root, 0);
      queue.add(root);
    }
    while (!queue.isEmpty()) {
      String node = queue.poll();
      for (String neighbour : next.getOrDefault(node, List.of())) {
        if (hops.putIfAbsent(neighbour, hops.get(node) + 1) == null) {
          queue.add(neighbour);
        }
      }
    }
    return hops;
  }

  private static Map<String, List<String>> nextHops(
      List<SlimEdge> edges, Function<SlimEdge, String> near, Function<SlimEdge, String> far) {
    Map<String, List<String>> next = new HashMap<>();
    edges.stream()
        .filter(edge -> near.apply(edge) != null && far.apply(edge) != null)
        .forEach(
            edge ->
                next.computeIfAbsent(near.apply(edge), key -> new ArrayList<>())
                    .add(far.apply(edge)));
    return next;
  }
}
