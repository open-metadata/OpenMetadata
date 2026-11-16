package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.NativeOntologyImportFormat;
import org.openmetadata.schema.api.data.NativeOntologyImportItem;
import org.openmetadata.schema.api.data.NativeOntologyImportItemKind;
import org.openmetadata.schema.api.data.NativeOntologyImportItemStatus;
import org.openmetadata.schema.api.data.NativeOntologyImportPreview;
import org.openmetadata.schema.api.data.NativeOntologyImportSkipReason;
import org.openmetadata.schema.api.data.PreviewNativeOntologyImport;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.service.ontology.NativeOntologyDocument;
import org.openmetadata.service.ontology.OntologyWorkingSnapshot;

/** The per-item review the import dialog shows: one status for every definition a file states. */
class NativeOntologyImportItemsTest {
  private static final URI ROOT_IRI = URI.create("https://example.org/ontology");
  private static final String PREFIXES =
      """
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
      @prefix dct: <http://purl.org/dc/terms/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      @prefix ex: <https://example.org/items/> .
      """;
  private static final String BASE =
      PREFIXES
          + """
          ex:A a owl:Class ; rdfs:label "A" .
          ex:B a owl:Class ; rdfs:label "B" .
          ex:p a owl:ObjectProperty ; rdfs:label "p" ; rdfs:domain ex:A ; rdfs:range ex:B .
          ex:q a owl:DatatypeProperty ; rdfs:label "q" ; rdfs:comment "Before" .
          ex:A rdfs:subClassOf ex:B .
          """;
  private static final String NEXT =
      PREFIXES
          + """
          ex:A a owl:Class ; rdfs:label "A" .
          ex:B a owl:Class ; rdfs:label "B" ; rdfs:comment "Now described" .
          ex:C a owl:Class ; rdfs:label "C" .
          ex:p a owl:ObjectProperty ; rdfs:label "p" ; rdfs:domain ex:A ; rdfs:range ex:B .
          ex:q a owl:DatatypeProperty ; rdfs:label "q" ; rdfs:comment "After" .
          ex:r a owl:ObjectProperty ; rdfs:label "r" .
          ex:A rdfs:subClassOf ex:B .
          ex:C rdfs:subClassOf ex:A .
          """;
  private final NativeOntologyRdfImporter importer = new NativeOntologyRdfImporter();

  @Test
  void everyParsedDefinitionGetsOneStatusAndNewAndUpdateCarryTheirOperation() {
    final Ontology root = root();
    final var preview = importer.preview(read(NEXT), imported(root, BASE));

    final Map<String, NativeOntologyImportItem> byLabel = byLabel(preview);
    assertEquals(NativeOntologyImportItemStatus.ALREADY_EXISTS, byLabel.get("A").getStatus());
    assertEquals(NativeOntologyImportItemStatus.UPDATE, byLabel.get("B").getStatus());
    assertEquals("Description: none → Now described", byLabel.get("B").getDetail());
    assertEquals(NativeOntologyImportItemStatus.NEW, byLabel.get("C").getStatus());
    assertEquals(NativeOntologyImportItemStatus.ALREADY_EXISTS, byLabel.get("p").getStatus());
    assertEquals(NativeOntologyImportItemStatus.UPDATE, byLabel.get("q").getStatus());
    assertEquals("Description: Before → After", byLabel.get("q").getDetail());
    assertEquals(NativeOntologyImportItemStatus.NEW, byLabel.get("r").getStatus());
    assertEquals(NativeOntologyImportItemKind.CONCEPT, byLabel.get("C").getKind());
    assertEquals(NativeOntologyImportItemKind.PROPERTY, byLabel.get("r").getKind());
    assertEquals(
        NativeOntologyImportItemStatus.ALREADY_EXISTS, byLabel.get("A is a kind of B").getStatus());
    assertEquals(NativeOntologyImportItemStatus.NEW, byLabel.get("C is a kind of A").getStatus());
    assertEquals(
        NativeOntologyImportItemKind.RELATIONSHIP, byLabel.get("C is a kind of A").getKind());
    assertEquals(8, preview.getSummary().getItems().size());

    final Set<UUID> operationIds =
        preview.getChangeSet().getOperations().stream()
            .map(OntologyChangeOperation::getId)
            .collect(Collectors.toSet());
    final Set<UUID> itemOperationIds =
        preview.getSummary().getItems().stream()
            .map(NativeOntologyImportItem::getOperationId)
            .filter(java.util.Objects::nonNull)
            .collect(Collectors.toSet());
    assertEquals(operationIds, itemOperationIds);
    assertNull(byLabel.get("A").getOperationId());
    assertNotNull(byLabel.get("C").getOperationId());
  }

