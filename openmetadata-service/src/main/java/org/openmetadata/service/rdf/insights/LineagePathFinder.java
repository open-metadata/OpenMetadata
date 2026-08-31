package org.openmetadata.service.rdf.insights;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.RdfRepository;

/**
 * BFS path finder over the lineage graph. Walks one frontier at a time using SPARQL queries built
 * by {@link LineagePathBuilder}, so the algorithm is independent of dataset size — only the active
 * frontier is held in memory.
 *
 * <p>Termination conditions:
 *
 * <ul>
 *   <li>Target reached → reconstruct path via parent map; return {@code found = true}.
 *   <li>Frontier becomes empty → return {@code found = false}.
 *   <li>maxHops reached → return {@code found = false}.
 * </ul>
 *
 * <p>The {@code visited} set guards against cycles. Each node is expanded at most once. The found
 * path is always the shortest one (BFS), with ties broken by SPARQL result order.
 */
@Slf4j
public final class LineagePathFinder {

  private final RdfRepository repository;

  public LineagePathFinder(RdfRepository repository) {
    this.repository = repository;
  }

  /**
   * Walk the lineage graph from {@code fromUri} to {@code toUri}.
   *
   * @param fromUri starting node URI (validated)
   * @param toUri target node URI (validated)
   * @param direction upstream / downstream / both
   * @param maxHops upper bound on path length; clamped via {@link LineagePathBuilder#clampMaxHops}
   */
  public Path findPath(
      String fromUri, String toUri, LineagePathBuilder.Direction direction, Integer maxHops) {
    String from = LineagePathBuilder.validateNodeUri("from", fromUri);
    String to = LineagePathBuilder.validateNodeUri("to", toUri);
    LineagePathBuilder.Direction dir =
        direction == null ? LineagePathBuilder.Direction.UPSTREAM : direction;
    int hopBudget = LineagePathBuilder.clampMaxHops(maxHops);

    if (from.equals(to)) {
      return Path.found(from, to, dir, hopBudget, List.of(new Hop(0, from, null, List.of())));
    }

    Map<String, ParentEdge> parents = new HashMap<>();
    Set<String> visited = new LinkedHashSet<>();
    visited.add(from);
    Set<String> frontier = new LinkedHashSet<>();
    frontier.add(from);

    int depth = 0;
    String reached = null;
    while (!frontier.isEmpty() && depth < hopBudget) {
      Map<String, ParentEdge> nextLevel = expandFrontier(frontier, dir, visited);
      if (nextLevel.isEmpty()) break;
      depth++;

      for (Map.Entry<String, ParentEdge> e : nextLevel.entrySet()) {
        String node = e.getKey();
        if (parents.putIfAbsent(node, e.getValue()) == null) {
          visited.add(node);
        }
        if (node.equals(to)) {
          reached = node;
          break;
        }
      }
      if (reached != null) break;
      frontier = new LinkedHashSet<>(nextLevel.keySet());
    }

    if (reached == null) {
      return Path.notFound(from, to, dir, hopBudget);
    }
    List<Hop> hops = reconstructPath(from, to, parents);
    decorateWithTypes(hops);
    return Path.found(from, to, dir, hopBudget, hops);
  }

  /**
   * Run one frontier query and return a map of (newly discovered node → ParentEdge). Already
   * visited nodes are filtered out so the BFS stays acyclic.
   */
  Map<String, ParentEdge> expandFrontier(
      Set<String> frontier, LineagePathBuilder.Direction direction, Set<String> visited) {
    String sparql = LineagePathBuilder.frontierQuery(frontier, direction);
    String json;
    try {
      json = repository.executeSparqlQuery(sparql, "application/sparql-results+json");
    } catch (Exception e) {
      LOG.warn("Path finder frontier query failed: {}", e.getMessage());
      return Map.of();
    }
    return parseFrontierResult(json, visited);
  }

  static Map<String, ParentEdge> parseFrontierResult(String json, Set<String> visited) {
    Map<String, ParentEdge> next = new LinkedHashMap<>();
    if (json == null || json.isBlank()) return next;
    try {
      JsonNode root = JsonUtils.readTree(json);
      JsonNode bindings = root.path("results").path("bindings");
      if (!bindings.isArray()) return next;
      for (JsonNode row : bindings) {
        String from = textValue(row, "from");
        String to = textValue(row, "to");
        String predicate = textValue(row, "predicate");
        if (from == null || to == null || predicate == null) continue;
        if (visited.contains(to)) continue;
        next.putIfAbsent(to, new ParentEdge(from, predicate));
      }
    } catch (Exception e) {
      LOG.warn("Failed to parse path frontier result: {}", e.getMessage());
    }
    return next;
  }

