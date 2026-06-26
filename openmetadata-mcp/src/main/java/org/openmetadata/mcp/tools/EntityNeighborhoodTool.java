package org.openmetadata.mcp.tools;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

/**
 * Returns the n-hop neighborhood of an entity in the knowledge graph as triples.
 *
 * <p>Driven by a SPARQL CONSTRUCT with bounded property paths so depth is enforced even for
 * adversarial inputs. Depth is hard-capped at 3 (matches REST graph-explorer).
 */
@Slf4j
public class EntityNeighborhoodTool implements McpTool {

  private static final int MIN_DEPTH = 1;
  private static final int MAX_DEPTH = 3;
  private static final int DEFAULT_DEPTH = 2;
  private static final int MIN_LIMIT = 1;
  private static final int MAX_LIMIT = 2000;
  private static final int DEFAULT_LIMIT = 200;
  private static final String ENTITY_TYPE_PATTERN = "[A-Za-z][A-Za-z0-9]*";

  /** A single directed edge to a neighbor; {@code neighborLabel} is omitted when absent. */
  @JsonInclude(JsonInclude.Include.NON_NULL)
  public record Edge(String direction, String predicate, String neighbor, String neighborLabel) {}

  /** Typed neighborhood payload that is serialized back to the MCP client. */
  public record Neighborhood(
      String entityUri, int depth, int limit, String triples, List<Edge> edges) {}

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    String entityId = string(params, "entityId");
    String entityType = string(params, "entityType");
    int depth = clampDepth(intParam(params, "depth", DEFAULT_DEPTH));
    int limit = clampLimit(intParam(params, "limit", DEFAULT_LIMIT));

