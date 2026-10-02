package org.openmetadata.service.lineage;

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
import org.openmetadata.schema.api.lineage.CompactLineage;
import org.openmetadata.schema.api.lineage.CompactLineageEdge;
import org.openmetadata.schema.api.lineage.LineageEdgeEndpoints;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Cuts one page out of a lineage graph's edges, in an order that is the same on every call so an
 * offset resumes exactly where the previous page stopped.
 *
 * <p>The repository returns edges depth-first with no ORDER BY, which is neither stable nor nearest
 * first. Here each direction is ordered nearest hop first, then by FQN, and the two directions are
 * interleaved so a page clipped by the size budget still shows both.
 */
public final class LineageEdgePager {

  /**
   * Room kept for the markers added after a page is cut (counts, cursor, notes, the named oversized
   * edges), so a page that measures just under the cap still lands under it once they are added.
   */
  private static final int ANNOTATION_HEADROOM_CHARS = 5_000;

  /**
   * Fraction of the cap the edges may fill once a page has to be cut, leaving room for the response
   * shell and the serialization overhead around the edge lists.
   */
  private static final double ITEM_BUDGET_FACTOR = 0.8;

  /** Naming every skipped edge is itself unbounded; past a few names, the count says the rest. */
  private static final int MAX_NAMED_OVERSIZED_EDGES = 10;

  private record DirectedEdge(boolean upstream, CompactLineageEdge edge) {}

  /** The sizes one page is measured against, all in serialized characters. */
  private record Budget(long overhead, long pageLimit, long itemBudget) {
    static Budget of(CompactLineage slim, int maxResponseChars) {
      long overhead = serializedLength(withEdges(slim, List.of()));
      return new Budget(
          overhead,
          maxResponseChars - ANNOTATION_HEADROOM_CHARS,
          Math.max(0, (long) (maxResponseChars * ITEM_BUDGET_FACTOR) - overhead));
    }

    /**
     * Forward progress would still return such an edge alone, and a transport cap would then swap
     * the whole page for a stub with no cursor, stranding every edge after it. Skipping it keeps the
     * rest of the graph reachable.
     */
    boolean isTooLargeAlone(DirectedEdge edge) {
      return overhead + serializedLength(edge.edge()) + 1 > pageLimit;
    }

    /**
     * The whole window when it fits under the cap less the marker headroom (the common case,
     * returned unchanged); otherwise as many leading edges as fit the item budget, never zero while
     * any remain. Each edge is measured once.
     */
    int fittingCount(List<DirectedEdge> window) {
      long[] sizes = window.stream().mapToLong(edge -> serializedLength(edge.edge()) + 1).toArray();
      long total = overhead;
      for (long size : sizes) {
        total += size;
      }
      return total <= pageLimit ? window.size() : prefixWithinItemBudget(sizes);
    }

    private int prefixWithinItemBudget(long[] sizes) {
      long used = 0;
      int count = 0;
      while (count < sizes.length && used + sizes[count] <= itemBudget) {
        used += sizes[count];
        count++;
      }
      return count == 0 && sizes.length > 0 && itemBudget > 0 ? 1 : count;
    }
  }

  private LineageEdgePager() {}

  /**
   * One page of {@code slim}'s edges starting at {@code from}, at most {@code limit} edges and within
   * {@code maxResponseChars}, with the markers that say what this page does not hold.
   */
  public static CompactLineage page(
      CompactLineage slim, int from, int limit, int maxResponseChars) {
    List<DirectedEdge> ordered =
        interleave(
            nearestFirst(
                slim.getUpstream(),
                slim.getRoot(),
                CompactLineageEdge::getToFQN,
                CompactLineageEdge::getFromFQN),
            nearestFirst(
                slim.getDownstream(),
                slim.getRoot(),
                CompactLineageEdge::getFromFQN,
                CompactLineageEdge::getToFQN));
    Budget budget = Budget.of(slim, maxResponseChars);
    int start = Math.clamp(from, 0, ordered.size());
    List<CompactLineageEdge> oversized = new ArrayList<>();
    while (start < ordered.size() && budget.isTooLargeAlone(ordered.get(start))) {
      oversized.add(ordered.get(start).edge());
      start++;
    }
    List<DirectedEdge> window =
        ordered.subList(start, start + Math.min(ordered.size() - start, Math.max(limit, 1)));
    List<DirectedEdge> kept = window.subList(0, budget.fittingCount(window));
    return describe(slim, kept, start, ordered.size(), oversized);
  }

