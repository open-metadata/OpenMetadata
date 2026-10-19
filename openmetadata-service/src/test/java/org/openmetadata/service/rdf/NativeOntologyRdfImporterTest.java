package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.ontology.OntologyWorkingSnapshot;

class NativeOntologyRdfImporterTest {
  private static final URI ROOT_IRI = URI.create("https://example.org/ontology");
  private static final URI CONCEPT_IRI = URI.create("https://example.org/Customer");
  private final NativeOntologyRdfImporter importer = new NativeOntologyRdfImporter();

  @ParameterizedTest
  @EnumSource(RdfSerializationFormat.class)
  void nativeConceptReimportIsNoOpWithStableCatalogIdentity(RdfSerializationFormat format) {
    final var root = root();
    final var concept =
        new OntologyConcept()
            .withId(UUID.randomUUID())
            .withName("Customer")
            .withFullyQualifiedName("Imported.Customer")
            .withOntology(root.getEntityReference())
            .withIri(CONCEPT_IRI)
            .withConceptType(OntologyConceptType.OWL_CLASS);
    final var snapshot =
        new OntologyWorkingSnapshot.Snapshot(
            state(root),
            List.of(
                new OntologyWorkingSnapshot.Entry(MemberKind.ONTOLOGY, root),
                new OntologyWorkingSnapshot.Entry(MemberKind.CONCEPT, concept)));
    final String data =
        switch (format) {
          case TURTLE -> "<https://example.org/Customer> a <http://www.w3.org/2002/07/owl#Class>; <http://www.w3.org/2000/01/rdf-schema#label> \"Customer\" .";
          case RDF_XML -> """
              <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#" xmlns:owl="http://www.w3.org/2002/07/owl#"><owl:Class rdf:about="https://example.org/Customer"><rdfs:label>Customer</rdfs:label></owl:Class></rdf:RDF>
              """;
          case N_TRIPLES -> "<https://example.org/Customer> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/2002/07/owl#Class> .\n<https://example.org/Customer> <http://www.w3.org/2000/01/rdf-schema#label> \"Customer\" .";
          case JSON_LD -> """
              {"@id":"https://example.org/Customer","@type":"http://www.w3.org/2002/07/owl#Class","http://www.w3.org/2000/01/rdf-schema#label":"Customer"}
              """;
        };
    final var model = importer.parse(data, format);
    try {
      assertEquals(0, importer.reconcile(model, snapshot).getOperations().size());
    } finally {
      model.close();
    }
  }

  @Test
  void rejectsUnrepresentedTripleInsteadOfLosingIt() {
    final var root = root();
    final var snapshot =
        new OntologyWorkingSnapshot.Snapshot(
            state(root), List.of(new OntologyWorkingSnapshot.Entry(MemberKind.ONTOLOGY, root)));
    final var model =
        importer.parse(
            "<https://example.org/Customer> <https://example.org/unknown> \"lost\" .",
            RdfSerializationFormat.N_TRIPLES);
    try {
      assertThrows(BadRequestException.class, () -> importer.reconcile(model, snapshot));
    } finally {
      model.close();
    }
  }

  @Test
  void unsupportedStatementDiagnosticIsBounded() {
    final var root = root();
    final var snapshot =
        new OntologyWorkingSnapshot.Snapshot(
            state(root), List.of(new OntologyWorkingSnapshot.Entry(MemberKind.ONTOLOGY, root)));
    final var model =
        importer.parse(
            "<https://example.org/C> <https://example.org/unknown> \""
                + "x".repeat(10_000)
                + "\" .",
            RdfSerializationFormat.N_TRIPLES);
    try {
      final var error =
          assertThrows(BadRequestException.class, () -> importer.reconcile(model, snapshot));
      assertTrue(error.getMessage().length() < 300);
    } finally {
      model.close();
    }
  }

  @Test
  void sourceOntologyHeaderDoesNotReplaceTargetOrHideUnlabeledDeclarations() {
    final var root = root();
    final var snapshot =
        new OntologyWorkingSnapshot.Snapshot(
            state(root), List.of(new OntologyWorkingSnapshot.Entry(MemberKind.ONTOLOGY, root)));
    final String rdf =
        """
        <https://external.example/o> a <http://www.w3.org/2002/07/owl#Ontology> .
        <https://external.example/C> a <http://www.w3.org/2002/07/owl#Class> .
        """;
    final var model = importer.parse(rdf, RdfSerializationFormat.TURTLE);
    try {
      final var plan = importer.reconcile(model, snapshot);
      assertEquals(root.getFullyQualifiedName(), plan.getOntology());
      assertEquals(1, plan.getOperations().size());
      assertEquals(
          "https://external.example/C",
          plan.getOperations().getFirst().getConcept().getIri().toString());
      assertTrue(plan.getOperations().getFirst().getConcept().getName().startsWith("imported-C-"));
      assertEquals(
          root.getFullyQualifiedName()
              + "."
              + plan.getOperations().getFirst().getConcept().getName(),
          plan.getOperations().getFirst().getConcept().getFullyQualifiedName());
      assertEquals(0.1, plan.getOperations().getFirst().getConcept().getVersion());
    } finally {
      model.close();
    }
  }

