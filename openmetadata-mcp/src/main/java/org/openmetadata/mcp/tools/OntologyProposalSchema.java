package org.openmetadata.mcp.tools;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

/** Public canonical schemas, fetched on demand without reading entity instances. */
final class OntologyProposalSchema {
  private static final URI SCHEMA_BASE = URI.create("https://open-metadata.org/schema/");
  private static final int MAX_SCHEMAS = 128;
  private static final Map<String, String> ROOTS =
      Map.of(
          "proposal", "api/data/createOntologyChangeSet.json",
          "operation", "type/ontologyChangeOperation.json",
          "relationship", "type/ontologyRelationship.json",
          "mapping", "type/conceptMapping.json",
          "term", "entity/data/glossaryTerm.json",
          "glossary", "entity/data/glossary.json",
          "axiom", "entity/data/ontologyAxiom.json",
          "concept", "entity/data/ontologyConcept.json",
          "property", "entity/data/ontologyProperty.json");

  private OntologyProposalSchema() {}

  record Description(
      String entityType, String createTool, String rootSchema, Map<String, JsonNode> schemas) {}

  static Description describe(final String selected) {
    final String root = ROOTS.get(selected == null ? "operation" : selected);
    if (root == null) {
      throw new IllegalArgumentException(
          "Unknown ontology schema; choose one of " + ROOTS.keySet());
    }
    final Map<String, JsonNode> schemas = new LinkedHashMap<>();
    addSchema(root, schemas);
    return new Description(
        Entity.ONTOLOGY_CHANGE_SET, "create_ontology_change_set", root, Map.copyOf(schemas));
  }

  private static void addSchema(final String path, final Map<String, JsonNode> schemas) {
    if (schemas.containsKey(path)) {
      return;
    }
    if (schemas.size() >= MAX_SCHEMAS) {
      throw new IllegalStateException("Ontology proposal schema closure exceeds " + MAX_SCHEMAS);
    }
    final JsonNode schema = readSchema(path);
    schemas.put(path, schema);
    schema.findValues("$ref").stream()
        .map(JsonNode::asText)
        .filter(reference -> !reference.startsWith("#"))
        .forEach(reference -> addSchema(resolve(path, reference), schemas));
  }

  private static JsonNode readSchema(final String path) {
    try {
      return JsonUtils.readTree(
          CommonUtil.getResourceAsStream(
              OntologyProposalSchema.class.getClassLoader(), "json/schema/" + path));
    } catch (final IOException error) {
      throw new IllegalStateException("Required ontology schema is unavailable: " + path, error);
    }
  }

  static String resolve(final String path, final String reference) {
    final URI resolved = SCHEMA_BASE.resolve(path).resolve(reference).normalize();
    if (!resolved.toString().startsWith(SCHEMA_BASE.toString()) || resolved.getQuery() != null) {
      throw new IllegalStateException(
          "Ontology schema references a non-classpath schema: " + reference);
    }
    return resolved.getPath().substring(SCHEMA_BASE.getPath().length());
  }
}
