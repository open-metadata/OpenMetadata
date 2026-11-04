package org.openmetadata.service.ontology;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.utils.JsonUtils;

/** The explicit ontology-release-v1 content contract, independent of live entity metadata. */
public final class OntologyReleaseContent {
  private OntologyReleaseContent() {}

  public static ObjectNode project(final OntologyDefinition definition) {
    final List<String> fields =
        new ArrayList<>(
            List.of("id", "name", "fullyQualifiedName", "displayName", "description", "ontology"));
    fields.addAll(semanticFields(definition));
    final ObjectNode content = JsonUtils.getObjectMapper().valueToTree(definition);
    content.retain(fields);
    if (content.get("ontology") instanceof ObjectNode reference) {
      reference.retain("id", "type");
    }
    return content;
  }

  private static List<String> semanticFields(final OntologyDefinition definition) {
    return switch (definition) {
      case Ontology ignored -> List.of("iri", "namespace", "layer", "prefixes");
      case OntologyConcept ignored -> List.of(
          "iri",
          "conceptType",
          "synonyms",
          "conceptMappings",
          "abstract",
          "definitionSource",
          "deprecated",
          "replacedBy");
      case OntologyProperty ignored -> List.of(
          "iri",
          "kind",
          "domain",
          "range",
          "enumValues",
          "unit",
          "isIdentifier",
          "inverse",
          "characteristics",
          "propertyChain",
          "disjointWith",
          "deprecated",
          "replacedBy");
      case OntologyAxiom ignored -> List.of(
          "axiomType",
          "subjectIri",
          "expressions",
          "propertyIri",
          "targetIri",
          "literal",
          "provenance");
      default -> throw new IllegalArgumentException(
          "Unsupported ontology content: " + definition.getClass());
    };
  }
}
