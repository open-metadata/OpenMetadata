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

package org.openmetadata.mcp.tools;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.type.TypeReference;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.util.ResponseBudget;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

/** Returns the bounded n-hop RDF neighborhood of an entity. */
@Slf4j
public class EntityNeighborhoodTool extends RdfMcpTool<EntityNeighborhoodTool.Neighborhood> {

  private static final int MIN_DEPTH = 1;
  private static final int MAX_DEPTH = 3;
  private static final int DEFAULT_DEPTH = 2;
  private static final int MIN_LIMIT = 1;
  private static final int MAX_LIMIT = 2000;
  private static final int DEFAULT_LIMIT = 200;
  private static final String KNOWLEDGE_GRAPH = "https://open-metadata.org/graph/knowledge";
  private static final String INFERRED_GRAPH_PATH = "graph/inferred/";
  private static final TypeReference<SparqlResultSet<EdgeBinding>> EDGE_RESULTS =
      new TypeReference<>() {};

  public EntityNeighborhoodTool() {
    super();
  }

  EntityNeighborhoodTool(Supplier<RdfRepository> repositorySupplier) {
    super(repositorySupplier);
  }

  /** A single directed edge to a neighbor; {@code neighborLabel} is omitted when absent. */
  @JsonInclude(JsonInclude.Include.NON_NULL)
  public record Edge(String direction, String predicate, String neighbor, String neighborLabel) {}

  /**
   * Typed neighborhood payload serialized by the MCP transport. {@code truncated} / {@code
   * byteCount} describe {@code triples}: a depth-3 hub entity can serialize past the dispatch cap,
   * which would otherwise replace the whole response with a data-less stub.
   */
  public record Neighborhood(
      String entityUri,
      int depth,
      int limit,
      String triples,
      List<Edge> edges,
      boolean truncated,
      int byteCount) {
    public Neighborhood {
      triples = Objects.requireNonNullElse(triples, "");
      edges = List.copyOf(edges);
    }
  }

  @Override
  protected Neighborhood executeAuthorized(
      final CatalogSecurityContext securityContext, final Map<String, Object> params)
      throws IOException {
    McpToolParameters parameters = McpToolParameters.from(params);
    McpEntityReference entity = McpEntityReference.required(parameters);
    int depth = clamp(parameters.integer("depth", DEFAULT_DEPTH), MIN_DEPTH, MAX_DEPTH);
    int limit = clamp(parameters.integer("limit", DEFAULT_LIMIT), MIN_LIMIT, MAX_LIMIT);
    RdfRepository repository = repository();

    return queryNeighborhood(
        securityContext, repository, entity.uri(repository.getBaseUri()), depth, limit);
  }

  private Neighborhood queryNeighborhood(
      CatalogSecurityContext securityContext,
      RdfRepository repository,
      String entityUri,
      int depth,
      int limit) {
    // guardedRead sits outside the wrapping below: a capacity or timeout rejection carries its own
    // 429/503 classification and must not be flattened into a generic "query failed".
    String triples =
        guardedRead(securityContext, () -> runConstruct(repository, entityUri, depth, limit));
    RdfBody.Bounded bounded = RdfBody.bound(triples, RdfBody.MAX_BYTES);
    List<Edge> edges = fetchEdges(repository, entityUri, limit);
    return new Neighborhood(
        entityUri,
        depth,
        limit,
        bounded.value(),
        fitEdges(edges, bounded.value().length()),
        bounded.truncated(),
        bounded.byteCount());
  }

  private static String runConstruct(
      RdfRepository repository, String entityUri, int depth, int limit) {
    try {
      return repository.executeSparqlQuery(
          buildConstructQuery(entityUri, repository.getBaseUri(), depth, limit), "text/turtle");
    } catch (RuntimeException exception) {
      throw new IllegalStateException("Neighborhood query failed for " + entityUri, exception);
    }
  }

  /**
   * Trims the edge summary to whatever budget the Turtle payload left behind. The triples are the
   * authoritative answer, so when both cannot fit the summary is what gives way.
   */
  private static List<Edge> fitEdges(List<Edge> edges, int triplesChars) {
    long remaining = ResponseBudget.defaultBudgetChars() - triplesChars;
    return remaining <= 0
        ? List.of()
        : edges.subList(0, ResponseBudget.fitWithin(edges, remaining).count());
  }

  /**
   * Returns the direct adjacency as a convenient summary. The CONSTRUCT payload remains the
   * authoritative multi-hop graph, so a SELECT failure does not discard it.
   */
  private static List<Edge> fetchEdges(RdfRepository repository, String entityUri, int limit) {
    try {
      String selectJson =
          repository.executeSparqlQuery(
              buildSelectQuery(entityUri, repository.getBaseUri(), limit),
              "application/sparql-results+json");
      return parseEdges(selectJson);
    } catch (RuntimeException exception) {
      LOG.warn("Unable to build the direct-edge summary for {}", entityUri, exception);
      return List.of();
    }
  }

