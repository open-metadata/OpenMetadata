package org.openmetadata.service.rdf.insights;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Correctness + edge-case tests for the hand-rolled PageRank implementation.
 *
 * <p>Each test names the property under test and uses a small known graph so the expected
 * scores can be reasoned about directly. We don't assert exact values from the literature
 * (those depend on damping factor and tolerance choices) — instead we assert qualitative
 * properties that must hold:
 *
 * <ul>
 *   <li>scores are normalized (sum to 1.0)
 *   <li>nodes with more incoming weight rank higher
 *   <li>dangling nodes get a non-zero score (mass redistribution)
 *   <li>disconnected components both contribute to the result
 * </ul>
 */
class PageRankTest {

  private static Map<String, Map<String, Double>> g() {
    return new LinkedHashMap<>();
  }

  private static void edge(Map<String, Map<String, Double>> g, String from, String to, double w) {
    g.computeIfAbsent(from, k -> new HashMap<>()).put(to, w);
  }

  @Nested
  @DisplayName("Constructor validation")
  class Construction {

    @Test
    @DisplayName("Damping outside (0,1) is rejected")
    void invalidDamping() {
      assertThrows(IllegalArgumentException.class, () -> new PageRank(0.0, 100, 1e-6));
      assertThrows(IllegalArgumentException.class, () -> new PageRank(1.0, 100, 1e-6));
      assertThrows(IllegalArgumentException.class, () -> new PageRank(-0.5, 100, 1e-6));
    }

    @Test
    @DisplayName("Non-positive maxIterations is rejected")
    void invalidIterations() {
      assertThrows(IllegalArgumentException.class, () -> new PageRank(0.85, 0, 1e-6));
      assertThrows(IllegalArgumentException.class, () -> new PageRank(0.85, -1, 1e-6));
    }

    @Test
    @DisplayName("Non-positive tolerance is rejected")
    void invalidTolerance() {
      assertThrows(IllegalArgumentException.class, () -> new PageRank(0.85, 100, 0.0));
      assertThrows(IllegalArgumentException.class, () -> new PageRank(0.85, 100, -1.0));
    }
  }

  @Nested
  @DisplayName("Edge cases")
  class EdgeCases {

    @Test
    @DisplayName("Empty graph returns empty result, zero iterations")
    void emptyGraph() {
      PageRank.Result<String> r = new PageRank().compute(g());
      assertTrue(r.scores().isEmpty());
      assertEquals(0, r.iterations());
      assertTrue(r.converged());
    }

    @Test
    @DisplayName("Single node with no edges → score 1.0")
    void singleNode() {
      Map<String, Map<String, Double>> g = g();
      g.put("A", new HashMap<>());
      PageRank.Result<String> r = new PageRank().compute(g);
      assertEquals(1.0, r.scores().get("A"), 1e-9);
    }

    @Test
    @DisplayName("Two disconnected nodes get equal score 0.5")
    void twoDisconnected() {
      Map<String, Map<String, Double>> g = g();
      g.put("A", new HashMap<>());
      g.put("B", new HashMap<>());
      PageRank.Result<String> r = new PageRank().compute(g);
      assertEquals(0.5, r.scores().get("A"), 1e-9);
      assertEquals(0.5, r.scores().get("B"), 1e-9);
    }

    @Test
    @DisplayName("Dangling target node still receives a score")
    void danglingTarget() {
      Map<String, Map<String, Double>> g = g();
      edge(g, "A", "B", 1.0);
      PageRank.Result<String> r = new PageRank().compute(g);
      assertTrue(r.scores().containsKey("A"));
      assertTrue(r.scores().containsKey("B"));
      assertTrue(r.scores().get("B") > 0);
      assertTrue(
          r.scores().get("B") > r.scores().get("A"),
          "B has incoming edge from A so should score higher than A");
    }

    @Test
    @DisplayName("Self-loop on a single node → still normalized")
    void selfLoop() {
      Map<String, Map<String, Double>> g = g();
      edge(g, "A", "A", 1.0);
      PageRank.Result<String> r = new PageRank().compute(g);
      assertEquals(1.0, r.scores().get("A"), 1e-9);
    }

    @Test
    @DisplayName("Edge with zero weight contributes nothing")
    void zeroWeightEdgeIgnored() {
      Map<String, Map<String, Double>> g = g();
      edge(g, "A", "B", 0.0);
      // A is effectively dangling; A and B should split mass via dangling redistribution.
      PageRank.Result<String> r = new PageRank().compute(g);
      assertEquals(0.5, r.scores().get("A"), 1e-3);
      assertEquals(0.5, r.scores().get("B"), 1e-3);
    }
  }

  @Nested
  @DisplayName("Output normalization")
  class Normalization {

    @Test
    @DisplayName("Scores sum to 1.0 across the graph")
    void scoresSumToOne() {
      Map<String, Map<String, Double>> g = g();
      edge(g, "A", "B", 1.0);
      edge(g, "B", "C", 1.0);
      edge(g, "C", "A", 1.0);
      edge(g, "C", "B", 1.0);
      PageRank.Result<String> r = new PageRank().compute(g);
      double total = 0;
      for (double v : r.scores().values()) total += v;
      assertEquals(1.0, total, 1e-6);
    }