  @Test
  void aRelationshipNamesTheNewConceptsItNeedsOnItsItemAndOperation() {
    final var preview = importer.preview(read(NEXT), imported(root(), BASE));

    final NativeOntologyImportItem link = byLabel(preview).get("C is a kind of A");
    assertEquals(List.of(URI.create("https://example.org/items/C")), link.getDependsOnIris());
    final OntologyChangeOperation operation =
        preview.getChangeSet().getOperations().stream()
            .filter(candidate -> candidate.getId().equals(link.getOperationId()))
            .findFirst()
            .orElseThrow();
    assertEquals(
        List.of(URI.create("https://example.org/items/C")), operation.getRequiresConceptIris());
    assertTrue(byLabel(preview).get("C").getDependsOnIris().isEmpty());
  }

  @Test
  void aPropertyNamesTheNewConceptsInItsDomainAndRangeOnItsItemAndOperation() {
    final String file =
        PREFIXES
            + """
              ex:A a owl:Class ; rdfs:label "A" .
              ex:C a owl:Class ; rdfs:label "C" .
              ex:D a owl:Class ; rdfs:label "D" .
              ex:owns a owl:ObjectProperty ; rdfs:label "owns" ; rdfs:domain ex:C ; rdfs:range ex:D .
              ex:tag a owl:DatatypeProperty ; rdfs:label "tag" ; rdfs:domain ex:A ; rdfs:range xsd:string .
              """;
    final var preview =
        importer.preview(
            read(file), imported(root(), PREFIXES + "ex:A a owl:Class ; rdfs:label \"A\" ."));

    final NativeOntologyImportItem owns = byLabel(preview).get("owns");
    assertEquals(
        List.of(
            URI.create("https://example.org/items/C"), URI.create("https://example.org/items/D")),
        owns.getDependsOnIris());
    final OntologyChangeOperation operation =
        preview.getChangeSet().getOperations().stream()
            .filter(candidate -> candidate.getId().equals(owns.getOperationId()))
            .findFirst()
            .orElseThrow();
    assertEquals(owns.getDependsOnIris(), operation.getRequiresConceptIris());
    assertTrue(byLabel(preview).get("tag").getDependsOnIris().isEmpty());
  }

  @Test
  void anAssertionNamesTheNewIndividualItsExpressionPointsAt() {
    final var preview =
        importer.preview(
            read(
                PREFIXES
                    + """
                    ex:A a owl:Class ; rdfs:label "A" .
                    ex:owns a owl:ObjectProperty ; rdfs:label "owns" .
                    ex:i a owl:Class, owl:NamedIndividual ; rdfs:label "i" .
                    ex:A rdfs:subClassOf [ a owl:Restriction ; owl:onProperty ex:owns ; owl:hasValue ex:i ] .
                    """),
            emptySnapshot(root()));

    final var restriction =
        preview.getSummary().getItems().stream()
            .filter(
                item -> item.getDependsOnIris().contains(URI.create("https://example.org/items/i")))
            .toList();
    assertEquals(1, restriction.size(), preview.getSummary().getItems().toString());
    final OntologyChangeOperation operation =
        preview.getChangeSet().getOperations().stream()
            .filter(candidate -> candidate.getId().equals(restriction.getFirst().getOperationId()))
            .findFirst()
            .orElseThrow();
    assertTrue(
        operation.getRequiresConceptIris().contains(URI.create("https://example.org/items/i")));
  }

