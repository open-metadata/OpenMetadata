package org.openmetadata.service.rdf.insights;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Iterative weighted PageRank with proper handling of dangling nodes and
 * disconnected components. The output is a normalized importance score in
 * {@code [0,1]} that sums to 1.0 across all nodes in the graph.
 *
 * <p>This is intentionally a tiny, dependency-free implementation. JGraphT or Spark GraphFrames
 * would be appropriate for million-edge graphs; OpenMetadata's metadata graph for a single
 * tenant typically has &lt; 50k nodes and the simpler approach keeps the codebase lean.
 *
 * <p>Algorithm (classic Brin/Page formulation, weighted edges):
 *
 * <pre>{@code
 * for each iteration:
 *   for each node v:
 *     newScore[v] = (1 - d) / N
 *                 + d * sum over u in inEdges(v) of (score[u] * w(u,v) / outWeight(u))
 *                 + d * danglingMass / N    // redistribute mass from sinks
 * }</pre>
 *
 * <p>Stops when {@code max |newScore[v] - score[v]| < tolerance} or {@code maxIterations}
 * is reached. Output normalizes to sum 1.0.
 */
public final class PageRank {

  /** Standard damping factor. */
  public static final double DEFAULT_DAMPING = 0.85;

  public static final int DEFAULT_MAX_ITERATIONS = 100;
  public static final double DEFAULT_TOLERANCE = 1e-6;

  private final double damping;
  private final int maxIterations;
  private final double tolerance;

  public PageRank() {
    this(DEFAULT_DAMPING, DEFAULT_MAX_ITERATIONS, DEFAULT_TOLERANCE);
  }

  public PageRank(double damping, int maxIterations, double tolerance) {
    if (damping <= 0 || damping >= 1) {
      throw new IllegalArgumentException("damping must be in (0, 1)");
    }
    if (maxIterations <= 0) {
      throw new IllegalArgumentException("maxIterations must be positive");
    }
    if (tolerance <= 0) {
      throw new IllegalArgumentException("tolerance must be positive");
    }
    this.damping = damping;
    this.maxIterations = maxIterations;
    this.tolerance = tolerance;
  }

  /**
   * Compute weighted PageRank.
   *
   * @param outgoing for each node, the map of {@code targetNode → edgeWeight}. Source nodes
   *     with no outgoing edges (dangling sinks) are still included in the result; their mass is
   *     redistributed uniformly. Nodes that appear only as targets are treated as having no
   *     outgoing edges. Empty input returns an empty map.
   * @return map of {@code node → score}, scores in [0, 1] summing to 1.0 (modulo floating-point
   *     drift). Iteration count is reported via {@link Result#iterations()}.
   */
  public Result<String> compute(Map<String, Map<String, Double>> outgoing) {
    Objects.requireNonNull(outgoing, "outgoing");
    // Nodes = union of sources and all targets (so a dangling target still gets a score).
    Map<String, Map<String, Double>> graph = new HashMap<>();
    for (Map.Entry<String, Map<String, Double>> e : outgoing.entrySet()) {
      graph.computeIfAbsent(e.getKey(), k -> new HashMap<>());
      for (String t : e.getValue().keySet()) {
        graph.computeIfAbsent(t, k -> new HashMap<>());
      }
      graph.get(e.getKey()).putAll(e.getValue());
    }
    int n = graph.size();
    if (n == 0) {
      return new Result<>(Collections.emptyMap(), 0, true);
    }

    // Pre-compute outgoing weight totals once per source.
    Map<String, Double> outWeight = new HashMap<>();
    for (Map.Entry<String, Map<String, Double>> e : graph.entrySet()) {
      double sum = 0.0;
      for (Double w : e.getValue().values()) {
        if (w != null && w > 0) sum += w;
      }
      outWeight.put(e.getKey(), sum);
    }

    Map<String, Double> score = new HashMap<>(n);
    double init = 1.0 / n;
    for (String node : graph.keySet()) score.put(node, init);

    int iterations = 0;
    boolean converged = false;
    while (iterations < maxIterations) {
      iterations++;
      // Sum of mass from dangling nodes — to be redistributed uniformly.
      double dangling = 0.0;
      for (Map.Entry<String, Double> e : score.entrySet()) {
        if (outWeight.getOrDefault(e.getKey(), 0.0) <= 0) {
          dangling += e.getValue();
        }
      }
      Map<String, Double> next = new HashMap<>(n);
      double danglingShare = damping * dangling / n;
      double base = (1 - damping) / n + danglingShare;
      for (String node : graph.keySet()) next.put(node, base);

      for (Map.Entry<String, Map<String, Double>> e : graph.entrySet()) {
        String src = e.getKey();
        double srcOut = outWeight.getOrDefault(src, 0.0);
        if (srcOut <= 0) continue;
        double srcScore = score.get(src);
        for (Map.Entry<String, Double> edge : e.getValue().entrySet()) {
          double w = edge.getValue() == null ? 0 : edge.getValue();
          if (w <= 0) continue;
          double contribution = damping * srcScore * (w / srcOut);
          next.merge(edge.getKey(), contribution, Double::sum);
        }
      }

      double maxDelta = 0.0;
      for (Map.Entry<String, Double> e : next.entrySet()) {
        double d = Math.abs(e.getValue() - score.getOrDefault(e.getKey(), 0.0));
        if (d > maxDelta) maxDelta = d;
      }
      score = next;
      if (maxDelta < tolerance) {
        converged = true;
        break;
      }
    }

    // Normalize so scores sum to 1.0 (guards against floating-point drift).
    double total = 0.0;
    for (double v : score.values()) total += v;
    if (total > 0) {
      Map<String, Double> normalized = new HashMap<>(n);
      for (Map.Entry<String, Double> e : score.entrySet()) {
        normalized.put(e.getKey(), e.getValue() / total);
      }
      score = normalized;
    }
    return new Result<>(score, iterations, converged);
  }

  /** Visible-for-tests convenience: which nodes appear in the result. */
  public static Set<String> nodes(Map<String, Map<String, Double>> graph) {
    Set<String> all = new java.util.HashSet<>();
    for (Map.Entry<String, Map<String, Double>> e : graph.entrySet()) {
      all.add(e.getKey());
      all.addAll(e.getValue().keySet());
    }
    return all;
  }

  public record Result<N>(Map<N, Double> scores, int iterations, boolean converged) {}
}