  private static CompactLineage describe(
      CompactLineage slim,
      List<DirectedEdge> kept,
      int start,
      int total,
      List<CompactLineageEdge> oversized) {
    int nextFrom = start + kept.size();
    boolean hasMore = nextFrom < total;
    CompactLineage page =
        withEdges(slim, kept)
            .withTotalEdges(total)
            .withReturnedEdges(kept.size())
            .withFirstEdge(start)
            .withHasMore(hasMore)
            .withEdgesTruncated(hasMore || !oversized.isEmpty());
    if (hasMore) {
      describeRemainder(page, slim, nextFrom);
    }
    if (!oversized.isEmpty()) {
      page.withOversizedEdges(namedEndpoints(oversized)).withOversizedEdgeCount(oversized.size());
    }
    return page;
  }

  private static void describeRemainder(CompactLineage page, CompactLineage slim, int nextFrom) {
    page.withNextFrom(nextFrom)
        .withUpstreamReturned(listOrEmpty(page.getUpstream()).size())
        .withUpstreamTotal(listOrEmpty(slim.getUpstream()).size())
        .withDownstreamReturned(listOrEmpty(page.getDownstream()).size())
        .withDownstreamTotal(listOrEmpty(slim.getDownstream()).size());
  }

  private static List<LineageEdgeEndpoints> namedEndpoints(List<CompactLineageEdge> oversized) {
    return oversized.stream()
        .limit(MAX_NAMED_OVERSIZED_EDGES)
        .map(
            edge ->
                new LineageEdgeEndpoints()
                    .withFromFQN(edge.getFromFQN())
                    .withToFQN(edge.getToFQN()))
        .toList();
  }

  private static CompactLineage withEdges(CompactLineage slim, List<DirectedEdge> edges) {
    return new CompactLineage()
        .withRoot(slim.getRoot())
        .withRootId(slim.getRootId())
        .withRootType(slim.getRootType())
        .withUpstream(edgesOf(edges, true))
        .withDownstream(edgesOf(edges, false))
        .withOversizedEdges(null);
  }

  private static long serializedLength(Object value) {
    return JsonUtils.pojoToJson(value).length();
  }

  private static List<CompactLineageEdge> edgesOf(List<DirectedEdge> edges, boolean upstream) {
    return edges.stream()
        .filter(edge -> edge.upstream() == upstream)
        .map(DirectedEdge::edge)
        .toList();
  }

  private static List<DirectedEdge> interleave(
      List<CompactLineageEdge> upstream, List<CompactLineageEdge> downstream) {
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
  private static List<CompactLineageEdge> nearestFirst(
      List<CompactLineageEdge> edges,
      String root,
      Function<CompactLineageEdge, String> near,
      Function<CompactLineageEdge, String> far) {
    Map<String, Integer> hops = hopsFromRoot(listOrEmpty(edges), root, near, far);
    Comparator<CompactLineageEdge> order =
        Comparator.<CompactLineageEdge>comparingInt(
                edge -> hops.getOrDefault(near.apply(edge), Integer.MAX_VALUE))
            .thenComparing(CompactLineageEdge::getFromFQN, nullsLast(naturalOrder()))
            .thenComparing(CompactLineageEdge::getToFQN, nullsLast(naturalOrder()))
            .thenComparing(CompactLineageEdge::getRelationshipType, nullsLast(naturalOrder()));
    return listOrEmpty(edges).stream().sorted(order).toList();
  }

  private static Map<String, Integer> hopsFromRoot(
      List<CompactLineageEdge> edges,
      String root,
      Function<CompactLineageEdge, String> near,
      Function<CompactLineageEdge, String> far) {
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
      List<CompactLineageEdge> edges,
      Function<CompactLineageEdge, String> near,
      Function<CompactLineageEdge, String> far) {
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