    @Test
    @DisplayName("Symmetric graph produces equal scores")
    void symmetricGraph() {
      Map<String, Map<String, Double>> g = g();
      edge(g, "A", "B", 1.0);
      edge(g, "B", "A", 1.0);
      PageRank.Result<String> r = new PageRank().compute(g);
      assertEquals(r.scores().get("A"), r.scores().get("B"), 1e-6);
    }
  }

  @Nested
  @DisplayName("Ranking properties")
  class RankingProperties {

    @Test
    @DisplayName("Hub node (many incoming edges) ranks highest")
    void hubRanksHighest() {
      Map<String, Map<String, Double>> g = g();
      // A, B, C, D all point at HUB. HUB has no outgoing edges.
      edge(g, "A", "HUB", 1.0);
      edge(g, "B", "HUB", 1.0);
      edge(g, "C", "HUB", 1.0);
      edge(g, "D", "HUB", 1.0);
      PageRank.Result<String> r = new PageRank().compute(g);
      double hub = r.scores().get("HUB");
      for (String n : new String[] {"A", "B", "C", "D"}) {
        assertTrue(hub > r.scores().get(n), "HUB > " + n + ": " + r.scores());
      }
    }

    @Test
    @DisplayName("Edge weight matters: heavy-weighted target outranks lightly-weighted target")
    void edgeWeightMatters() {
      Map<String, Map<String, Double>> g = g();
      // SOURCE → HEAVY (weight 10), SOURCE → LIGHT (weight 0.1)
      edge(g, "SOURCE", "HEAVY", 10.0);
      edge(g, "SOURCE", "LIGHT", 0.1);
      PageRank.Result<String> r = new PageRank().compute(g);
      assertTrue(
          r.scores().get("HEAVY") > r.scores().get("LIGHT"),
          "Heavy edge should outrank light edge: " + r.scores());
    }

    @Test
    @DisplayName("Star topology — center outranks every leaf")
    void starTopology() {
      Map<String, Map<String, Double>> g = g();
      for (int i = 0; i < 10; i++) {
        edge(g, "leaf-" + i, "center", 1.0);
      }
      PageRank.Result<String> r = new PageRank().compute(g);
      double center = r.scores().get("center");
      for (int i = 0; i < 10; i++) {
        assertTrue(center > r.scores().get("leaf-" + i));
      }
    }

    @Test
    @DisplayName("Two-component graph: each component ranks consistently within itself")
    void twoComponents() {
      Map<String, Map<String, Double>> g = g();
      // Component 1: A → B → C (chain)
      edge(g, "A", "B", 1.0);
      edge(g, "B", "C", 1.0);
      // Component 2: X → Y → X (cycle)
      edge(g, "X", "Y", 1.0);
      edge(g, "Y", "X", 1.0);
      PageRank.Result<String> r = new PageRank().compute(g);
      assertTrue(r.scores().get("X") > 0);
      assertTrue(r.scores().get("Y") > 0);
      assertTrue(r.scores().get("C") > 0, "Dangling end of chain still gets mass");
      // Within the cycle, X and Y should be equal
      assertEquals(r.scores().get("X"), r.scores().get("Y"), 1e-6);
    }
  }

  @Nested
  @DisplayName("Convergence")
  class Convergence {

    @Test
    @DisplayName("Small graphs converge in well under maxIterations")
    void convergesQuickly() {
      Map<String, Map<String, Double>> g = g();
      edge(g, "A", "B", 1.0);
      edge(g, "B", "A", 1.0);
      PageRank.Result<String> r = new PageRank().compute(g);
      assertTrue(r.converged());
      assertTrue(r.iterations() < 50, "Took too many iterations: " + r.iterations());
    }

    @Test
    @DisplayName("Tight tolerance still converges")
    void tightTolerance() {
      Map<String, Map<String, Double>> g = g();
      edge(g, "A", "B", 1.0);
      edge(g, "B", "C", 1.0);
      edge(g, "C", "A", 1.0);
      PageRank.Result<String> r = new PageRank(0.85, 1000, 1e-12).compute(g);
      assertTrue(r.converged());
    }

    @Test
    @DisplayName("maxIterations=1 returns without converging on a non-trivial graph")
    void maxIterationsHonored() {
      Map<String, Map<String, Double>> g = g();
      // Hub-and-spoke needs more than 1 iteration to settle.
      for (int i = 0; i < 10; i++) edge(g, "leaf-" + i, "center", 1.0);
      PageRank.Result<String> r = new PageRank(0.85, 1, 1e-12).compute(g);
      assertEquals(1, r.iterations());
    }
  }

  @Test
  @DisplayName("nodes() helper returns the union of sources and targets")
  void nodesHelper() {
    Map<String, Map<String, Double>> g = g();
    edge(g, "A", "B", 1.0);
    edge(g, "B", "C", 1.0);
    assertEquals(java.util.Set.of("A", "B", "C"), PageRank.nodes(g));
  }
}