  /**
   * Emits every edge traversed by every outgoing/incoming path through the requested depth, giving
   * each traversal branch its own share of {@code limit}.
   *
   * <p>One {@code LIMIT} over the whole UNION applied to an unordered solution set, so on a
   * high-degree start node the 1-hop branches could consume the entire budget and leave nothing for
   * the deeper ones - {@code depth} had no observable effect while still appearing to succeed. The
   * share is rounded up so a small {@code limit} still yields a row per branch.
   */
  static String buildConstructQuery(String entityUri, String baseUri, int depth, int limit) {
    String entity = "<" + entityUri + ">";
    int boundedDepth = clamp(depth, MIN_DEPTH, MAX_DEPTH);
    String construct = constructTemplate(boundedDepth);
    List<String> patterns = traversalPatterns(entity, normalizedBaseUri(baseUri), boundedDepth);
    int perBranch = Math.max(1, (int) Math.ceil((double) limit / patterns.size()));
    String paths =
        patterns.stream()
            .map(pattern -> "{ SELECT * WHERE { " + pattern + " } LIMIT " + perBranch + " }")
            .collect(Collectors.joining("\n    UNION "));
    return "CONSTRUCT {\n" + construct + "\n} WHERE {\n    " + paths + "\n}";
  }

  private static String constructTemplate(int depth) {
    List<String> triples = new ArrayList<>();
    for (int step = 1; step <= depth; step++) {
      triples.add("  ?s%1$d ?p%1$d ?o%1$d .".formatted(step));
    }
    return String.join("\n", triples);
  }

  private static List<String> traversalPatterns(String entity, String baseUri, int depth) {
    List<String> patterns = new ArrayList<>();
    for (int pathLength = 1; pathLength <= depth; pathLength++) {
      int directionCombinations = 1 << pathLength;
      for (int directions = 0; directions < directionCombinations; directions++) {
        patterns.add(pathPattern(entity, baseUri, pathLength, directions));
      }
    }
    return patterns;
  }

  private static String pathPattern(String entity, String baseUri, int pathLength, int directions) {
    StringBuilder pattern = new StringBuilder();
    String currentNode = entity;
    for (int step = 1; step <= pathLength; step++) {
      boolean incoming = (directions & (1 << (step - 1))) != 0;
      currentNode = appendTraversalStep(pattern, currentNode, baseUri, step, incoming);
    }
    return pattern.toString();
  }

  private static String appendTraversalStep(
      StringBuilder pattern, String currentNode, String baseUri, int step, boolean incoming) {
    String subject = "?s" + step;
    String predicate = "?p" + step;
    String object = "?o" + step;
    String graph = "?g" + step;
    String boundEndpoint = incoming ? object : subject;
    if (!pattern.isEmpty()) {
      pattern.append(' ');
    }
    pattern
        .append("BIND(")
        .append(currentNode)
        .append(" AS ")
        .append(boundEndpoint)
        .append(") . GRAPH ")
        .append(graph)
        .append(" { ")
        .append(subject)
        .append(' ')
        .append(predicate)
        .append(' ')
        .append(object)
        .append(" . } ")
        .append(instanceGraphFilter(graph, baseUri));
    return incoming ? subject : object;
  }

  static String buildSelectQuery(String entityUri, String baseUri, int limit) {
    String normalizedBaseUri = normalizedBaseUri(baseUri);
    return """
        SELECT ?direction ?predicate ?neighbor ?neighborLabel WHERE {
          { BIND('outgoing' AS ?direction)
            GRAPH ?edgeGraph { <%1$s> ?predicate ?neighbor }
            %2$s }
          UNION { BIND('incoming' AS ?direction)
            GRAPH ?edgeGraph { ?neighbor ?predicate <%1$s> }
            %2$s }
          OPTIONAL {
            GRAPH ?labelGraph {
              ?neighbor <http://www.w3.org/2000/01/rdf-schema#label> ?neighborLabel
            }
            %3$s
          }
        } LIMIT %4$d
        """
        .formatted(
            entityUri,
            instanceGraphFilter("?edgeGraph", normalizedBaseUri),
            instanceGraphFilter("?labelGraph", normalizedBaseUri),
            limit)
        .stripTrailing();
  }

  private static String instanceGraphFilter(String graphVariable, String baseUri) {
    return "FILTER(%1$s = <%2$s> || STRSTARTS(STR(%1$s), STR(<%3$s%4$s>)))"
        .formatted(graphVariable, KNOWLEDGE_GRAPH, baseUri, INFERRED_GRAPH_PATH);
  }

  private static String normalizedBaseUri(String baseUri) {
    return baseUri.endsWith("/") ? baseUri : baseUri + "/";
  }

  static List<Edge> parseEdges(String selectJson) {
    return SparqlResultSet.rows(selectJson, EDGE_RESULTS).stream()
        .filter(EdgeBinding::hasNeighbor)
        .map(EdgeBinding::toEdge)
        .toList();
  }

  private static int clamp(int value, int minimum, int maximum) {
    return Math.min(Math.max(value, minimum), maximum);
  }

  private record EdgeBinding(
      SparqlResultSet.Value direction,
      SparqlResultSet.Value predicate,
      SparqlResultSet.Value neighbor,
      SparqlResultSet.Value neighborLabel) {

    private boolean hasNeighbor() {
      return neighbor != null && !McpToolParameters.isBlank(neighbor.value());
    }

    private Edge toEdge() {
      return new Edge(value(direction), value(predicate), value(neighbor), value(neighborLabel));
    }

    private static String value(SparqlResultSet.Value binding) {
      return binding == null ? null : binding.value();
    }
  }
}
