package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import org.apache.jena.vocabulary.SKOS;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.api.data.ConceptMapping.ConceptMappingType;
import org.openmetadata.schema.api.data.CreateOntologyChangeSet;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.ontology.OntologyPackCatalog;
import org.openmetadata.service.ontology.OntologyPackContentLoader;
import org.openmetadata.service.ontology.OntologyWorkingSnapshot;

class NativeOntologyRdfImporterTest {
  private static final URI ROOT_IRI = URI.create("https://example.org/ontology");
  private static final URI CONCEPT_IRI = URI.create("https://example.org/Customer");
  private final NativeOntologyRdfImporter importer = new NativeOntologyRdfImporter();

  @Test
  void bundledPacksPreviewAsNativeConceptsAndExactSkosRelations() {
    final var catalog = new OntologyPackCatalog(getClass().getClassLoader());
    final var loader = new OntologyPackContentLoader(getClass().getClassLoader());
    for (final var pack : catalog.list()) {
      if (!Boolean.TRUE.equals(pack.getBundled())) {
        continue;
      }
      final String rdf =
          pack.getModules().stream()
              .map(module -> loader.load(module.getResourcePath()).body())
              .collect(Collectors.joining("\n"));
      final var model = importer.parse(rdf, RdfSerializationFormat.TURTLE);
      try {
        final var root = root();
        final var snapshot =
            new OntologyWorkingSnapshot.Snapshot(
                state(root), List.of(new OntologyWorkingSnapshot.Entry(MemberKind.ONTOLOGY, root)));
        final var plan = importer.reconcile(model, snapshot);
        final var concepts =
            plan.getOperations().stream()
                .filter(
                    operation ->
                        operation.getOperationType() == OntologyChangeOperationType.UPSERT_CONCEPT)
                .toList();
        final var relations =
            plan.getOperations().stream()
                .filter(
                    operation ->
                        operation.getOperationType() == OntologyChangeOperationType.UPSERT_AXIOM)
                .toList();
        assertEquals(
            pack.getModules().stream().mapToInt(module -> module.getConceptCount()).sum(),
            concepts.size(),
            pack.getId());
        assertEquals(
            pack.getModules().stream().mapToInt(module -> module.getRelationshipCount()).sum(),
            relations.size(),
            pack.getId());
        assertEquals(concepts.size() + relations.size(), plan.getOperations().size());
        assertTrue(
            concepts.stream()
                .allMatch(operation -> operation.getConcept().getDisplayName() != null));
        assertTrue(
            relations.stream()
                .allMatch(
                    operation ->
                        operation.getAxiom().getAxiomType()
                                == OntologyAxiomType.OBJECT_PROPERTY_ASSERTION
                            && SKOS.broader
                                .getURI()
                                .equals(operation.getAxiom().getPropertyIri().toString())));
        final var entries = new ArrayList<>(snapshot.entries());
        concepts.forEach(
            operation ->
                entries.add(
                    new OntologyWorkingSnapshot.Entry(MemberKind.CONCEPT, operation.getConcept())));
        relations.forEach(
            operation ->
                entries.add(
                    new OntologyWorkingSnapshot.Entry(MemberKind.AXIOM, operation.getAxiom())));
        assertEquals(
            0,
            importer
                .reconcile(model, new OntologyWorkingSnapshot.Snapshot(state(root), entries))
                .getOperations()
                .size());
      } finally {
        model.close();
      }
    }
  }

