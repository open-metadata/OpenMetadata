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
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.security.Authorizer;
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

  /** Typed neighborhood payload serialized by the MCP transport. */
  public record Neighborhood(
      String entityUri, int depth, int limit, String triples, List<Edge> edges) {
    public Neighborhood {
      triples = Objects.requireNonNullElse(triples, "");
      edges = List.copyOf(edges);
    }
  }

  @Override
  public Neighborhood execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    McpToolParameters parameters = McpToolParameters.from(params);
    McpEntityReference entity = McpEntityReference.required(parameters);
    int depth = clamp(parameters.integer("depth", DEFAULT_DEPTH), MIN_DEPTH, MAX_DEPTH);
    int limit = clamp(parameters.integer("limit", DEFAULT_LIMIT), MIN_LIMIT, MAX_LIMIT);
    RdfRepository repository = repository();

    return queryNeighborhood(repository, entity.uri(repository.getBaseUri()), depth, limit);
  }

  private static Neighborhood queryNeighborhood(
      RdfRepository repository, String entityUri, int depth, int limit) {
    try {
      String triples =
          repository.executeSparqlQuery(
              buildConstructQuery(entityUri, depth, limit), "text/turtle");
      return new Neighborhood(
          entityUri, depth, limit, triples, fetchEdges(repository, entityUri, limit));
    } catch (RuntimeException exception) {
      throw new IllegalStateException("Neighborhood query failed for " + entityUri, exception);
    }
  }

  /**
   * Returns the direct adjacency as a convenient summary. The CONSTRUCT payload remains the
   * authoritative multi-hop graph, so a SELECT failure does not discard it.
   */
  private static List<Edge> fetchEdges(RdfRepository repository, String entityUri, int limit) {
    try {
      String selectJson =
          repository.executeSparqlQuery(
              buildSelectQuery(entityUri, limit), "application/sparql-results+json");
      return parseEdges(selectJson);
    } catch (RuntimeException exception) {
      LOG.warn("Unable to build the direct-edge summary for {}", entityUri, exception);
      return List.of();
    }
  }

  /**
   * Emits each traversed triple with its actual subject. Separate UNION arms avoid collapsing
   * second- and third-hop edges onto the starting entity.
   */
  static String buildConstructQuery(String entityUri, int depth, int limit) {
    String entity = "<" + entityUri + ">";
    List<String> patterns =
        new ArrayList<>(
            List.of(
                "    { BIND(%1$s AS ?s) %1$s ?p ?o }".formatted(entity),
                "    UNION { BIND(%1$s AS ?o) ?s ?p %1$s }".formatted(entity)));

    if (depth >= 2) {
      patterns.add("    UNION { BIND(%1$s AS ?s) %1$s ?p ?o . ?o ?p2 ?n2 }".formatted(entity));
      patterns.add("    UNION { %s ?p1 ?s . ?s ?p ?o }".formatted(entity));
    }
    if (depth >= 3) {
      patterns.add(
          "    UNION { BIND(%1$s AS ?s) %1$s ?p ?o . ?o ?p2 ?n2 . ?n2 ?p3 ?n3 }".formatted(entity));
      patterns.add("    UNION { %s ?p1 ?s . ?s ?p ?o . ?o ?p3 ?n3 }".formatted(entity));
      patterns.add("    UNION { %s ?p1 ?n1 . ?n1 ?p2 ?s . ?s ?p ?o }".formatted(entity));
    }

    return "CONSTRUCT { ?s ?p ?o } WHERE {\n" + String.join("\n", patterns) + "\n} LIMIT " + limit;
  }

  static String buildSelectQuery(String entityUri, int limit) {
    return """
        SELECT ?direction ?predicate ?neighbor ?neighborLabel WHERE {
          { BIND('outgoing' AS ?direction) <%1$s> ?predicate ?neighbor }
          UNION { BIND('incoming' AS ?direction) ?neighbor ?predicate <%1$s> }
          OPTIONAL {
            ?neighbor <http://www.w3.org/2000/01/rdf-schema#label> ?neighborLabel
          }
        } LIMIT %2$d
        """
        .formatted(entityUri, limit)
        .stripTrailing();
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
