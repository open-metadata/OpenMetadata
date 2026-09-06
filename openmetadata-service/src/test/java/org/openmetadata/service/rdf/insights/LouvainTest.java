package org.openmetadata.service.rdf.insights;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class LouvainTest {

  private static Map<String, Map<String, Double>> g(Object... edges) {
    Map<String, Map<String, Double>> graph = new LinkedHashMap<>();
    for (int i = 0; i < edges.length; i += 3) {
      String from = (String) edges[i];
      String to = (String) edges[i + 1];
      double w = ((Number) edges[i + 2]).doubleValue();
      graph.computeIfAbsent(from, k -> new HashMap<>()).put(to, w);
      graph.computeIfAbsent(to, k -> new HashMap<>());
    }
    return graph;
  }

  @Nested
  @DisplayName("Constructor / input guards")
  class Guards {

    @Test
    @DisplayName("maxIterations < 1 is rejected")
    void badMaxIterations() {
      assertThrows(IllegalArgumentException.class, () -> new Louvain(0));
      assertThrows(IllegalArgumentException.class, () -> new Louvain(-3));
    }

    @Test
    @DisplayName("Null and empty graphs return empty result with modularity 0")
    void emptyInputs() {
      Louvain.Result<String> r1 = new Louvain().compute(null);
      assertTrue(r1.communityByNode().isEmpty());
      assertEquals(0.0, r1.modularity());
      Louvain.Result<String> r2 = new Louvain().compute(Map.of());
      assertTrue(r2.communityByNode().isEmpty());
    }

    @Test
    @DisplayName("Graph with only self-loops produces singletons (self-loops ignored)")
    void onlySelfLoops() {
      Map<String, Map<String, Double>> graph =
          new LinkedHashMap<>(
              Map.of(
                  "a", new HashMap<>(Map.of("a", 1.0)),
                  "b", new HashMap<>(Map.of("b", 1.0))));
      Louvain.Result<String> r = new Louvain().compute(graph);
      assertEquals(2, r.communityCount(), "Self-loops carry no community signal");
    }

    @Test
    @DisplayName("Negative weights are clamped to zero")
    void negativeWeights() {
      Louvain.Result<String> r = new Louvain().compute(g("a", "b", -100.0));
      assertEquals(2, r.communityCount(), "Negative-weight edges must not pull nodes together");
    }
  }

  @Nested
  @DisplayName("Topology → community structure")
  class Topology {

    @Test
    @DisplayName("Triangle (three nodes, three edges): everyone joins one community")
    void triangle() {
      Map<String, Map<String, Double>> graph = g("a", "b", 1.0, "b", "c", 1.0, "a", "c", 1.0);
      Louvain.Result<String> r = new Louvain().compute(graph);
      assertEquals(1, r.communityCount());
    }

    @Test
    @DisplayName("Two cliques connected by a single light edge: two communities")
    void twoCliques() {
      Map<String, Map<String, Double>> graph =
          g(
              "a", "b", 1.0, "b", "c", 1.0, "a", "c", 1.0, "x", "y", 1.0, "y", "z", 1.0, "x", "z",
              1.0, "c", "x", 0.01);
      Louvain.Result<String> r = new Louvain().compute(graph);
      assertEquals(2, r.communityCount());
      assertEquals(r.communityByNode().get("a"), r.communityByNode().get("b"));
      assertEquals(r.communityByNode().get("a"), r.communityByNode().get("c"));
      assertEquals(r.communityByNode().get("x"), r.communityByNode().get("y"));
      assertEquals(r.communityByNode().get("x"), r.communityByNode().get("z"));
      assertNotEquals(r.communityByNode().get("a"), r.communityByNode().get("x"));
    }

    @Test
    @DisplayName("Disconnected components yield distinct communities")
    void disconnectedComponents() {
      Map<String, Map<String, Double>> graph = g("a", "b", 1.0, "c", "d", 1.0, "e", "f", 1.0);
      Louvain.Result<String> r = new Louvain().compute(graph);
      assertEquals(3, r.communityCount());
    }

    @Test
    @DisplayName("Star (hub + leaves) collapses to a single community")
    void star() {
      Map<String, Map<String, Double>> graph = new LinkedHashMap<>();
      graph.put("hub", new HashMap<>());
      for (int i = 0; i < 6; i++) {
        graph.computeIfAbsent("hub", k -> new HashMap<>()).put("leaf-" + i, 1.0);
        graph.put("leaf-" + i, new HashMap<>());
      }
      Louvain.Result<String> r = new Louvain().compute(graph);
      assertEquals(1, r.communityCount());
    }

    @Test
    @DisplayName("Heavy edges pull nodes together against light competing edges")
    void edgeWeightsRespected() {
      Map<String, Map<String, Double>> graph = g("a", "b", 100.0, "a", "c", 0.1, "c", "d", 100.0);
      Louvain.Result<String> r = new Louvain().compute(graph);
      assertEquals(r.communityByNode().get("a"), r.communityByNode().get("b"));
      assertEquals(r.communityByNode().get("c"), r.communityByNode().get("d"));
      assertNotEquals(r.communityByNode().get("a"), r.communityByNode().get("c"));
    }
  }

  @Nested
  @DisplayName("Symmetrization")
  class Symmetrization {

    @Test
    @DisplayName("Asymmetric input is treated as undirected")
    void asymmetricInput() {
      Map<String, Map<String, Double>> graph = new LinkedHashMap<>();
      graph.put("a", new HashMap<>(Map.of("b", 5.0)));
      graph.put("b", new HashMap<>());
      Louvain.Result<String> r = new Louvain().compute(graph);
      assertEquals(1, r.communityCount(), "Single edge a→b should still pull a, b together");
    }

    @Test
    @DisplayName("Both-directions input doesn't double-influence")
    void bothDirectionsSum() {
      Map<String, Map<String, Double>> graph = g("a", "b", 5.0, "b", "a", 5.0);
      Louvain.Result<String> r = new Louvain().compute(graph);
      assertEquals(1, r.communityCount());
    }
  }

  @Nested
  @DisplayName("Determinism")
  class Determinism {

    @Test
    @DisplayName("Repeated runs on the same input produce the same partition")
    void deterministic() {
      Map<String, Map<String, Double>> graph =
          g(
              "a", "b", 1.0, "b", "c", 1.0, "c", "a", 1.0, "x", "y", 1.0, "y", "z", 1.0, "z", "x",
              1.0, "a", "x", 0.05);
      Louvain.Result<String> r1 = new Louvain().compute(graph);
      Louvain.Result<String> r2 = new Louvain().compute(graph);
      assertEquals(r1.communityByNode(), r2.communityByNode());
      assertEquals(r1.modularity(), r2.modularity());
    }

    @Test
    @DisplayName("Community ids are dense [0..k-1] in discovery order")
    void denseIds() {
      Map<String, Map<String, Double>> graph = g("a", "b", 1.0, "c", "d", 1.0);
      Louvain.Result<String> r = new Louvain().compute(graph);
      List<Integer> ids = r.communityByNode().values().stream().distinct().sorted().toList();
      assertEquals(List.of(0, 1), ids);
    }
  }

  @Nested
  @DisplayName("Modularity behaviour")
  class Modularity {

    @Test
    @DisplayName("Tight clusters produce higher modularity than mixed input")
    void clustersHaveHigherQ() {
      Map<String, Map<String, Double>> tight =
          g(
              "a", "b", 1.0, "b", "c", 1.0, "c", "a", 1.0, "x", "y", 1.0, "y", "z", 1.0, "z", "x",
              1.0, "a", "x", 0.05);
      Map<String, Map<String, Double>> mixed =
          g(
              "a", "b", 1.0, "a", "c", 1.0, "a", "d", 1.0, "a", "e", 1.0, "a", "f", 1.0, "a", "g",
              1.0);
      double qTight = new Louvain().compute(tight).modularity();
      double qMixed = new Louvain().compute(mixed).modularity();
      assertTrue(
          qTight > qMixed,
          "Two-clique partition must score higher modularity than a star (got tight="
              + qTight
              + ", mixed="
              + qMixed
              + ")");
    }
  }

  @Nested
  @DisplayName("Result helpers")
  class ResultHelpers {

    @Test
    @DisplayName("membersByCommunity is the inverse view of communityByNode")
    void membersByCommunity() {
      Map<String, Map<String, Double>> graph =
          g(
              "a", "b", 1.0, "b", "c", 1.0, "a", "c", 1.0, "x", "y", 1.0, "y", "z", 1.0, "x", "z",
              1.0, "c", "x", 0.01);
      Louvain.Result<String> r = new Louvain().compute(graph);
      Map<Integer, List<String>> members = r.membersByCommunity();
      assertEquals(2, members.size());
      int totalMembers = members.values().stream().mapToInt(List::size).sum();
      assertEquals(6, totalMembers);
    }

    @Test
    @DisplayName("Iteration count is non-zero whenever any edge exists")
    void iterationsAdvance() {
      Louvain.Result<String> r = new Louvain().compute(g("a", "b", 1.0));
      assertTrue(r.iterations() >= 1);
    }
  }
}
