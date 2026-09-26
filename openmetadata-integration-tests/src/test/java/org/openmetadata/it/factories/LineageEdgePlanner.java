/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.factories;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

/**
 * Plans the edges of a layered lineage DAG. Pure and deterministic for a given
 * {@link LineageGraphSpec#randomSeed()}, so two runs of the benchmark traverse the same graph and
 * their p95s are comparable.
 *
 * <p>Two shapes are mixed on purpose. A handful of <b>hub</b> nodes carry {@code hubFanout}
 * outgoing edges each — that is what exercises {@code LineageSceneLoader.enrichFocusedChildLineage},
 * which issues up to 50 {@code searchLineage} calls at 6-way parallelism and is the single most
 * expensive path behind {@code /v1/lineage/scene}. The remainder spread evenly across consecutive
 * layers to give the traversal realistic depth rather than one wide star.
 */
public final class LineageEdgePlanner {

  private LineageEdgePlanner() {}

  public record PlannedEdge(
      LineageTableNode from, LineageTableNode to, boolean withColumnLineage) {}

  public static List<PlannedEdge> plan(
      final LineageGraphSpec spec, final List<LineageTableNode> tables) {
    final List<List<LineageTableNode>> layers = partition(tables, spec.depth());
    if (layers.size() < 2) {
      throw new IllegalArgumentException(
          "A lineage DAG needs at least 2 layers; got "
              + layers.size()
              + " from "
              + tables.size()
              + " tables at depth "
              + spec.depth());
    }
    final Set<String> seen = new HashSet<>();
    final List<PlannedEdge> edges = new ArrayList<>(spec.edges());
    addHubEdges(spec, layers, seen, edges);
    addLayeredEdges(spec, layers, seen, edges);
    return markColumnLineage(edges, spec.columnEdgeRatio());
  }

  /** Splits the cohort into {@code depth} contiguous layers, dropping any that would be empty. */
  static List<List<LineageTableNode>> partition(
      final List<LineageTableNode> tables, final int depth) {
    final int effectiveDepth = Math.min(depth, tables.size());
    final List<List<LineageTableNode>> layers = new ArrayList<>(effectiveDepth);
    final int width = tables.size() / Math.max(1, effectiveDepth);
    for (int layer = 0; layer < effectiveDepth; layer++) {
      final int start = layer * width;
      final int end = (layer == effectiveDepth - 1) ? tables.size() : start + width;
      if (end > start) {
        layers.add(tables.subList(start, end));
      }
    }
    return layers;
  }

  private static void addHubEdges(
      final LineageGraphSpec spec,
      final List<List<LineageTableNode>> layers,
      final Set<String> seen,
      final List<PlannedEdge> edges) {
    final List<LineageTableNode> sources = layers.getFirst();
    final List<LineageTableNode> targets = layers.get(1);
    final int hubs = Math.min(spec.hubCount(), sources.size());
    for (int hub = 0; hub < hubs; hub++) {
      for (int fanout = 0; fanout < spec.hubFanout() && edges.size() < spec.edges(); fanout++) {
        addIfNew(
            sources.get(hub),
            targets.get((hub * spec.hubFanout() + fanout) % targets.size()),
            seen,
            edges);
      }
    }
  }

  private static void addLayeredEdges(
      final LineageGraphSpec spec,
      final List<List<LineageTableNode>> layers,
      final Set<String> seen,
      final List<PlannedEdge> edges) {
    final Random random = new Random(spec.randomSeed());
    final int pairs = layers.size() - 1;
    // A collision-heavy spec (few tables, many edges) would otherwise spin forever on the dedup.
    final int maxAttempts = Math.max(spec.edges() * 4, spec.edges() + 1000);
    for (int attempt = 0; attempt < maxAttempts && edges.size() < spec.edges(); attempt++) {
      final List<LineageTableNode> from = layers.get(attempt % pairs);
      final List<LineageTableNode> to = layers.get((attempt % pairs) + 1);
      addIfNew(
          from.get(random.nextInt(from.size())), to.get(random.nextInt(to.size())), seen, edges);
    }
  }

  private static void addIfNew(
      final LineageTableNode from,
      final LineageTableNode to,
      final Set<String> seen,
      final List<PlannedEdge> edges) {
    if (seen.add(from.id() + "|" + to.id())) {
      edges.add(new PlannedEdge(from, to, false));
    }
  }

  /**
   * Flags an evenly spaced fraction of edges to carry column lineage. Spacing rather than a prefix
   * keeps column-level edges present at every depth, so the FIELD band is exercised wherever the
   * benchmark focuses.
   */
  private static List<PlannedEdge> markColumnLineage(
      final List<PlannedEdge> edges, final double ratio) {
    if (ratio <= 0 || edges.isEmpty()) {
      return List.copyOf(edges);
    }
    final int stride = Math.max(1, (int) Math.round(1 / Math.min(1.0, ratio)));
    final List<PlannedEdge> marked = new ArrayList<>(edges.size());
    for (int index = 0; index < edges.size(); index++) {
      final PlannedEdge edge = edges.get(index);
      marked.add(new PlannedEdge(edge.from(), edge.to(), index % stride == 0));
    }
    return List.copyOf(marked);
  }
}
