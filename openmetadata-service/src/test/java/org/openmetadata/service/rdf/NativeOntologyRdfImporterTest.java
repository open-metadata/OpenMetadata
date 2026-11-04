package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.ArrayList;
import java.util.Collections;
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
import org.openmetadata.schema.api.data.NativeOntologyImportFormat;
import org.openmetadata.schema.api.data.NativeOntologyImportPreview;
import org.openmetadata.schema.api.data.PreviewNativeOntologyImport;
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
import org.openmetadata.service.ontology.NativeOntologyDocument;
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

  @ParameterizedTest
  @EnumSource(
      value = NativeOntologyImportFormat.class,
      names = {"CSV", "TURTLE"})
  void metadataOnlyUpdatesClearAndRepeatWithoutMutatingTheSnapshot(
      NativeOntologyImportFormat format) {
    final var root = root();
    final var initial = imported(root, METADATA_BASE);
    final String before = JsonUtils.pojoToJson(initial);
    final var richSource = importer.read(metadataRequest(format, true));
    final var rich = importer.preview(richSource, initial);
    assertEquals(1, rich.getSummary().getCounts().getUpdatedConcepts());
    assertEquals(1, rich.getSummary().getCounts().getUpdatedProperties());
    assertEquals(2, rich.getSummary().getCounts().getSkippedDefinitions());
    assertEquals(2, rich.getChangeSet().getOperations().size());
    final var concept =
        rich.getChangeSet().getOperations().stream()
            .map(OntologyChangeOperation::getConcept)
            .filter(Objects::nonNull)
            .findFirst()
            .orElseThrow();
    final var property =
        rich.getChangeSet().getOperations().stream()
            .map(OntologyChangeOperation::getProperty)
            .filter(Objects::nonNull)
            .findFirst()
            .orElseThrow();
    assertEquals(Boolean.TRUE, concept.getAbstract());
    assertEquals(URI.create("https://example.org/standard"), concept.getDefinitionSource());
    assertEquals(Boolean.TRUE, concept.getDeprecated());
    assertEquals(URI.create("https://example.org/Account"), concept.getReplacedBy());
    assertEquals(Boolean.TRUE, property.getDeprecated());
    assertEquals(URI.create("https://example.org/identifier"), property.getReplacedBy());
    assertEquals(before, JsonUtils.pojoToJson(initial));

    final var richSnapshot = imported(root, METADATA_BASE + METADATA_ANNOTATIONS);
    assertEquals(
        0, importer.preview(richSource, richSnapshot).getChangeSet().getOperations().size());
    final var cleared =
        importer.preview(importer.read(metadataRequest(format, false)), richSnapshot);
    assertEquals(1, cleared.getSummary().getCounts().getUpdatedConcepts());
    assertEquals(1, cleared.getSummary().getCounts().getUpdatedProperties());
    assertEquals(2, cleared.getChangeSet().getOperations().size());
    final var clearedConcept =
        cleared.getChangeSet().getOperations().stream()
            .map(OntologyChangeOperation::getConcept)
            .filter(Objects::nonNull)
            .findFirst()
            .orElseThrow();
    final var clearedProperty =
        cleared.getChangeSet().getOperations().stream()
            .map(OntologyChangeOperation::getProperty)
            .filter(Objects::nonNull)
            .findFirst()
            .orElseThrow();
    assertEquals(Boolean.FALSE, clearedConcept.getAbstract());
    assertNull(clearedConcept.getDefinitionSource());
    assertEquals(Boolean.FALSE, clearedConcept.getDeprecated());
    assertNull(clearedConcept.getReplacedBy());
    assertEquals(Boolean.FALSE, clearedProperty.getDeprecated());
    assertNull(clearedProperty.getReplacedBy());
    assertEquals(
        0,
        importer
            .preview(importer.read(metadataRequest(format, false)), initial)
            .getChangeSet()
            .getOperations()
            .size());
  }

  private static final String METADATA_BASE =
      """
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix om: <https://open-metadata.org/ontology/> .
      @prefix dct: <http://purl.org/dc/terms/> .
      <https://example.org/Customer> a owl:Class .
      <https://example.org/Account> a owl:Class .
      <https://example.org/code> a owl:DatatypeProperty .
      <https://example.org/identifier> a owl:DatatypeProperty .
      """;
  private static final String METADATA_ANNOTATIONS =
      """
      <https://example.org/Customer> om:abstract true; dct:source <https://example.org/standard>;
        owl:deprecated true; dct:isReplacedBy <https://example.org/Account> .
      <https://example.org/code> owl:deprecated true; dct:isReplacedBy <https://example.org/identifier> .
      """;

  private static PreviewNativeOntologyImport metadataRequest(
      NativeOntologyImportFormat format, boolean populated) {
    if (format == NativeOntologyImportFormat.TURTLE) {
      return turtleRequest(METADATA_BASE + (populated ? METADATA_ANNOTATIONS : ""));
    }
    final String header =
        "kind,iri,label,description,conceptType,parents,synonyms,mappings,propertyKind,domain,range,enumValues,unit,identifier,inverse,characteristics,propertyChain,disjointWith,axiomType,property,target,literal,expressions,abstract,definitionSource,deprecated,replacedBy";
    final List<String> rows = new ArrayList<>();
    rows.add(header);
    for (final String name : List.of("Customer", "Account", "code", "identifier")) {
      final boolean concept = name.equals("Customer") || name.equals("Account");
      final var cells = new ArrayList<>(Collections.nCopies(27, ""));
      cells.set(0, concept ? "CONCEPT" : "PROPERTY");
      cells.set(1, "https://example.org/" + name);
      cells.set(concept ? 4 : 8, concept ? "OWL_CLASS" : "DATA");
      if (populated && name.equals("Customer")) {
        cells.set(23, "true");
        cells.set(24, "https://example.org/standard");
        cells.set(25, "true");
        cells.set(26, "https://example.org/Account");
      }
      if (populated && name.equals("code")) {
        cells.set(25, "true");
        cells.set(26, "https://example.org/identifier");
      }
      rows.add(String.join(",", cells));
    }
    return new PreviewNativeOntologyImport()
        .withFormat(format)
        .withData(String.join("\r\n", rows) + "\r\n");
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

  @Test
  void previewCountsEveryParsedDefinitionOnceByKindAndOutcome() {
    final var root = root();
    final var source = importer.read(turtleRequest(NEXT_TURTLE));

    final var preview = importer.preview(source, imported(root, BASE_TURTLE));

    final var counts = preview.getSummary().getCounts();
    assertEquals(1, counts.getNewConcepts());
    assertEquals(1, counts.getUpdatedConcepts());
    assertEquals(1, counts.getNewProperties());
    assertEquals(1, counts.getUpdatedProperties());
    assertEquals(1, counts.getNewRelations());
    assertEquals(3, counts.getNewMappings());
    assertEquals(2, counts.getSkippedDefinitions());
    assertEquals(1, counts.getSkippedRelations());
    assertEquals(NativeOntologyImportFormat.TURTLE, preview.getSummary().getDetectedFormat());
    assertEquals(5, preview.getChangeSet().getOperations().size());
    assertEquals(root.getFullyQualifiedName(), preview.getChangeSet().getOntology());
    assertCountInvariants(source.document(), preview);
  }

  @Test
  void summarizeAndPreviewAgreeOnAnEmptyTarget() {
    final var source = importer.read(turtleRequest(NEXT_TURTLE));

    final var summary = importer.summarize(source);
    final var preview = importer.preview(source, emptySnapshot(root()));

    assertEquals(summary, preview.getSummary());
    final var counts = summary.getCounts();
    assertEquals(3, counts.getNewConcepts());
    assertEquals(0, counts.getUpdatedConcepts());
    assertEquals(3, counts.getNewProperties());
    assertEquals(0, counts.getUpdatedProperties());
    assertEquals(2, counts.getNewRelations());
    assertEquals(4, counts.getNewMappings());
    assertEquals(0, counts.getSkippedDefinitions());
    assertEquals(0, counts.getSkippedRelations());
    assertEquals(8, preview.getChangeSet().getOperations().size());
    assertCountInvariants(source.document(), preview);
  }

  @Test
  void reimportingTheSameFileSkipsEverything() {
    final var root = root();
    final var source = importer.read(turtleRequest(BASE_TURTLE));

    final var preview = importer.preview(source, imported(root, BASE_TURTLE));

    final var counts = preview.getSummary().getCounts();
    assertEquals(0, counts.getNewConcepts() + counts.getUpdatedConcepts());
    assertEquals(0, counts.getNewProperties() + counts.getUpdatedProperties());
    assertEquals(0, counts.getNewRelations());
    assertEquals(0, counts.getNewMappings());
    assertEquals(4, counts.getSkippedDefinitions());
    assertEquals(1, counts.getSkippedRelations());
    assertEquals(0, preview.getChangeSet().getOperations().size());
    assertCountInvariants(source.document(), preview);
  }

  @Test
  void ontologyLabelComesFromASingleHeaderOnly() {
    final String prefixes =
        """
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        <https://example.org/C> a owl:Class .
        """;
    final String oneHeader =
        prefixes + "<https://example.org/o> a owl:Ontology ; rdfs:label \"Finance\" .\n";
    final String twoHeaders =
        oneHeader + "<https://example.org/o2> a owl:Ontology ; rdfs:label \"Risk\" .\n";

    assertEquals(
        "Finance", importer.summarize(importer.read(turtleRequest(oneHeader))).getOntologyLabel());
    assertNull(importer.summarize(importer.read(turtleRequest(twoHeaders))).getOntologyLabel());
    assertNull(importer.summarize(importer.read(turtleRequest(prefixes))).getOntologyLabel());
  }

  @Test
  void previewLeavesTheParsedDocumentUnchanged() {
    final var root = root();
    final var source = importer.read(turtleRequest(NEXT_TURTLE));
    final String before = JsonUtils.pojoToJson(source.document());

    final var preview = importer.preview(source, imported(root, BASE_TURTLE));

    assertEquals(before, JsonUtils.pojoToJson(source.document()));
    assertNull(source.document().concepts().getFirst().getId());
    assertNull(source.document().axioms().getFirst().getName());
    assertEquals(5, preview.getChangeSet().getOperations().size());
    importer.preview(source, emptySnapshot(root));
    assertEquals(before, JsonUtils.pojoToJson(source.document()));
  }

  @Test
  void changeSetNamesTheSourceFamily() {
    final var root = root();
    final var document = importer.read(turtleRequest(BASE_TURTLE)).document();
    final var csv = new NativeOntologyRdfImporter.Source(NativeOntologyImportFormat.CSV, document);

    final var preview = importer.preview(csv, emptySnapshot(root));

    assertEquals(NativeOntologyImportFormat.CSV, preview.getSummary().getDetectedFormat());
    assertEquals("Native CSV import", preview.getChangeSet().getDisplayName());
    assertEquals("Native CSV import preview", preview.getChangeSet().getDescription());
    final var axiom = axiomOperations(preview.getChangeSet()).getFirst().getAxiom();
    assertEquals("Imported from native CSV", axiom.getDescription());
    assertEquals("Imported subclass of", axiom.getDisplayName());
    final var rdf =
        importer.preview(importer.read(turtleRequest(BASE_TURTLE)), emptySnapshot(root));
    assertEquals("Native RDF import", rdf.getChangeSet().getDisplayName());
    assertEquals(
        "Imported from native RDF",
        axiomOperations(rdf.getChangeSet()).getFirst().getAxiom().getDescription());
  }

  @Test
  void bothPreviewsRefuseMoreThanOneThousandChangedDefinitions() {
    final var atLimit = importer.read(turtleRequest(classes(1000)));
    final var pastLimit = importer.read(turtleRequest(classes(1001)));

    assertEquals(1000, importer.summarize(atLimit).getCounts().getNewConcepts());
    assertEquals(
        1000,
        importer.preview(atLimit, emptySnapshot(root())).getSummary().getCounts().getNewConcepts());
    final String message = "A native import accepts at most 1000 changed definitions";
    assertEquals(
        message,
        assertThrows(BadRequestException.class, () -> importer.summarize(pastLimit)).getMessage());
    assertEquals(
        message,
        assertThrows(
                BadRequestException.class, () -> importer.preview(pastLimit, emptySnapshot(root())))
            .getMessage());
  }

  @Test
  void aRequestWithoutARecognizableFormatNamesTheFiveFormats() {
    final var request = new PreviewNativeOntologyImport().withData("not an ontology");

    assertEquals(
        "Specify format as one of turtle, rdfxml, ntriples, jsonld, or csv",
        assertThrows(BadRequestException.class, () -> importer.read(request)).getMessage());
  }

  private static final String COUNT_PREFIXES =
      """
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
      @prefix ex: <https://example.org/counts/> .
      """;
  private static final String BASE_TURTLE =
      COUNT_PREFIXES
          + """
          ex:A a owl:Class ; rdfs:label "A" .
          ex:B a owl:Class ; rdfs:label "B" ; skos:exactMatch <https://external.example/B1> .
          ex:p a owl:ObjectProperty ; rdfs:label "p" ; rdfs:domain ex:A ; rdfs:range ex:B .
          ex:q a owl:DatatypeProperty ; rdfs:label "q" ; rdfs:comment "Before" .
          ex:A rdfs:subClassOf ex:B .
          """;
  private static final String NEXT_TURTLE =
      COUNT_PREFIXES
          + """
          ex:A a owl:Class ; rdfs:label "A" .
          ex:B a owl:Class ; rdfs:label "B renamed" ;
            skos:exactMatch <https://external.example/B1> ;
            skos:closeMatch <https://external.example/B2> .
          ex:C a owl:Class ; rdfs:label "C" ;
            skos:exactMatch <https://external.example/C1> ;
            skos:relatedMatch <https://external.example/C2> .
          ex:p a owl:ObjectProperty ; rdfs:label "p" ; rdfs:domain ex:A ; rdfs:range ex:B .
          ex:q a owl:DatatypeProperty ; rdfs:label "q" ; rdfs:comment "After" .
          ex:r a owl:ObjectProperty ; rdfs:label "r" .
          ex:A rdfs:subClassOf ex:B .
          ex:C rdfs:subClassOf ex:A .
          """;

  private static String classes(int count) {
    final StringBuilder turtle = new StringBuilder();
    for (int index = 0; index < count; index++) {
      turtle
          .append("<https://example.org/big/C")
          .append(index)
          .append("> a <http://www.w3.org/2002/07/owl#Class> .\n");
    }
    return turtle.toString();
  }

  private static PreviewNativeOntologyImport turtleRequest(String turtle) {
    return new PreviewNativeOntologyImport()
        .withFormat(NativeOntologyImportFormat.TURTLE)
        .withData(turtle);
  }

  private static OntologyWorkingSnapshot.Snapshot emptySnapshot(Ontology root) {
    return new OntologyWorkingSnapshot.Snapshot(
        state(root), List.of(new OntologyWorkingSnapshot.Entry(MemberKind.ONTOLOGY, root)));
  }

  /** The snapshot a target holds after the planned import of {@code turtle} has been applied. */
  private OntologyWorkingSnapshot.Snapshot imported(Ontology root, String turtle) {
    final var plan = importer.preview(importer.read(turtleRequest(turtle)), emptySnapshot(root));
    final var entries = new ArrayList<OntologyWorkingSnapshot.Entry>();
    entries.add(new OntologyWorkingSnapshot.Entry(MemberKind.ONTOLOGY, root));
    for (final OntologyChangeOperation operation : plan.getChangeSet().getOperations()) {
      entries.add(
          switch (operation.getOperationType()) {
            case UPSERT_CONCEPT -> new OntologyWorkingSnapshot.Entry(
                MemberKind.CONCEPT, operation.getConcept());
            case UPSERT_PROPERTY -> new OntologyWorkingSnapshot.Entry(
                MemberKind.PROPERTY, operation.getProperty());
            case UPSERT_AXIOM -> new OntologyWorkingSnapshot.Entry(
                MemberKind.AXIOM, operation.getAxiom());
            default -> throw new IllegalStateException(
                "Import plans only upsert: " + operation.getOperationType());
          });
    }
    return new OntologyWorkingSnapshot.Snapshot(state(root), entries);
  }

  private static List<OntologyChangeOperation> axiomOperations(CreateOntologyChangeSet plan) {
    return plan.getOperations().stream()
        .filter(
            operation -> operation.getOperationType() == OntologyChangeOperationType.UPSERT_AXIOM)
        .toList();
  }

  private static void assertCountInvariants(
      NativeOntologyDocument document, NativeOntologyImportPreview preview) {
    final var counts = preview.getSummary().getCounts();
    assertEquals(
        document.concepts().size() + document.properties().size(),
        counts.getNewConcepts()
            + counts.getUpdatedConcepts()
            + counts.getNewProperties()
            + counts.getUpdatedProperties()
            + counts.getSkippedDefinitions(),
        "concepts + properties = new + updated + skipped definitions");
    assertEquals(
        document.axioms().size(),
        counts.getNewRelations() + counts.getSkippedRelations(),
        "axioms = new + skipped relations");
    assertEquals(
        preview.getChangeSet().getOperations().size(),
        counts.getNewConcepts()
            + counts.getUpdatedConcepts()
            + counts.getNewProperties()
            + counts.getUpdatedProperties()
            + counts.getNewRelations(),
        "operations = new + updated definitions + new relations");
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
