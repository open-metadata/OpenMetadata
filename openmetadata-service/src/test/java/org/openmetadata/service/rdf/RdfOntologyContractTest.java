package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.vocabulary.OWL;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class RdfOntologyContractTest {
  private static final String OM = "https://open-metadata.org/ontology/";
  private static Model projection;
  private static Model ontology;

  @BeforeAll
  static void projectAllEntitySchemasAndRelationshipWriters() throws IOException {
    projection = RdfProjectionFixtures.project();
    ontology = RDFDataMgr.loadModel("rdf/ontology/openmetadata.ttl");
  }

  @AfterAll
  static void close() {
    if (projection != null) projection.close();
    if (ontology != null) ontology.close();
  }

  @Test
  void everyWrittenPredicateIsDeclared() {
    assertDeclared(projection, ontology);
  }

  @Test
  void conditionalWriterPredicatesAreDeclaredEvenWhenTheirBranchIsNotInAFixture()
      throws IOException {
    final Set<String> missing = RdfWriterPredicates.constantPredicates();
    assertFalse(missing.isEmpty(), "Writer source inspection must discover predicates");
    missing.removeAll(declarations(ontology));
    assertTrue(missing.isEmpty(), "Conditional writers emit undeclared predicates: " + missing);
  }

  @Test
  void everyDeclarationIsWrittenOrExplicitlyInferenceOnly() {
    assertProjected(projection, ontology);
  }

  @Test
  void writtenPredicatesAreNeverLabeledInferenceOnly() {
    for (String uri : predicates(projection)) {
      assertEquals(
          List.of(ontology.createResource(OM + "Stored")),
          ontology
              .listObjectsOfProperty(
                  ontology.createResource(uri), ontology.createProperty(OM + "projectionStatus"))
              .toList(),
          uri);
    }
  }

  @Test
  void addingAPredicateToTheWriterWithoutAnOntologyDeclarationFails() {
    final Model changed = RDFDataMgr.loadModel("rdf/ontology/openmetadata.ttl");
    try {
      changed.removeAll(changed.createResource(OM + "upstream"), RDF.type, null);
      assertThrows(AssertionError.class, () -> assertDeclared(projection, changed));
    } finally {
      changed.close();
    }
  }

  @Test
  void addingAnOntologyPropertyWithoutAProjectionFails() {
    final Model changed = RDFDataMgr.loadModel("rdf/ontology/openmetadata.ttl");
    try {
      changed.add(
          changed.createResource(OM + "unimplementedPredicate"), RDF.type, OWL.ObjectProperty);
      assertThrows(AssertionError.class, () -> assertProjected(projection, changed));
    } finally {
      changed.close();
    }
  }

  @Test
  void extensionKeysNeverMintPredicatesInTheCoreVocabulary() {
    assertFalse(predicates(projection).stream().anyMatch(uri -> uri.startsWith(OM + "ext_")));
    final Resource entry =
        projection
            .listResourcesWithProperty(
                projection.createProperty(OM + "extensionKey"), "cost center / $()")
            .next();
    assertEquals(
        "Engineering",
        entry.getRequiredProperty(projection.createProperty(OM + "extensionValue")).getString());
  }

  private static void assertDeclared(final Model written, final Model declared) {
    final Set<String> missing = predicates(written);
    missing.removeAll(declarations(declared));
    assertTrue(missing.isEmpty(), "Writer emits undeclared predicates: " + missing);
  }

  private static void assertProjected(final Model written, final Model declared) {
    final Set<String> missing = declarations(declared);
    missing.removeAll(predicates(written));
    missing.removeIf(uri -> isInferenceOnly(declared, uri));
    assertTrue(
        missing.isEmpty(),
        "Ontology advertises predicates the projection never writes: " + missing);
  }

  private static boolean isInferenceOnly(final Model declared, final String uri) {
    final Resource property = declared.createResource(uri);
    return declared.contains(
            property,
            declared.createProperty(OM + "projectionStatus"),
            declared.createResource(OM + "InferenceOnly"))
        && declared.listObjectsOfProperty(property, RDFS.comment).toList().stream()
            .anyMatch(
                value ->
                    value.isLiteral() && value.asLiteral().getString().contains("Not emitted"));
  }

  static Set<String> predicates(final Model model) {
    final Set<String> predicates = new TreeSet<>();
    model
        .listStatements()
        .forEachRemaining(statement -> predicates.add(statement.getPredicate().getURI()));
    return predicates;
  }

  private static Set<String> declarations(final Model model) {
    final Set<String> declarations = new TreeSet<>();
    for (Resource type : List.of(RDF.Property, OWL.ObjectProperty, OWL.DatatypeProperty)) {
      model
          .listResourcesWithProperty(RDF.type, type)
          .forEachRemaining(property -> declarations.add(property.getURI()));
    }
    return declarations;
  }
}