  @Test
  void matchingPlainSkosAndRdfsAnnotationsAreConsumedTogether() {
    final var root = root();
    final var snapshot =
        new OntologyWorkingSnapshot.Snapshot(
            state(root), List.of(new OntologyWorkingSnapshot.Entry(MemberKind.ONTOLOGY, root)));
    final var model =
        importer.parse(
            """
        @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        <https://example.org/C> a skos:Concept; skos:prefLabel "Customer"; rdfs:label "Customer";
          skos:definition "A customer."; rdfs:comment "A customer." .
        """,
            RdfSerializationFormat.TURTLE);
    try {
      final var concept =
          importer.reconcile(model, snapshot).getOperations().getFirst().getConcept();
      assertEquals("Customer", concept.getDisplayName());
      assertEquals("A customer.", concept.getDescription());
    } finally {
      model.close();
    }
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "skos:prefLabel \"Customer\"; rdfs:label \"Conflicting\"",
        "skos:prefLabel \"Customer\", \"Conflicting\"",
        "skos:prefLabel \"Customer\"@en",
        "skos:prefLabel 17",
        "skos:definition \"A customer.\"; rdfs:comment \"Conflicting\"",
        "skos:definition \"A customer.\", \"Conflicting\"",
        "skos:definition \"A customer.\"@en",
        "skos:definition 17",
        "skos:hiddenLabel \"Unsupported\""
      })
  void ambiguousOrUnrepresentedSkosAnnotationsFailClosed(String labels) {
    final var root = root();
    final var snapshot =
        new OntologyWorkingSnapshot.Snapshot(
            state(root), List.of(new OntologyWorkingSnapshot.Entry(MemberKind.ONTOLOGY, root)));
    final var model =
        importer.parse(
            """
        @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        <https://example.org/C> a skos:Concept; %s .
        """
                .formatted(labels),
            RdfSerializationFormat.TURTLE);
    try {
      assertThrows(BadRequestException.class, () -> importer.reconcile(model, snapshot));
    } finally {
      model.close();
    }
  }

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

  @ParameterizedTest
  @EnumSource(ConceptMappingType.class)
  void labelChangePreservesAllSavedMappingsForSurvivingKeys(ConceptMappingType type) {
    final var mappings = List.of(richMapping(type, "first"), richMapping(type, "second"));
    final var concept = mappedConcept(mappings);
    final var snapshot = conceptSnapshot(concept);
    final String before = JsonUtils.pojoToJson(concept);
    final String statement =
        "<%s> <https://external.example/Customer>"
            .formatted(OntologyRdfVocabulary.mapping(type).getURI());

    final var operations = mappingPreview(snapshot, "Updated customer", statement).getOperations();

    assertEquals(before, JsonUtils.pojoToJson(concept));
    assertEquals(1, operations.size());
    final var operation = operations.getFirst();
    assertEquals(OntologyChangeOperationType.UPSERT_CONCEPT, operation.getOperationType());
    assertEquals(concept.getId(), operation.getTargetId());
    assertEquals(concept.getVersion(), operation.getBaseVersion());
    assertEquals(concept.getId(), operation.getConcept().getId());
    assertEquals("Updated customer", operation.getConcept().getDisplayName());
    assertEquals(mappings, operation.getConcept().getConceptMappings());
    operation.getConcept().getConceptMappings().getFirst().setSource("Changed preview");
    assertEquals(before, JsonUtils.pojoToJson(concept));
  }

  @Test
  void unchangedRichMappingsReimportIsNoOp() {
    final var concept =
        mappedConcept(
            List.of(
                richMapping(ConceptMappingType.EXACT_MATCH, "first"),
                richMapping(ConceptMappingType.EXACT_MATCH, "second")));
    final var snapshot = conceptSnapshot(concept);
    final String before = JsonUtils.pojoToJson(concept);

    assertEquals(
        0,
        mappingPreview(snapshot, "Customer", "skos:exactMatch <https://external.example/Customer>")
            .getOperations()
            .size());
    assertEquals(before, JsonUtils.pojoToJson(concept));
  }

  @ParameterizedTest
  @CsvSource({
    "closeMatch, https://external.example/Customer, CLOSE_MATCH",
    "exactMatch, https://external.example/Other, EXACT_MATCH"
  })
  void changedMappingTypeOrTargetDoesNotInheritSavedMetadata(
      String predicate, String target, ConceptMappingType type) {
    final var concept =
        mappedConcept(List.of(richMapping(ConceptMappingType.EXACT_MATCH, "saved")));
    final var snapshot = conceptSnapshot(concept);
    final String before = JsonUtils.pojoToJson(concept);
    final var operations =
        mappingPreview(snapshot, "Customer", "skos:%s <%s>".formatted(predicate, target))
            .getOperations();

    assertEquals(1, operations.size());
    assertEquals(
        List.of(new ConceptMapping().withMappingType(type).withConceptIri(URI.create(target))),
        operations.getFirst().getConcept().getConceptMappings());
    assertEquals(before, JsonUtils.pojoToJson(concept));
  }

  @Test
  void mappingAdditionsAndRemovalsKeepOnlySurvivingSavedMetadata() {
    final var retained = richMapping(ConceptMappingType.EXACT_MATCH, "retained");
    final var removed = richMapping(ConceptMappingType.CLOSE_MATCH, "removed");
    final var concept = mappedConcept(List.of(retained, removed));
    final var snapshot = conceptSnapshot(concept);
    final String before = JsonUtils.pojoToJson(concept);
    final var operations =
        mappingPreview(
                snapshot,
                "Customer",
                "skos:exactMatch <https://external.example/Customer>; "
                    + "skos:relatedMatch <https://external.example/Other>")
            .getOperations();

    assertEquals(1, operations.size());
    final var mappings = operations.getFirst().getConcept().getConceptMappings();
    assertEquals(2, mappings.size());
    assertTrue(mappings.contains(retained));
    assertTrue(
        mappings.contains(
            new ConceptMapping()
                .withMappingType(ConceptMappingType.RELATED_MATCH)
                .withConceptIri(URI.create("https://external.example/Other"))));
    assertEquals(before, JsonUtils.pojoToJson(concept));
  }

  @Test
  void removingAllRdfMappingsRemovesSavedMappings() {
    final var concept =
        mappedConcept(List.of(richMapping(ConceptMappingType.EXACT_MATCH, "saved")));
    final var snapshot = conceptSnapshot(concept);
    final String before = JsonUtils.pojoToJson(concept);
    final var operations = mappingPreview(snapshot, "Customer", "").getOperations();

    assertEquals(1, operations.size());
    assertTrue(operations.getFirst().getConcept().getConceptMappings().isEmpty());
    assertEquals(before, JsonUtils.pojoToJson(concept));
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
  void classModelAnnotationsImportAsClassAndPropertyFields() {
    final var root = root();
    final var snapshot =
        new OntologyWorkingSnapshot.Snapshot(
            state(root), List.of(new OntologyWorkingSnapshot.Entry(MemberKind.ONTOLOGY, root)));
    final var model =
        importer.parse(
            """
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix dct: <http://purl.org/dc/terms/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        @prefix om: <https://open-metadata.org/ontology/> .
        <https://example.org/Customer> a owl:Class; om:abstract true;
          dct:source <https://standards.example.org/party>; owl:deprecated true;
          dct:isReplacedBy <https://example.org/Account> .
        <https://example.org/Account> a owl:Class; owl:deprecated false .
        <https://example.org/code> a owl:DatatypeProperty; owl:deprecated "1"^^xsd:boolean;
          dct:isReplacedBy <https://example.org/identifier> .
        <https://example.org/identifier> a owl:DatatypeProperty .
        """,
            RdfSerializationFormat.TURTLE);
    try {
      final var operations = importer.reconcile(model, snapshot).getOperations();
      final var concepts =
          operations.stream()
              .map(OntologyChangeOperation::getConcept)
              .filter(Objects::nonNull)
              .collect(Collectors.toMap(concept -> concept.getIri().toString(), c -> c));
      final var customer = concepts.get("https://example.org/Customer");
      assertEquals(Boolean.TRUE, customer.getAbstract());
      assertEquals(
          URI.create("https://standards.example.org/party"), customer.getDefinitionSource());
      assertEquals(Boolean.TRUE, customer.getDeprecated());
      assertEquals(URI.create("https://example.org/Account"), customer.getReplacedBy());
      final var account = concepts.get("https://example.org/Account");
      assertEquals(Boolean.FALSE, account.getAbstract());
      assertNull(account.getDefinitionSource());
      assertEquals(Boolean.FALSE, account.getDeprecated());
      assertNull(account.getReplacedBy());
      final var code =
          operations.stream()
              .map(OntologyChangeOperation::getProperty)
              .filter(
                  property ->
                      property != null
                          && "https://example.org/code".equals(property.getIri().toString()))
              .findFirst()
              .orElseThrow();
      assertEquals(Boolean.TRUE, code.getDeprecated());
      assertEquals(URI.create("https://example.org/identifier"), code.getReplacedBy());
    } finally {
      model.close();
    }
  }

  @ParameterizedTest
  @CsvSource(
      delimiter = '|',
      value = {
        "owl:deprecated \"yes\" | http://www.w3.org/2002/07/owl#deprecated requires an xsd:boolean value",
        "om:abstract \"true\" | https://open-metadata.org/ontology/abstract requires an xsd:boolean value",
        "om:abstract \"2\"^^xsd:boolean | https://open-metadata.org/ontology/abstract requires an xsd:boolean value",
        "dct:source \"ISO 8000\" | Expected an absolute RDF IRI",
        "dct:isReplacedBy \"Account\" | Expected an absolute RDF IRI"
      })
  void classModelAnnotationsRefuseValuesOfTheWrongShape(String statement, String message) {
    final var root = root();
    final var snapshot =
        new OntologyWorkingSnapshot.Snapshot(
            state(root), List.of(new OntologyWorkingSnapshot.Entry(MemberKind.ONTOLOGY, root)));
    final var model =
        importer.parse(
            """
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix dct: <http://purl.org/dc/terms/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        @prefix om: <https://open-metadata.org/ontology/> .
        <https://example.org/Customer> a owl:Class; %s .
        """
                .formatted(statement),
            RdfSerializationFormat.TURTLE);
    try {
      assertEquals(
          message,
          assertThrows(BadRequestException.class, () -> importer.reconcile(model, snapshot))
              .getMessage());
    } finally {
      model.close();
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

  private static ConceptMapping richMapping(ConceptMappingType type, String source) {
    return new ConceptMapping()
        .withMappingType(type)
        .withConceptIri(URI.create("https://external.example/Customer"))
        .withSchemeIri(URI.create("https://external.example/scheme/" + source))
        .withSource(source);
  }

  private static OntologyConcept mappedConcept(List<ConceptMapping> mappings) {
    return new OntologyConcept()
        .withId(UUID.randomUUID())
        .withName("Customer")
        .withFullyQualifiedName("Imported.Customer")
        .withDisplayName("Customer")
        .withIri(CONCEPT_IRI)
        .withConceptType(OntologyConceptType.OWL_CLASS)
        .withConceptMappings(mappings)
        .withVersion(0.3);
  }

  private static OntologyWorkingSnapshot.Snapshot conceptSnapshot(OntologyConcept concept) {
    final var root = root();
    return new OntologyWorkingSnapshot.Snapshot(
        state(root),
        List.of(
            new OntologyWorkingSnapshot.Entry(MemberKind.ONTOLOGY, root),
            new OntologyWorkingSnapshot.Entry(
                MemberKind.CONCEPT, concept.withOntology(root.getEntityReference()))));
  }

  private CreateOntologyChangeSet mappingPreview(
      OntologyWorkingSnapshot.Snapshot snapshot, String label, String statements) {
    final var model =
        importer.parse(
            """
            @prefix owl: <http://www.w3.org/2002/07/owl#> .
            @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
            @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
            <https://example.org/Customer> a owl:Class; rdfs:label "%s"; %s .
            """
                .formatted(label, statements),
            RdfSerializationFormat.TURTLE);
    try {
      return importer.reconcile(model, snapshot);
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
