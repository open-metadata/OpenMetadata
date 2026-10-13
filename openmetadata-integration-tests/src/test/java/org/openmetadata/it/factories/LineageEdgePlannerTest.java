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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.factories.LineageEdgePlanner.PlannedEdge;

class LineageEdgePlannerTest {

  private static final int TABLES = 600;
  private static final int EDGES = 400;
  private static final int DEPTH = 6;
  private static final int HUB_COUNT = 3;
  private static final int HUB_FANOUT = 20;

  @Test
  void partitionsIntoRequestedNumberOfLayers() {
    final List<List<LineageTableNode>> layers = LineageEdgePlanner.partition(nodes(600), 6);

    assertThat(layers).hasSize(6);
    assertThat(layers.stream().mapToInt(List::size).sum()).isEqualTo(600);
  }

  @Test
  void lastLayerAbsorbsTheRemainderSoNoNodeIsDropped() {
    final List<List<LineageTableNode>> layers = LineageEdgePlanner.partition(nodes(10), 3);

    assertThat(layers.stream().mapToInt(List::size).sum()).isEqualTo(10);
    assertThat(layers.getLast()).hasSize(4);
  }

  @Test
  void neverProducesMoreLayersThanNodes() {
    final List<List<LineageTableNode>> layers = LineageEdgePlanner.partition(nodes(2), 8);

    assertThat(layers).hasSize(2);
  }

  @Test
  void producesExactlyTheRequestedEdgeCount() {
    assertThat(LineageEdgePlanner.plan(spec(EDGES), nodes(TABLES))).hasSize(EDGES);
  }

  @Test
  void producesNoDuplicateEdges() {
    final List<PlannedEdge> edges = LineageEdgePlanner.plan(spec(EDGES), nodes(TABLES));

    final long distinct =
        edges.stream().map(edge -> edge.from().id() + "|" + edge.to().id()).distinct().count();
    assertThat(distinct).isEqualTo(edges.size());
  }

  @Test
  void neverConnectsANodeToItself() {
    final List<PlannedEdge> edges = LineageEdgePlanner.plan(spec(EDGES), nodes(TABLES));

    assertThat(edges).noneMatch(edge -> edge.from().id().equals(edge.to().id()));
  }

  @Test
  void givesHubNodesTheWideFanOutTheSceneBenchmarkNeeds() {
    final List<LineageTableNode> tables = nodes(TABLES);
    final List<PlannedEdge> edges = LineageEdgePlanner.plan(spec(EDGES), tables);

    // At least, not exactly: the layered pass draws sources from layer 0 too, so a hub picks up a
    // few ordinary edges on top of its fan-out. Being a hub is a floor on degree, not a cap.
    assertThat(outDegree(edges, tables.getFirst())).isGreaterThanOrEqualTo(HUB_FANOUT);
  }

  @Test
  void leavesHubNodesDistinctlyHigherDegreeThanOrdinaryNodes() {
    final List<LineageTableNode> tables = nodes(TABLES);
    final List<PlannedEdge> edges = LineageEdgePlanner.plan(spec(EDGES), tables);

    // Node HUB_COUNT is the first non-hub in layer 0 — the fan-out must be what separates them,
    // otherwise the focused-scene scenarios are measuring an ordinary node.
    assertThat(outDegree(edges, tables.getFirst()))
        .isGreaterThan(outDegree(edges, tables.get(HUB_COUNT)));
  }

  private static long outDegree(final List<PlannedEdge> edges, final LineageTableNode node) {
    return edges.stream().filter(edge -> edge.from().id().equals(node.id())).count();
  }

  @Test
  void isDeterministicForAGivenSeed() {
    final List<LineageTableNode> tables = nodes(TABLES);

    assertThat(signature(LineageEdgePlanner.plan(spec(EDGES), tables)))
        .isEqualTo(signature(LineageEdgePlanner.plan(spec(EDGES), tables)));
  }

  @Test
  void marksTheRequestedFractionOfEdgesForColumnLineage() {
    final List<PlannedEdge> edges = LineageEdgePlanner.plan(spec(EDGES), nodes(TABLES));

    final long withColumns = edges.stream().filter(PlannedEdge::withColumnLineage).count();
    assertThat(withColumns).isEqualTo(EDGES / 5);
  }

  @Test
  void stopsRatherThanSpinningWhenTheGraphCannotHoldTheRequestedEdges() {
    // 4 nodes over 2 layers allow at most 2x2 = 4 distinct edges; asking for 500 must terminate.
    final List<PlannedEdge> edges = LineageEdgePlanner.plan(spec(500, 2, 0), nodes(4));

    assertThat(edges).hasSizeLessThanOrEqualTo(4);
  }

  @Test
  void rejectsAGraphTooSmallToHaveTwoLayers() {
    assertThatThrownBy(() -> LineageEdgePlanner.plan(spec(10), nodes(1)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("at least 2 layers");
  }

  private static String signature(final List<PlannedEdge> edges) {
    return edges.stream()
        .map(edge -> edge.from().id() + ">" + edge.to().id() + ":" + edge.withColumnLineage())
        .collect(Collectors.joining(","));
  }

  private static LineageGraphSpec spec(final int edges) {
    return spec(edges, DEPTH, HUB_COUNT);
  }

  private static LineageGraphSpec spec(final int edges, final int depth, final int hubCount) {
    return new LineageGraphSpec(
        TABLES, edges, 2, 2, 2, depth, hubCount, HUB_FANOUT, 5, 0.2, 8, 42L);
  }

  /** Ids ascend so the planner's positional layering is stable across runs of this test. */
  private static List<LineageTableNode> nodes(final int count) {
    final List<LineageTableNode> nodes = new ArrayList<>(count);
    for (int index = 0; index < count; index++) {
      nodes.add(
          new LineageTableNode(
              UUID.nameUUIDFromBytes(("n" + index).getBytes()), "svc.db.sc.t" + index));
    }
    return List.copyOf(nodes);
  }
}
