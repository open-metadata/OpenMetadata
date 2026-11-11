package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;
import org.apache.jena.query.QueryExecutionFactory;
import org.apache.jena.query.QuerySolution;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.OntologyRestrictionKind;

class OntologyNativeVisualQueryTest {
  private static final URI SOURCE = URI.create("urn:visual:source");
  private static final URI TARGET = URI.create("urn:visual:target");
  private static final URI OTHER = URI.create("urn:visual:other");
  private static final URI DECOY = URI.create("urn:visual:decoy");
  private static final URI PROPERTY = URI.create("urn:visual:property");
  private static final URI DECOY_PROPERTY = URI.create("urn:visual:decoyProperty");

  static Stream<JsonNode> queries() throws IOException {
    try (var resource =
        OntologyNativeVisualQueryTest.class.getResourceAsStream(
            "/ontology/native-visual-queries.json")) {
      final JsonNode queries = new ObjectMapper().readTree(resource);
      final var values = new ArrayList<JsonNode>();
      queries.forEach(values::add);
      return values.stream();
    }
  }

  @ParameterizedTest(name = "{index} native visual query matches canonical emitted RDF")
  @MethodSource("queries")
  void nativeBuilderQueriesMatchEmittedDefinitions(final JsonNode fixture) {
    final Model model = ModelFactory.createDefaultModel();
    try {
      declareClasses(model);
      writeDefinitions(model, fixture);
      assertSingleExpectedRow(model, fixture);
    } finally {
      model.close();
    }
  }

  private static void declareClasses(final Model model) {
    model
        .createResource(SOURCE.toString())
        .addProperty(RDF.type, OWL2.Class)
        .addProperty(RDFS.label, "Source");
    model
        .createResource(TARGET.toString())
        .addProperty(RDF.type, OWL2.Class)
        .addProperty(RDFS.label, "Target");
    model.createResource(OTHER.toString()).addProperty(RDF.type, OWL2.Class);
    model.createResource(DECOY.toString()).addProperty(RDF.type, OWL2.Class);
  }

  private static void writeDefinitions(final Model model, final JsonNode fixture) {
    switch (fixture.get("kind").asText()) {
      case "subClassOf" -> writeAxiom(model, namedAxiom(SOURCE, OntologyAxiomType.SUBCLASS_OF));
      case "equivalentClass" -> writeAxiom(
          model, namedAxiom(SOURCE, OntologyAxiomType.EQUIVALENT_CLASS));
      case "disjointWith" -> writeAxiom(model, namedAxiom(SOURCE, OntologyAxiomType.DISJOINT_WITH));
      case "objectAssertion" -> writeAxiom(model, objectAssertion());
      case "objectProperty" -> writeObjectProperty(model, PROPERTY, SOURCE, TARGET);
      case "restriction" -> writeAxiom(
          model, restrictionAxiom(fixture.get("restriction").asText()));
      case "twoConditions" -> writeTwoConditionDefinitions(model);
      case "propertyDomain" -> writePropertyDefinitions(model);
      default -> throw new IllegalArgumentException(fixture.toString());
    }
  }

  // The decoy satisfies only the first condition, so a single row proves the conditions are ANDed.
  private static void writeTwoConditionDefinitions(final Model model) {
    writeAxiom(model, namedAxiom(SOURCE, OntologyAxiomType.SUBCLASS_OF));
    writeAxiom(
        model,
        new OntologyAxiom()
            .withSubjectIri(SOURCE)
            .withAxiomType(OntologyAxiomType.DISJOINT_WITH)
            .withExpressions(List.of(namedClass(OTHER))));
    writeAxiom(model, namedAxiom(DECOY, OntologyAxiomType.SUBCLASS_OF));
  }

  private static void writePropertyDefinitions(final Model model) {
    writeObjectProperty(model, PROPERTY, SOURCE, TARGET);
    writeObjectProperty(model, DECOY_PROPERTY, TARGET, SOURCE);
  }

  private static OntologyExpression namedClass(final URI classIri) {
    return new OntologyExpression()
        .withKind(OntologyExpressionKind.NAMED_CLASS)
        .withClassIri(classIri);
  }

  private static OntologyAxiom namedAxiom(final URI subject, final OntologyAxiomType type) {
    return new OntologyAxiom()
        .withSubjectIri(subject)
        .withAxiomType(type)
        .withExpressions(List.of(namedClass(TARGET)));
  }

  private static OntologyAxiom objectAssertion() {
    return new OntologyAxiom()
        .withSubjectIri(SOURCE)
        .withAxiomType(OntologyAxiomType.OBJECT_PROPERTY_ASSERTION)
        .withPropertyIri(PROPERTY)
        .withTargetIri(TARGET);
  }

  private static OntologyAxiom restrictionAxiom(final String restriction) {
    final var kind = OntologyRestrictionKind.fromValue(restriction);
    final var expression =
        new OntologyExpression()
            .withKind(OntologyExpressionKind.RESTRICTION)
            .withPropertyIri(PROPERTY)
            .withRestrictionKind(kind)
            .withFiller(namedClass(TARGET));
    if (isQualifiedCardinality(kind)) {
      expression.withCardinality(2);
    }
    return new OntologyAxiom()
        .withSubjectIri(SOURCE)
        .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
        .withExpressions(List.of(expression));
  }

  private static boolean isQualifiedCardinality(final OntologyRestrictionKind kind) {
    return kind == OntologyRestrictionKind.MIN
        || kind == OntologyRestrictionKind.MAX
        || kind == OntologyRestrictionKind.EXACT;
  }

  private static void writeAxiom(final Model model, final OntologyAxiom axiom) {
    new OntologyExpressionRdfWriter(iri -> false).write(model, axiom);
  }

  private static void writeObjectProperty(
      final Model model, final URI property, final URI domain, final URI range) {
    OntologyPropertyRdfWriter.write(
        model,
        new OntologyProperty()
            .withIri(property)
            .withKind(OntologyPropertyKind.OBJECT)
            .withDomain(List.of(domain))
            .withRange(List.of(range)),
        null);
  }

  private static void assertSingleExpectedRow(final Model model, final JsonNode fixture) {
    try (var query = QueryExecutionFactory.create(fixture.get("query").asText(), model)) {
      final var results = query.execSelect();
      assertTrue(results.hasNext(), fixture.get("name").asText());
      final QuerySolution row = results.next();
      expectedColumns(fixture)
          .properties()
          .forEach(
              column ->
                  assertEquals(
                      column.getValue().asText(),
                      displayValue(row.get(column.getKey())),
                      fixture.get("name").asText() + " ?" + column.getKey()));
      assertFalse(results.hasNext(), fixture.get("name").asText());
    }
  }

  private static JsonNode expectedColumns(final JsonNode fixture) {
    return fixture.has("expected")
        ? fixture.get("expected")
        : new ObjectMapper().createObjectNode().put("concept", SOURCE.toString());
  }

  private static String displayValue(final RDFNode node) {
    return node.isLiteral() ? node.asLiteral().getLexicalForm() : node.asResource().getURI();
  }
}
