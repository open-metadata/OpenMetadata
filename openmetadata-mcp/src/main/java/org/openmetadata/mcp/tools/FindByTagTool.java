package org.openmetadata.mcp.tools;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

/**
 * Finds entities tagged with a given tag or glossary term FQN.
 *
 * <p>Resolves the tag/glossary URI from the FQN, then runs a SELECT for everything connected
 * via {@code om:hasTag} or {@code om:hasGlossaryTerm}. Results include the entity URI, its FQN,
 * its rdf:type, and its label.
 */
@Slf4j
public class FindByTagTool implements McpTool {

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    String tagFqn = string(params, "tagFqn");
    if (tagFqn == null || tagFqn.isBlank()) {
      return error("'tagFqn' parameter is required");
    }
    if (tagFqn.contains("\"") || tagFqn.contains("\\") || tagFqn.contains("\n")) {
      return error("'tagFqn' contains illegal characters");
    }
    int limit = Math.min(Math.max(intParam(params, "limit", 50), 1), 500);
    int offset = Math.max(intParam(params, "offset", 0), 0);
    String entityType = string(params, "entityType");
    if (entityType != null && !entityType.matches("[A-Za-z][A-Za-z0-9]*")) {
      return error("'entityType' must be alphanumeric");
    }

    RdfRepository repository = RdfRepository.getInstanceOrNull();
    if (repository == null || !repository.isEnabled()) {
      return error("RDF repository is not enabled on this OpenMetadata server");
    }

    String sparql = buildSparql(tagFqn, entityType, limit, offset);
    String json;
    try {
      json = repository.executeSparqlQuery(sparql, "application/sparql-results+json");
    } catch (Exception e) {
      LOG.error("find_by_tag SPARQL failed for {}", tagFqn, e);
      return error("SPARQL execution failed: " + e.getMessage());
    }

    List<Map<String, Object>> entities = parseRows(json);
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("tagFqn", tagFqn);
    result.put("entityTypeFilter", entityType);
    result.put("limit", limit);
    result.put("offset", offset);
    result.put("results", entities);
    result.put("returnedCount", entities.size());
    return result;
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params) {
    throw new UnsupportedOperationException("FindByTagTool does not enforce write limits.");
  }

  static String buildSparql(String tagFqn, String entityType, int limit, int offset) {
    String escapedFqn = tagFqn.replace("\"", "\\\"");
    StringBuilder sb = new StringBuilder();
    // Match either a Tag (om:tagFQN) or a GlossaryTerm (om:fullyQualifiedName) — the input FQN
    // can be either. GlossaryTerms in OM RDF do not carry om:tagFQN, so without this UNION the
    // tool silently returned zero results for any glossary FQN.
    sb.append("PREFIX om: <https://open-metadata.org/ontology/>\n")
        .append("PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n")
        .append("SELECT DISTINCT ?entity ?entityType ?fqn ?label WHERE {\n")
        .append("  { ?tag om:tagFQN \"")
        .append(escapedFqn)
        .append("\" }\n")
        .append("  UNION { ?tag om:fullyQualifiedName \"")
        .append(escapedFqn)
        .append("\" }\n")
        .append("  { ?entity om:hasTag ?tag } UNION { ?entity om:hasGlossaryTerm ?tag }\n")
        .append("  ?entity a ?entityType .\n")
        .append("  OPTIONAL { ?entity om:fullyQualifiedName ?fqn }\n")
        .append("  OPTIONAL { ?entity rdfs:label ?label }\n");
    if (entityType != null && !entityType.isBlank()) {
      String capitalized = Character.toUpperCase(entityType.charAt(0)) + entityType.substring(1);
      sb.append("  FILTER(?entityType = <https://open-metadata.org/ontology/")
          .append(capitalized)
          .append(">)\n");
    }
    sb.append("} ORDER BY ?fqn LIMIT ").append(limit).append(" OFFSET ").append(offset);
    return sb.toString();
  }

  private static List<Map<String, Object>> parseRows(String selectJson) {
    if (selectJson == null || selectJson.isBlank()) {
      return List.of();
    }
    try {
      Map<String, Object> sparql = JsonUtils.readValue(selectJson, Map.class);
      Object results = sparql.get("results");
      if (!(results instanceof Map<?, ?> resultsMap)) return List.of();
      Object bindings = resultsMap.get("bindings");
      if (!(bindings instanceof List<?> rows)) return List.of();
      List<Map<String, Object>> entities = new ArrayList<>(rows.size());
      for (Object row : rows) {
        if (!(row instanceof Map<?, ?> r)) continue;
        Map<String, Object> entity = new LinkedHashMap<>();
        Object e = bindingValue(r, "entity");
        if (e == null) continue;
        entity.put("entity", e);
        Object t = bindingValue(r, "entityType");
        if (t != null) entity.put("entityType", t);
        Object fqn = bindingValue(r, "fqn");
        if (fqn != null) entity.put("fullyQualifiedName", fqn);
        Object label = bindingValue(r, "label");
        if (label != null) entity.put("label", label);
        entities.add(entity);
      }
      return entities;
    } catch (Exception e) {
      LOG.warn("Failed to parse find_by_tag SELECT results: {}", e.getMessage());
      return List.of();
    }
  }

  private static Object bindingValue(Map<?, ?> row, String name) {
    Object node = row.get(name);
    if (!(node instanceof Map<?, ?> nodeMap)) return null;
    return nodeMap.get("value");
  }

  private static String string(Map<String, Object> params, String key) {
    Object v = params.get(key);
    return v instanceof String s ? s : null;
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

  private static Map<String, Object> error(String message) {
    Map<String, Object> result = new HashMap<>();
    result.put("error", message);
    return result;
  }
}