    Map<String, Object> result;
    String validationError = validateInputs(entityId, entityType);
    if (validationError != null) {
      result = error(validationError);
    } else {
      result = runNeighborhood(entityType, entityId, depth, limit);
    }
    return result;
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params) {
    throw new UnsupportedOperationException(
        "EntityNeighborhoodTool does not enforce write limits.");
  }

  private static String validateInputs(String entityId, String entityType) {
    String error = null;
    if (entityId == null || entityId.isBlank()) {
      error = "'entityId' parameter is required";
    } else if (entityType == null || entityType.isBlank()) {
      error = "'entityType' parameter is required";
    } else if (!isUuid(entityId)) {
      error = "'entityId' must be a UUID";
    } else if (!entityType.matches(ENTITY_TYPE_PATTERN)) {
      error = "'entityType' must be alphanumeric";
    }
    return error;
  }

  private static Map<String, Object> runNeighborhood(
      String entityType, String entityId, int depth, int limit) {
    RdfRepository repository = RdfRepository.getInstanceOrNull();
    Map<String, Object> result;
    if (repository == null || !repository.isEnabled()) {
      result = error("RDF repository is not enabled on this OpenMetadata server");
    } else {
      result = queryNeighborhood(repository, entityType, entityId, depth, limit);
    }
    return result;
  }

  private static Map<String, Object> queryNeighborhood(
      RdfRepository repository, String entityType, String entityId, int depth, int limit) {
    String entityUri = repository.getBaseUri() + "entity/" + entityType + "/" + entityId;
    Map<String, Object> result;
    try {
      String triples =
          repository.executeSparqlQuery(
              buildConstructQuery(entityUri, depth, limit), "text/turtle");
      List<Edge> edges = fetchEdges(repository, entityUri, limit);
      result =
          JsonUtils.getMap(
              new Neighborhood(entityUri, depth, limit, triples == null ? "" : triples, edges));
    } catch (Exception e) {
      LOG.error("CONSTRUCT for neighborhood failed for {}", entityUri, e);
      result = error("Neighborhood query failed: " + e.getMessage());
    }
    return result;
  }

  /**
   * Fetches the entity's <b>direct (1-hop)</b> adjacency as a flat edge list. This is a structured
   * summary of the immediate neighbours only — the full {@code depth}-hop subgraph lives in the
   * CONSTRUCT {@code triples}. SELECT failure degrades to an empty list rather than failing the call.
   */
  private static List<Edge> fetchEdges(RdfRepository repository, String entityUri, int limit) {
    List<Edge> edges;
    try {
      String selectJson =
          repository.executeSparqlQuery(
              buildSelectQuery(entityUri, limit), "application/sparql-results+json");
      edges = parseEdges(selectJson);
    } catch (Exception e) {
      LOG.error("SELECT for neighborhood failed for {}", entityUri, e);
      edges = List.of();
    }
    return edges;
  }

  /**
   * Builds a CONSTRUCT query that yields all triples on every path of length 1..depth radiating
   * from the entity. Each UNION arm emits exactly one triple template ({@code ?s ?p ?o}), with
   * {@code ?s} bound to the *actual* subject of that triple — not the start entity. The previous
   * implementation bound {@code ?s = <entityUri>} unconditionally, which collapsed all 2- and
   * 3-hop edges onto the start node and produced an incorrect graph.
   */
  static String buildConstructQuery(String entityUri, int depth, int limit) {
    String e = "<" + entityUri + ">";
    StringBuilder w = new StringBuilder();
    // depth-1 outgoing
    w.append("    { BIND(").append(e).append(" AS ?s) ").append(e).append(" ?p ?o }\n");
    // depth-1 incoming
    w.append("    UNION { BIND(").append(e).append(" AS ?o) ?s ?p ").append(e).append(" }\n");
    if (depth >= 2) {
      // depth-2 outgoing: emit BOTH edges as separate arms
      w.append("    UNION { BIND(")
          .append(e)
          .append(" AS ?s) ")
          .append(e)
          .append(" ?p ?o . ?o ?p2 ?n2 }\n");
      w.append("    UNION { ").append(e).append(" ?p1 ?s . ?s ?p ?o }\n");
    }
    if (depth >= 3) {
      // depth-3 outgoing: three edges, three arms
      w.append("    UNION { BIND(")
          .append(e)
          .append(" AS ?s) ")
          .append(e)
          .append(" ?p ?o . ?o ?p2 ?n2 . ?n2 ?p3 ?n3 }\n");
      w.append("    UNION { ").append(e).append(" ?p1 ?s . ?s ?p ?o . ?o ?p3 ?n3 }\n");
      w.append("    UNION { ").append(e).append(" ?p1 ?n1 . ?n1 ?p2 ?s . ?s ?p ?o }\n");
    }
    return "CONSTRUCT { ?s ?p ?o } WHERE {\n" + w + "} LIMIT " + limit;
  }

  /**
   * Builds the 1-hop adjacency SELECT (outgoing + incoming edges of the start entity). Multi-hop
   * traversal is intentionally not expanded here — the full n-hop graph is returned as CONSTRUCT
   * {@code triples}; {@code edges} is a flat, direct-neighbour summary, so it takes no depth.
   */
  static String buildSelectQuery(String entityUri, int limit) {
    return "PREFIX om: <https://open-metadata.org/ontology/>\n"
        + "SELECT ?direction ?predicate ?neighbor ?neighborLabel WHERE {\n"
        + "  { BIND('outgoing' AS ?direction) <"
        + entityUri
        + "> ?predicate ?neighbor }\n"
        + "  UNION { BIND('incoming' AS ?direction) ?neighbor ?predicate <"
        + entityUri
        + "> }\n"
        + "  OPTIONAL { ?neighbor <http://www.w3.org/2000/01/rdf-schema#label> ?neighborLabel }\n"
        + "} LIMIT "
        + limit;
  }

  private static List<Edge> parseEdges(String selectJson) {
    List<Edge> edges = new ArrayList<>();
    if (selectJson != null && !selectJson.isBlank()) {
      try {
        Map<String, Object> sparql = JsonUtils.readValue(selectJson, Map.class);
        if (sparql.get("results") instanceof Map<?, ?> resultsMap
            && resultsMap.get("bindings") instanceof List<?> rows) {
          for (Object row : rows) {
            if (row instanceof Map<?, ?> r) {
              edges.add(
                  new Edge(
                      bindingValue(r, "direction"),
                      bindingValue(r, "predicate"),
                      bindingValue(r, "neighbor"),
                      bindingValue(r, "neighborLabel")));
            }
          }
        }
      } catch (Exception e) {
        LOG.warn("Failed to parse neighborhood SELECT results: {}", e.getMessage());
      }
    }
    return edges;
  }

  private static String bindingValue(Map<?, ?> row, String name) {
    String value = null;
    if (row.get(name) instanceof Map<?, ?> nodeMap && nodeMap.get("value") instanceof String s) {
      value = s;
    }
    return value;
  }

  private static boolean isUuid(String value) {
    boolean valid = true;
    try {
      UUID.fromString(value);
    } catch (IllegalArgumentException e) {
      valid = false;
    }
    return valid;
  }

  private static int clampDepth(int depth) {
    return Math.min(Math.max(depth, MIN_DEPTH), MAX_DEPTH);
  }

  private static int clampLimit(int limit) {
    return Math.min(Math.max(limit, MIN_LIMIT), MAX_LIMIT);
  }

  private static int intParam(Map<String, Object> params, String key, int defaultValue) {
    Object v = params.get(key);
    int result = defaultValue;
    if (v instanceof Number n) {
      result = n.intValue();
    } else if (v instanceof String s) {
      try {
        result = Integer.parseInt(s);
      } catch (NumberFormatException e) {
        result = defaultValue;
      }
    }
    return result;
  }

  private static String string(Map<String, Object> params, String key) {
    Object v = params.get(key);
    return v instanceof String s ? s : null;
  }

  private static Map<String, Object> error(String message) {
    Map<String, Object> result = new HashMap<>();
    result.put("error", message);
    return result;
  }
}