  private List<Hop> reconstructPath(String from, String to, Map<String, ParentEdge> parents) {
    Deque<Hop> stack = new ArrayDeque<>();
    String cursor = to;
    int safety = parents.size() + 2;
    while (cursor != null && !cursor.equals(from) && safety-- > 0) {
      ParentEdge edge = parents.get(cursor);
      if (edge == null) break;
      stack.push(new Hop(0, cursor, edge.predicate(), List.of()));
      cursor = edge.parent();
    }
    stack.push(new Hop(0, from, null, List.of()));

    List<Hop> ordered = new ArrayList<>(stack.size());
    int step = 0;
    while (!stack.isEmpty()) {
      Hop h = stack.pop();
      ordered.add(new Hop(step++, h.node(), h.predicate(), h.rdfTypes()));
    }
    return ordered;
  }

  /** Single SPARQL round-trip to fetch {@code rdf:type} for every node in the path. */
  void decorateWithTypes(List<Hop> hops) {
    if (hops.isEmpty()) return;
    Set<String> nodes = new LinkedHashSet<>();
    for (Hop h : hops) nodes.add(h.node());
    String sparql = LineagePathBuilder.typesQuery(nodes);
    String json;
    try {
      json = repository.executeSparqlQuery(sparql, "application/sparql-results+json");
    } catch (Exception e) {
      LOG.debug("Type decoration failed (non-fatal): {}", e.getMessage());
      return;
    }
    Map<String, List<String>> types = parseTypesResult(json);
    for (int i = 0; i < hops.size(); i++) {
      Hop h = hops.get(i);
      List<String> t = types.getOrDefault(h.node(), List.of());
      hops.set(i, new Hop(h.step(), h.node(), h.predicate(), t));
    }
  }

  static Map<String, List<String>> parseTypesResult(String json) {
    Map<String, List<String>> result = new HashMap<>();
    if (json == null || json.isBlank()) return result;
    try {
      JsonNode root = JsonUtils.readTree(json);
      JsonNode bindings = root.path("results").path("bindings");
      if (!bindings.isArray()) return result;
      for (JsonNode row : bindings) {
        String node = textValue(row, "node");
        String type = textValue(row, "type");
        if (node == null || type == null) continue;
        result.computeIfAbsent(node, k -> new ArrayList<>()).add(type);
      }
      for (Map.Entry<String, List<String>> e : result.entrySet()) {
        Set<String> uniq = new LinkedHashSet<>(e.getValue());
        e.setValue(List.copyOf(uniq));
      }
    } catch (Exception e) {
      LOG.debug("Failed to parse type decoration result: {}", e.getMessage());
    }
    return Collections.unmodifiableMap(result);
  }

  private static String textValue(JsonNode row, String varName) {
    JsonNode node = row.path(varName);
    if (node.isMissingNode() || node.isNull()) return null;
    JsonNode value = node.path("value");
    return value.isMissingNode() || value.isNull() ? null : value.asText();
  }

  /** Edge that points back to a node's BFS parent. */
  record ParentEdge(String parent, String predicate) {}

  /** One hop in a returned path. */
  public record Hop(int step, String node, String predicate, List<String> rdfTypes) {}

  /**
   * BFS path response. {@code hops} is {@code nodes.size() - 1} when found, else {@code 0}.
   */
  public record Path(
      String from,
      String to,
      String direction,
      int maxHops,
      boolean found,
      int hops,
      List<Hop> nodes) {

    static Path notFound(String from, String to, LineagePathBuilder.Direction dir, int maxHops) {
      return new Path(from, to, dir.name().toLowerCase(), maxHops, false, 0, List.of());
    }

    static Path found(
        String from, String to, LineagePathBuilder.Direction dir, int maxHops, List<Hop> nodes) {
      return new Path(
          from, to, dir.name().toLowerCase(), maxHops, true, Math.max(0, nodes.size() - 1), nodes);
    }
  }

  /** Helper to build a Hop list for unit tests. */
  static List<Hop> hopList(String... nodes) {
    List<Hop> out = new ArrayList<>();
    for (int i = 0; i < nodes.length; i++) {
      out.add(new Hop(i, nodes[i], i == 0 ? null : "prov:wasDerivedFrom", List.of()));
    }
    return out;
  }

  /** No-op visited-set placeholder used in tests. */
  static Set<String> emptyVisited() {
    return new HashSet<>();
  }
}