  @Test
  void aRuleOverTwoNewConceptsNeedsBothInIriOrder() {
    final var preview =
        importer.preview(
            read(
                PREFIXES
                    + """
                    ex:Y a owl:Class ; rdfs:label "Y" .
                    ex:X a owl:Class ; rdfs:label "X" .
                    ex:X owl:disjointWith ex:Y .
                    """),
            emptySnapshot(root()));

    assertEquals(
        List.of(
            URI.create("https://example.org/items/X"), URI.create("https://example.org/items/Y")),
        byLabel(preview).get("X is disjoint with Y").getDependsOnIris());
  }

  @Test
  void itemIdsFollowTheContentSoASelectionSurvivesASecondPreview() {
    final Ontology root = root();

    final var first = importer.preview(read(NEXT), emptySnapshot(root));
    final var second = importer.preview(read(NEXT), emptySnapshot(root));

    final List<String> ids =
        first.getSummary().getItems().stream().map(NativeOntologyImportItem::getId).toList();
    assertEquals(
        ids, second.getSummary().getItems().stream().map(NativeOntologyImportItem::getId).toList());
    assertEquals(ids.size(), Set.copyOf(ids).size(), "every id is unique");
    assertTrue(ids.contains("concept:https://example.org/items/C"), ids.toString());
    assertTrue(
        first.getSummary().getItems().stream()
            .map(NativeOntologyImportItem::getOperationId)
            .noneMatch(
                second.getChangeSet().getOperations().stream()
                        .map(OntologyChangeOperation::getId)
                        .collect(Collectors.toSet())
                    ::contains),
        "operation ids are minted per preview");
  }

  @Test
  void importingTheSameFileAgainListsEveryItemAsAlreadyExists() {
    final Ontology root = root();
    final var preview = importer.preview(read(NEXT), imported(root, NEXT));

    assertEquals(8, preview.getSummary().getItems().size());
    assertTrue(
        preview.getSummary().getItems().stream()
            .allMatch(item -> item.getStatus() == NativeOntologyImportItemStatus.ALREADY_EXISTS),
        preview.getSummary().getItems().toString());
    assertEquals(0, preview.getChangeSet().getOperations().size());
  }

  @Test
  void aConceptListedTwiceIsADuplicateAndAddsNoSecondOperation() {
    final OntologyConcept first = concept("https://example.org/items/A", "A");
    final OntologyConcept again = concept("https://example.org/items/A", "A again");
    final var source =
        new NativeOntologyRdfImporter.Source(
            NativeOntologyImportFormat.CSV,
            new NativeOntologyDocument(null, List.of(first, again), List.of(), List.of()));

    final var preview = importer.preview(source, emptySnapshot(root()));

    assertEquals(
        List.of(NativeOntologyImportItemStatus.NEW, NativeOntologyImportItemStatus.DUPLICATE),
        preview.getSummary().getItems().stream().map(NativeOntologyImportItem::getStatus).toList());
    assertEquals(
        "Listed more than once in the file.", preview.getSummary().getItems().get(1).getReason());
    assertEquals(1, preview.getChangeSet().getOperations().size());
    assertEquals(1, preview.getSummary().getCounts().getSkippedDefinitions());
  }

  @Test
  void aRelationshipToAClassNobodyDeclaresIsSkippedWithItsReason() {
    final var preview =
        importer.preview(
            read(
                PREFIXES
                    + """
                    ex:A a owl:Class ; rdfs:label "A" .
                    ex:A rdfs:subClassOf ex:Missing .
                    """),
            emptySnapshot(root()));

    final NativeOntologyImportItem skipped = byLabel(preview).get("A is a kind of Missing");
    assertEquals(NativeOntologyImportItemStatus.SKIPPED, skipped.getStatus());
    assertEquals(
        "Declare or import the referenced class: https://example.org/items/Missing",
        skipped.getReason());
    assertNull(skipped.getOperationId());
    assertEquals(1, preview.getChangeSet().getOperations().size());
    assertEquals(1, preview.getSummary().getCounts().getSkippedRelations());
  }

