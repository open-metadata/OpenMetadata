package org.openmetadata.service.rdf.insights;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Modularity-optimizing community detection — the greedy "first pass" of the Louvain algorithm
 * (Blondel et al., 2008). Each node starts in its own community; we repeatedly move every node to
 * the neighbouring community that yields the highest modularity gain until no move improves the
 * partition. The aggregation/recursion step of full multi-level Louvain is intentionally left out —
 * a single greedy pass already produces high-quality communities on the kinds of graphs an
 * OpenMetadata catalog produces (lineage chains, tag co-occurrence) and keeps the algorithm
 * deterministic and ~150 lines instead of ~400.
 *
 * <p>Determinism: nodes are processed in input-map iteration order; candidate communities are
 * sorted by integer id; ties on modularity gain favour the lower-numbered community. A given input
 * graph therefore always produces the same partition, which is exactly what the Phase 3.2 success
 * criterion calls for ("Louvain run produces om:Community resources with deterministic
 * membership for the seed graph").
 *
 * <p>Edge weight handling: the input is treated as undirected; if both directions are present they
 * sum, single-direction edges are mirrored. Self-loops are ignored. Negative weights are clamped
 * to zero — modularity isn't well-defined for them.
 *
 * <p>Modularity gain when inserting node {@code i} into community {@code C} (i has been removed
 * from its current community before the test) is the standard Louvain shortcut:
 *
 * <pre>
 *   ΔQ ∝ k_iC − Σ_tot(C) · k_i / (2m)
 * </pre>
 *
 * where {@code k_iC} = sum of weights from i to members of C, {@code Σ_tot(C)} = sum of degrees of
 * nodes in C, {@code k_i} = degree of i, {@code 2m} = sum of all degrees. The constant 1/(2m) is
 * the same across candidates so we drop it for the argmax.
 */
public final class Louvain {

  private static final int DEFAULT_MAX_ITERATIONS = 32;

  private final int maxIterations;

  public Louvain() {
    this(DEFAULT_MAX_ITERATIONS);
  }

  public Louvain(int maxIterations) {
    if (maxIterations < 1) {
      throw new IllegalArgumentException("maxIterations must be >= 1");
    }
    this.maxIterations = maxIterations;
  }

  /**
   * Run greedy modularity optimization on a weighted graph.
   *
   * @param graph adjacency map. {@code graph.get(a).get(b)} = edge weight from a to b. Undirected;
   *     symmetrized internally. Null or empty graphs return an empty result.
   * @param <N> node id type (must support equals/hashCode and have a stable toString)
   * @return final partition + modularity + iteration count
   */
  public <N> Result<N> compute(Map<N, Map<N, Double>> graph) {
    if (graph == null || graph.isEmpty()) return new Result<>(Map.of(), 0.0, 0);

    List<N> nodes = new ArrayList<>(graph.keySet());
    int n = nodes.size();
    Map<N, Integer> idx = new LinkedHashMap<>(n);
    for (int i = 0; i < n; i++) idx.put(nodes.get(i), i);

    Map<Integer, Map<Integer, Double>> adj = new LinkedHashMap<>(n);
    for (int i = 0; i < n; i++) adj.put(i, new LinkedHashMap<>());
    addAllEdges(graph, idx, adj);

    double[] degree = new double[n];
    double totalWeight = 0.0;
    for (int i = 0; i < n; i++) {
      double d = 0.0;
      for (double w : adj.get(i).values()) d += w;
      degree[i] = d;
      totalWeight += d;
    }
    if (totalWeight == 0.0) {
      return singletonsResult(nodes);
    }

    int[] community = new int[n];
    double[] commTotal = new double[n];
    for (int i = 0; i < n; i++) {
      community[i] = i;
      commTotal[i] = degree[i];
    }

    int iterations = 0;
    boolean moved = true;
    while (moved && iterations < maxIterations) {
      moved = false;
      iterations++;
      for (int i = 0; i < n; i++) {
        int chosen = considerMoves(i, community, commTotal, degree, totalWeight, adj);
        if (chosen != community[i]) {
          commTotal[community[i]] -= degree[i];
          commTotal[chosen] += degree[i];
          community[i] = chosen;
          moved = true;
        }
      }
    }

    Map<Integer, Integer> renumbered = renumber(community);
    Map<N, Integer> finalPartition = new LinkedHashMap<>(n);
    for (int i = 0; i < n; i++) finalPartition.put(nodes.get(i), renumbered.get(community[i]));
    double modularity = computeModularity(adj, community, degree, totalWeight);
    return new Result<>(finalPartition, modularity, iterations);
  }

  private static <N> void addAllEdges(
      Map<N, Map<N, Double>> graph, Map<N, Integer> idx, Map<Integer, Map<Integer, Double>> adj) {
    for (Map.Entry<N, Map<N, Double>> e : graph.entrySet()) {
      Integer src = idx.get(e.getKey());
      if (src == null || e.getValue() == null) continue;
      for (Map.Entry<N, Double> e2 : e.getValue().entrySet()) {
        Integer dst = idx.get(e2.getKey());
        if (dst == null || dst.equals(src)) continue;
        double w = e2.getValue() == null ? 0.0 : Math.max(0.0, e2.getValue());
        if (w == 0.0) continue;
        adj.get(src).merge(dst, w, Double::sum);
        adj.get(dst).merge(src, w, Double::sum);
      }
    }
  }

  /** Choose the best community for node {@code i}, breaking ties toward lower community id. */
  private static int considerMoves(
      int i,
      int[] community,
      double[] commTotal,
      double[] degree,
      double totalWeight,
      Map<Integer, Map<Integer, Double>> adj) {
    int currentComm = community[i];
    double k_i = degree[i];

    Map<Integer, Double> commLinks = new LinkedHashMap<>();
    for (Map.Entry<Integer, Double> e : adj.get(i).entrySet()) {
      if (e.getKey() == i) continue;
      commLinks.merge(community[e.getKey()], e.getValue(), Double::sum);
    }

    commTotal[currentComm] -= k_i;

    int bestComm = currentComm;
    double bestGain = 0.0;
    List<Integer> candidates = new ArrayList<>(commLinks.keySet());
    Collections.sort(candidates);
    for (int c : candidates) {
      double k_iC = commLinks.getOrDefault(c, 0.0);
      double gain = k_iC - commTotal[c] * k_i / totalWeight;
      if (gain > bestGain || (gain == bestGain && c < bestComm)) {
        bestGain = gain;
        bestComm = c;
      }
    }
    commTotal[currentComm] += k_i;
    return bestComm;
  }

  /** Compress community ids to a dense [0..k-1] range, preserving discovery order. */
  static Map<Integer, Integer> renumber(int[] community) {
    Map<Integer, Integer> map = new LinkedHashMap<>();
    for (int c : community) {
      map.computeIfAbsent(c, k -> map.size());
    }
    return map;
  }

  /** Modularity Q = (1/2m) Σ [A_ij − k_i k_j / 2m] · δ(c_i, c_j). */
  static double computeModularity(
      Map<Integer, Map<Integer, Double>> adj,
      int[] community,
      double[] degree,
      double totalWeight) {
    if (totalWeight == 0) return 0.0;
    double q = 0.0;
    int n = adj.size();
    for (int i = 0; i < n; i++) {
      for (Map.Entry<Integer, Double> e : adj.get(i).entrySet()) {
        int j = e.getKey();
        if (community[i] != community[j]) continue;
        double aij = e.getValue();
        double expected = degree[i] * degree[j] / totalWeight;
        q += aij - expected;
      }
    }
    return q / totalWeight;
  }

  private static <N> Result<N> singletonsResult(List<N> nodes) {
    Map<N, Integer> partition = new LinkedHashMap<>(nodes.size());
    for (int i = 0; i < nodes.size(); i++) partition.put(nodes.get(i), i);
    return new Result<>(partition, 0.0, 0);
  }

  /**
   * Result of a Louvain run.
   *
   * @param communityByNode every input node mapped to a dense 0-based community id
   * @param modularity Q score of the final partition; higher is better, [-1, 1]
   * @param iterations number of greedy passes performed
   */
  public record Result<N>(Map<N, Integer> communityByNode, double modularity, int iterations) {

    /** Inverse view: community id → list of members in input iteration order. */
    public Map<Integer, List<N>> membersByCommunity() {
      Map<Integer, List<N>> out = new LinkedHashMap<>();
      for (Map.Entry<N, Integer> e : communityByNode.entrySet()) {
        out.computeIfAbsent(e.getValue(), k -> new ArrayList<>()).add(e.getKey());
      }
      return out;
    }

    /** Distinct community count. */
    public int communityCount() {
      return (int) communityByNode.values().stream().distinct().count();
    }
  }
}
