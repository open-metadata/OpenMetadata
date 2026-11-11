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
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
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
  private static final URI PROPERTY = URI.create("urn:visual:property");

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
      model.createResource(SOURCE.toString()).addProperty(RDF.type, OWL2.Class);
      model.createResource(TARGET.toString()).addProperty(RDF.type, OWL2.Class);
      final var axiom = new OntologyAxiom().withSubjectIri(SOURCE);
      final var named =
          new OntologyExpression()
              .withKind(OntologyExpressionKind.NAMED_CLASS)
              .withClassIri(TARGET);
      switch (fixture.get("kind").asText()) {
        case "subClassOf" -> axiom
            .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
            .withExpressions(List.of(named));
        case "equivalentClass" -> axiom
            .withAxiomType(OntologyAxiomType.EQUIVALENT_CLASS)
            .withExpressions(List.of(named));
        case "disjointWith" -> axiom
            .withAxiomType(OntologyAxiomType.DISJOINT_WITH)
            .withExpressions(List.of(named));
        case "objectAssertion" -> axiom
            .withAxiomType(OntologyAxiomType.OBJECT_PROPERTY_ASSERTION)
            .withPropertyIri(PROPERTY)
            .withTargetIri(TARGET);
        case "objectProperty" -> OntologyPropertyRdfWriter.write(
            model,
            new OntologyProperty()
                .withIri(PROPERTY)
                .withKind(OntologyPropertyKind.OBJECT)
                .withDomain(List.of(SOURCE))
                .withRange(List.of(TARGET)),
            null);
        case "restriction" -> {
          final var kind = OntologyRestrictionKind.fromValue(fixture.get("restriction").asText());
          final var expression =
              new OntologyExpression()
                  .withKind(OntologyExpressionKind.RESTRICTION)
                  .withPropertyIri(PROPERTY)
                  .withRestrictionKind(kind)
                  .withFiller(named);
          if (kind == OntologyRestrictionKind.MIN
              || kind == OntologyRestrictionKind.MAX
              || kind == OntologyRestrictionKind.EXACT) {
            expression.withCardinality(2);
          }
          axiom.withAxiomType(OntologyAxiomType.SUBCLASS_OF).withExpressions(List.of(expression));
        }
        default -> throw new IllegalArgumentException(fixture.toString());
      }
      if (axiom.getAxiomType() != null) {
        new OntologyExpressionRdfWriter(iri -> false).write(model, axiom);
      }
      try (var query = QueryExecutionFactory.create(fixture.get("query").asText(), model)) {
        final var results = query.execSelect();
        assertTrue(results.hasNext(), fixture.get("name").asText());
        assertEquals(SOURCE.toString(), results.next().getResource("concept").getURI());
        assertFalse(results.hasNext());
      }
    } finally {
      model.close();
    }
  }
}