  @Test
  void disjointnessAndRestrictionsAreRulesAndSubclassLinksAreRelationships() {
    final var preview =
        importer.preview(
            read(
                PREFIXES
                    + """
                    ex:A a owl:Class ; rdfs:label "A" .
                    ex:B a owl:Class ; rdfs:label "B" .
                    ex:p a owl:ObjectProperty ; rdfs:label "p" .
                    ex:A owl:disjointWith ex:B .
                    ex:A rdfs:subClassOf [ a owl:Restriction ; owl:onProperty ex:p ;
                      owl:minCardinality "1"^^xsd:nonNegativeInteger ] .
                    ex:A rdfs:subClassOf ex:B .
                    """),
            emptySnapshot(root()));

    final var kinds =
        preview.getSummary().getItems().stream()
            .filter(item -> item.getKind() == NativeOntologyImportItemKind.RULE)
            .map(NativeOntologyImportItem::getLabel)
            .sorted()
            .toList();
    assertEquals(2, kinds.size(), kinds.toString());
    assertTrue(kinds.stream().anyMatch(label -> label.startsWith("A is disjoint with B")));
    assertEquals(
        1,
        preview.getSummary().getItems().stream()
            .filter(item -> item.getKind() == NativeOntologyImportItemKind.RELATIONSHIP)
            .count());
  }

  @Test
  void aRangeOutsideTheOwlDatatypeMapIsSkippedAndReportedSoApplyNeverRefusesIt() {
    final var preview =
        importer.preview(
            read(
                PREFIXES
                    + """
                    ex:when a owl:DatatypeProperty ; rdfs:label "when" ; rdfs:range xsd:date .
                    """),
            emptySnapshot(root()));

    final var skipped = preview.getSummary().getSkippedStatements();
    assertEquals(1, skipped.getTotal());
    assertEquals(
        NativeOntologyImportSkipReason.UNSUPPORTED_STRUCTURE,
        skipped.getGroups().getFirst().getReason());
    assertEquals(
        "http://www.w3.org/2000/01/rdf-schema#range",
        skipped.getGroups().getFirst().getPredicate());
    assertEquals(1, preview.getSummary().getCounts().getNewProperties());
  }

  @Test
  void aSkosExportImportsAgainWithItsConceptsLabelsAndBroaderLinks() {
    final String skos =
        """
        @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
        @prefix ex: <https://example.org/items/> .
        <https://example.org/items> a skos:ConceptScheme ; skos:prefLabel "Party model" ;
          skos:definition "Who we deal with." .
        ex:Party a skos:Concept ; skos:inScheme <https://example.org/items> ;
          skos:prefLabel "Party" ; skos:definition "A person or organisation." .
        ex:Customer a skos:Concept ; skos:inScheme <https://example.org/items> ;
          skos:prefLabel "Customer" ; skos:altLabel "Client" ; skos:broader ex:Party .
        """;

    final var preview = importer.preview(read(skos), emptySnapshot(root()));

    assertEquals("Party model", preview.getSummary().getOntologyLabel());
    assertEquals(2, preview.getSummary().getCounts().getNewConcepts());
    assertEquals(1, preview.getSummary().getCounts().getNewRelations());
    assertEquals(
        List.of("Customer", "Party"),
        preview.getSummary().getItems().stream()
            .filter(item -> item.getKind() == NativeOntologyImportItemKind.CONCEPT)
            .map(NativeOntologyImportItem::getLabel)
            .sorted()
            .toList());
  }

  @Test
  void importedConceptsAndPropertiesTakeTheirNameFromTheIriLocalName() {
    final var preview = importer.preview(read(NEXT), emptySnapshot(root()));

    final Set<String> names =
        preview.getChangeSet().getOperations().stream()
            .filter(operation -> operation.getConcept() != null)
            .map(operation -> operation.getConcept().getName())
            .collect(Collectors.toSet());
    assertEquals(Set.of("A", "B", "C"), names);
    assertEquals(
        Set.of("p", "q", "r"),
        preview.getChangeSet().getOperations().stream()
            .filter(operation -> operation.getProperty() != null)
            .map(operation -> operation.getProperty().getName())
            .collect(Collectors.toSet()));
  }

  @Test
  void twoIrisWithOneLocalNameGetDistinctNamesAndStillMatchOnIri() {
    final String twin =
        PREFIXES
            + """
            <https://example.org/one/Thing> a owl:Class ; rdfs:label "Thing one" .
            <https://example.org/two/Thing> a owl:Class ; rdfs:label "Thing two" .
            """;
    final Ontology root = root();

    final var preview = importer.preview(read(twin), emptySnapshot(root));

    assertEquals(
        Set.of("Thing", "Thing-2"),
        preview.getChangeSet().getOperations().stream()
            .map(operation -> operation.getConcept().getName())
            .collect(Collectors.toSet()));
    final var again = importer.preview(read(twin), imported(root, twin));
    assertTrue(
        again.getSummary().getItems().stream()
            .allMatch(item -> item.getStatus() == NativeOntologyImportItemStatus.ALREADY_EXISTS));
  }