  @Test
  void unrelatedUnlabeledClassInNativeExportIsImported() {
    final var root = root();
    final var snapshot =
        new OntologyWorkingSnapshot.Snapshot(
            state(root), List.of(new OntologyWorkingSnapshot.Entry(MemberKind.ONTOLOGY, root)));
    final String rdf =
        """
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix dct: <http://purl.org/dc/terms/> .
        <https://external.example/o> a owl:Ontology; owl:versionIRI <urn:version> .
        <https://external.example/C> a owl:Class; rdfs:label "C" .
        [] a owl:Axiom; owl:annotatedSource <https://external.example/C>;
           owl:annotatedProperty rdfs:label; owl:annotatedTarget "C";
           dct:source <urn:version:CONCEPT:00000000-0000-0000-0000-000000000001> .
        <https://external.example/New> a owl:Class .
        """;
    final var model = importer.parse(rdf, RdfSerializationFormat.TURTLE);
    try {
      final var plan = importer.reconcile(model, snapshot);
      assertEquals(2, plan.getOperations().size());
      assertTrue(
          plan.getOperations().stream()
              .anyMatch(
                  operation ->
                      "https://external.example/New"
                          .equals(operation.getConcept().getIri().toString())));
    } finally {
      model.close();
    }
  }

  @Test
  void malformedResourcePositionsAndAnnotationDatatypesFailAsBadRequests() {
    final var root = root();
    final var snapshot =
        new OntologyWorkingSnapshot.Snapshot(
            state(root), List.of(new OntologyWorkingSnapshot.Entry(MemberKind.ONTOLOGY, root)));
    final List<String> invalid =
        List.of(
            """
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        <https://example.org/C> a owl:Class .
        [] a owl:Axiom; owl:annotatedSource "bad";
           owl:annotatedProperty <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>;
           owl:annotatedTarget owl:Class .
        """,
            """
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        <https://example.org/p> a owl:ObjectProperty; rdfs:range "bad" .
        """,
            """
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        <https://example.org/C> a owl:Class; rdfs:label "1"^^xsd:integer .
        """,
            """
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix om: <https://open-metadata.org/ontology/> .
        <https://example.org/p> a owl:DatatypeProperty;
          <https://open-metadata.org/ontology/identifierIntent> "true"^^<http://www.w3.org/2001/XMLSchema#string> .
        """);
    for (final String rdf : invalid) {
      final var model = importer.parse(rdf, RdfSerializationFormat.TURTLE);
      try {
        assertThrows(BadRequestException.class, () -> importer.reconcile(model, snapshot));
      } finally {
        model.close();
      }
    }
  }

  @Test
  void caseDistinctIrisStayDistinct() {
    final var root = root();
    final var existing =
        new OntologyConcept()
            .withId(UUID.randomUUID())
            .withName("Upper")
            .withOntology(root.getEntityReference())
            .withIri(URI.create("HTTPS://EXAMPLE.org/C"))
            .withConceptType(OntologyConceptType.OWL_CLASS);
    final var snapshot =
        new OntologyWorkingSnapshot.Snapshot(
            state(root),
            List.of(
                new OntologyWorkingSnapshot.Entry(MemberKind.ONTOLOGY, root),
                new OntologyWorkingSnapshot.Entry(MemberKind.CONCEPT, existing)));
    final var model =
        importer.parse(
            "<https://example.org/C> a <http://www.w3.org/2002/07/owl#Class> .",
            RdfSerializationFormat.TURTLE);
    try {
      assertEquals(1, importer.reconcile(model, snapshot).getOperations().size());
    } finally {
      model.close();
    }
  }

  private static Ontology root() {
    return new Ontology()
        .withId(UUID.randomUUID())
        .withName("Imported")
        .withFullyQualifiedName("Imported")
        .withIri(ROOT_IRI);
  }

  private static OntologyState state(Ontology root) {
    return new OntologyState()
        .withOntologyId(root.getId())
        .withWorkingRevision(3L)
        .withActivationRevision(1L)
        .withLastReleaseRevision(1L);
  }
}
