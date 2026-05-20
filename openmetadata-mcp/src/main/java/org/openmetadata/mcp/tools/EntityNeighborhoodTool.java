package org.openmetadata.mcp.tools;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
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

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    String entityId = string(params, "entityId");
    String entityType = string(params, "entityType");
    if (entityId == null || entityId.isBlank()) {
      return error("'entityId' parameter is required");
    }
    if (entityType == null || entityType.isBlank()) {
      return error("'entityType' parameter is required");
    }
    try {
      UUID.fromString(entityId);
    } catch (IllegalArgumentException e) {
      return error("'entityId' must be a UUID");
    }
    if (!entityType.matches("[A-Za-z][A-Za-z0-9]*")) {
      return error("'entityType' must be alphanumeric");
    }

    int depth = clampDepth(intParam(params, "depth", DEFAULT_DEPTH));
    int limit = Math.min(Math.max(intParam(params, "limit", 200), 1), 2000);

    RdfRepository repository = RdfRepository.getInstanceOrNull();
    if (repository == null || !repository.isEnabled()) {
      return error("RDF repository is not enabled on this OpenMetadata server");
    }

    String entityUri = repository.getBaseUri() + "entity/" + entityType + "/" + entityId;

    String constructQuery = buildConstructQuery(entityUri, depth, limit);
    String triples;
    try {
      triples = repository.executeSparqlQuery(constructQuery, "text/turtle");
    } catch (Exception e) {
      LOG.error("CONSTRUCT for neighborhood failed for {}", entityUri, e);
      return error("Neighborhood query failed: " + e.getMessage());
    }

    String selectQuery = buildSelectQuery(entityUri, depth, limit);
    String selectJson;
    try {
      selectJson = repository.executeSparqlQuery(selectQuery, "application/sparql-results+json");
    } catch (Exception e) {
      LOG.error("SELECT for neighborhood failed for {}", entityUri, e);
      selectJson = null;
    }

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("entityUri", entityUri);
    result.put("depth", depth);
    result.put("limit", limit);
    result.put("triples", triples == null ? "" : triples);
    result.put("edges", parseEdges(selectJson));
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

  static String buildSelectQuery(String entityUri, int depth, int limit) {
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

  private static List<Map<String, Object>> parseEdges(String selectJson) {
    if (selectJson == null || selectJson.isBlank()) {
      return List.of();
    }
    try {
      Map<String, Object> sparql = JsonUtils.readValue(selectJson, Map.class);
      Object results = sparql.get("results");
      if (!(results instanceof Map<?, ?> resultsMap)) return List.of();
      Object bindings = resultsMap.get("bindings");
      if (!(bindings instanceof List<?> rows)) return List.of();
      List<Map<String, Object>> edges = new ArrayList<>(rows.size());
      for (Object row : rows) {
        if (!(row instanceof Map<?, ?> r)) continue;
        Map<String, Object> edge = new LinkedHashMap<>();
        edge.put("direction", bindingValue(r, "direction"));
        edge.put("predicate", bindingValue(r, "predicate"));
        edge.put("neighbor", bindingValue(r, "neighbor"));
        Object label = bindingValue(r, "neighborLabel");
        if (label != null) {
          edge.put("neighborLabel", label);
        }
        edges.add(edge);
      }
      return edges;
    } catch (Exception e) {
      LOG.warn("Failed to parse neighborhood SELECT results: {}", e.getMessage());
      return List.of();
    }
  }

  private static Object bindingValue(Map<?, ?> row, String name) {
    Object node = row.get(name);
    if (!(node instanceof Map<?, ?> nodeMap)) return null;
    return nodeMap.get("value");
  }

  private static int clampDepth(int depth) {
    return Math.min(Math.max(depth, MIN_DEPTH), MAX_DEPTH);
  }

  private static int intParam(Map<String, Object> params, String key, int defaultValue) {
    Object v = params.get(key);
    if (v instanceof Number n) return n.intValue();
    if (v instanceof String s) {
      try {
        return Integer.parseInt(s);
      } catch (NumberFormatException e) {
        return defaultValue;
      }
    }
    return defaultValue;
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