  @Test
  void aConceptWhoseLocalNameIsTakenByAnotherIriStillImports() {
    final Ontology root = root();
    final var held = imported(root, PREFIXES + "<https://example.org/one/A> a owl:Class .\n");

    final var preview =
        importer.preview(read(PREFIXES + "<https://example.org/two/A> a owl:Class .\n"), held);

    assertEquals("A-2", preview.getChangeSet().getOperations().getFirst().getConcept().getName());
  }

  @Test
  void anImportThatCreatesADisjointnessClashWarnsOnItsItemsAndNamesTheConcepts() {
    final var preview =
        importer.preview(
            read(
                PREFIXES
                    + """
                    ex:Animal a owl:Class ; rdfs:label "Animal" .
                    ex:Plant a owl:Class ; rdfs:label "Plant" .
                    ex:Both a owl:Class ; rdfs:label "Both" .
                    ex:Animal owl:disjointWith ex:Plant .
                    ex:Both rdfs:subClassOf ex:Animal .
                    ex:Both rdfs:subClassOf ex:Plant .
                    """),
            emptySnapshot(root()));

    final var warned =
        preview.getSummary().getItems().stream().filter(item -> item.getWarning() != null).toList();
    assertFalse(warned.isEmpty(), preview.getSummary().getItems().toString());
    assertTrue(
        warned.stream()
            .allMatch(
                item -> item.getWarning().equals("Both has disjoint ancestors Animal and Plant")),
        warned.toString());
    final var conceptIds =
        preview.getChangeSet().getOperations().stream()
            .filter(operation -> operation.getConcept() != null)
            .collect(Collectors.toMap(o -> o.getConcept().getName(), o -> o.getConcept().getId()));
    assertEquals(
        List.of(conceptIds.get("Both"), conceptIds.get("Animal"), conceptIds.get("Plant")),
        warned.getFirst().getConceptIds());
  }

  private NativeOntologyRdfImporter.Source read(final String turtle) {
    return importer.read(
        new PreviewNativeOntologyImport()
            .withFormat(NativeOntologyImportFormat.TURTLE)
            .withData(turtle));
  }

  private static Map<String, NativeOntologyImportItem> byLabel(
      final NativeOntologyImportPreview preview) {
    return preview.getSummary().getItems().stream()
        .collect(Collectors.toMap(NativeOntologyImportItem::getLabel, item -> item));
  }

  private static OntologyConcept concept(final String iri, final String label) {
    return new OntologyConcept()
        .withIri(URI.create(iri))
        .withConceptType(OntologyConceptType.OWL_CLASS)
        .withDisplayName(label);
  }

  private static OntologyWorkingSnapshot.Snapshot emptySnapshot(final Ontology root) {
    return new OntologyWorkingSnapshot.Snapshot(
        state(root), List.of(new OntologyWorkingSnapshot.Entry(MemberKind.ONTOLOGY, root)));
  }

  /** The snapshot a target holds after the planned import of {@code turtle} has been applied. */
  private OntologyWorkingSnapshot.Snapshot imported(final Ontology root, final String turtle) {
    final var plan = importer.preview(read(turtle), emptySnapshot(root));
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
            default -> throw new IllegalStateException(operation.getOperationType().toString());
          });
    }
    return new OntologyWorkingSnapshot.Snapshot(state(root), entries);
  }

  private static Ontology root() {
    return new Ontology()
        .withId(UUID.randomUUID())
        .withName("Imported")
        .withFullyQualifiedName("Imported")
        .withIri(ROOT_IRI);
  }

  private static OntologyState state(final Ontology root) {
    return new OntologyState()
        .withOntologyId(root.getId())
        .withWorkingRevision(3L)
        .withActivationRevision(1L)
        .withLastReleaseRevision(1L);
  }
}
