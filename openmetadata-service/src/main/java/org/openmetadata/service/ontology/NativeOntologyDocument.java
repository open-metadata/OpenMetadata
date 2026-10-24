package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URI;
import java.util.AbstractMap.SimpleImmutableEntry;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import org.apache.jena.vocabulary.XSD;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * The native definitions one import source states, before they are matched to a target. They
 * carry no ids, names, owners, or versions. Definitions are sorted by IRI and axioms by signature,
 * so two sources that state the same definitions produce equal documents.
 *
 * @param header the source's ontology header, or null unless the source declares exactly one
 */
public record NativeOntologyDocument(
    Header header,
    List<OntologyConcept> concepts,
    List<OntologyProperty> properties,
    List<OntologyAxiom> axioms) {

  public NativeOntologyDocument {
    concepts = sorted(concepts, concept -> concept.getIri().toString());
    properties = sorted(properties, property -> property.getIri().toString());
    axioms = sorted(axioms, NativeOntologyDocument::signature);
  }

  public record Header(URI iri, String label, String description) {}

  /** Identity of an axiom's meaning: equal for axioms that differ only in name or operand order. */
  public static String signature(final OntologyAxiom axiom) {
    final ObjectNode node = JsonUtils.getObjectMapper().valueToTree(axiom);
    node.retain("axiomType", "subjectIri", "propertyIri", "targetIri", "literal", "expressions");
    normalizeLiteral(node.get("literal"));
    final ArrayNode expressions = JsonUtils.getObjectMapper().createArrayNode();
    listOrEmpty(axiom.getExpressions()).stream()
        .map(expression -> normalizeExpression(JsonUtils.getObjectMapper().valueToTree(expression)))
        .sorted(Comparator.comparing(JsonNode::toString))
        .forEach(expressions::add);
    node.set("expressions", expressions);
    return node.toString();
  }

  private static <T> List<T> sorted(final List<T> values, final Function<T, String> key) {
    return listOrEmpty(values).stream()
        .map(value -> new SimpleImmutableEntry<>(key.apply(value), value))
        .sorted(Map.Entry.comparingByKey())
        .map(Map.Entry::getValue)
        .toList();
  }

  private static JsonNode normalizeExpression(final JsonNode expression) {
    if (!(expression instanceof ObjectNode object)) {
      return expression;
    }
    for (final String field : List.of("operands", "individualIris")) {
      if (object.get(field) instanceof ArrayNode values) {
        final ArrayNode normalized = JsonUtils.getObjectMapper().createArrayNode();
        final List<JsonNode> items = new ArrayList<>();
        values.forEach(value -> items.add(normalizeExpression(value)));
        items.stream().sorted(Comparator.comparing(JsonNode::toString)).forEach(normalized::add);
        object.set(field, normalized);
      }
    }
    if (object.get("filler") != null) {
      object.set("filler", normalizeExpression(object.get("filler")));
    }
    normalizeLiteral(object.get("literal"));
    return object;
  }

  private static void normalizeLiteral(final JsonNode literal) {
    if (literal instanceof ObjectNode object
        && XSD.xstring.getURI().equals(object.path("datatypeIri").asText())) {
      object.remove("datatypeIri");
    }
  }
}
