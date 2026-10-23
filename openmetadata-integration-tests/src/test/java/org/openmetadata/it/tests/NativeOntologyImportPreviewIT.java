package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.net.URI;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.OntologyChangeSetTestSupport;
import org.openmetadata.it.util.RdfAccessFixtures;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.ActivateOntologyRelease;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.api.data.CreateOntologyChangeSet;
import org.openmetadata.schema.api.data.CreateOntologyConcept;
import org.openmetadata.schema.api.data.NativeOntologyImportCounts;
import org.openmetadata.schema.api.data.NativeOntologyImportFormat;
import org.openmetadata.schema.api.data.NativeOntologyImportPreview;
import org.openmetadata.schema.api.data.NativeOntologyImportSummary;
import org.openmetadata.schema.api.data.PreviewNativeOntologyImport;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationResult;
import org.openmetadata.schema.type.OntologyChangeOperationResultStatus;
import org.openmetadata.schema.type.OntologyChangeOperationState;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.service.Entity;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class NativeOntologyImportPreviewIT extends BaseOntologyApprovalIT {
  @Test
  void detectionUsesContentBeforeAMisleadingFileName() {
    final var request =
        new PreviewNativeOntologyImport()
            .withFileName("ontology.ttl")
            .withData(
                "<?xml version=\"1.0\"?>\n<rdf:RDF xmlns:rdf=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\"/>\n");

    assertEquals(
        NativeOntologyImportFormat.RDFXML,
        SdkClients.adminClient().ontologies().detectImportFormat(request).getDetectedFormat());
  }

  @Test
  void previewCreatesNoDefinitionsAndAppliesOnlyAfterDraftLease(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final var client = SdkClients.adminClient();
    final OntologyRelease active = capture(ontology);
    final var task = submit(ns, Entity.ONTOLOGY_RELEASE, active.getFullyQualifiedName());
    SdkClients.user1Client()
        .tasks()
        .resolve(task.getId().toString(), decision(TaskResolutionType.Approved));
    client
        .ontologies()
        .activate(
            ontology.getId(),
            new ActivateOntologyRelease()
                .withReleaseId(active.getId())
                .withExpectedActivationRevision(0L));
    final var before = client.ontologies().state(ontology.getId());
    final List<UUID> conceptsBefore = conceptIds(ontology);
    final String baseIri = "https://example.org/model/" + ns.shortPrefix() + "/";

    final NativeOntologyImportPreview dryRun =
        client.ontologies().previewImport(ontology.getId(), graphTurtle(baseIri));

    assertEquals(NativeOntologyImportFormat.TURTLE, dryRun.getSummary().getDetectedFormat());
    assertEquals("Source model", dryRun.getSummary().getOntologyLabel());
    assertEquals(counts(2, 0, 1, 0, 1, 0, 0, 0), dryRun.getSummary().getCounts());
    assertEquals(conceptsBefore, conceptIds(ontology));
    final CreateOntologyChangeSet preview = dryRun.getChangeSet();
    assertEquals(ontology.getFullyQualifiedName(), preview.getOntology());
    assertEquals(before.getWorkingRevision(), preview.getBaseWorkingRevision());
    assertEquals(4, preview.getOperations().size());
    final List<OntologyChangeOperation> concepts =
        preview.getOperations().stream()
            .filter(
                operation ->
                    operation.getOperationType() == OntologyChangeOperationType.UPSERT_CONCEPT)
            .toList();
    assertEquals(2, concepts.size());
    assertEquals(
        Set.of(baseIri + "Customer", baseIri + "Party"),
        concepts.stream()
            .map(operation -> operation.getConcept().getIri().toString())
            .collect(Collectors.toSet()));
    final OntologyChangeOperation propertyOperation =
        preview.getOperations().stream()
            .filter(
                operation ->
                    operation.getOperationType() == OntologyChangeOperationType.UPSERT_PROPERTY)
            .findFirst()
            .orElseThrow();
    final OntologyChangeOperation axiomOperation =
        preview.getOperations().stream()
            .filter(
                operation ->
                    operation.getOperationType() == OntologyChangeOperationType.UPSERT_AXIOM)
            .findFirst()
            .orElseThrow();
    assertEquals(baseIri + "knows", propertyOperation.getProperty().getIri().toString());
    assertEquals(OntologyAxiomType.SUBCLASS_OF, axiomOperation.getAxiom().getAxiomType());
    assertEquals("Imported subclass of", axiomOperation.getAxiom().getDisplayName());
    assertEquals("Imported from native RDF", axiomOperation.getAxiom().getDescription());
    assertEquals(
        before.getWorkingRevision(),
        client.ontologies().state(ontology.getId()).getWorkingRevision());
    assertEquals(active.getId(), client.ontologies().state(ontology.getId()).getActiveReleaseId());
    assertEquals(
        0, client.ontologies().workingDiff(ontology.getId(), 10, null).getPaging().getTotal());
    for (final OntologyChangeOperation operation : concepts) {
      assertEquals(
          404,
          assertThrows(
                  OpenMetadataException.class,
                  () -> client.ontologyConcepts().get(operation.getConcept().getId().toString()))
              .getStatusCode());
    }
    assertEquals(
        404,
        assertThrows(
                OpenMetadataException.class,
                () -> client.ontologyProperties().get(propertyOperation.getProperty().getId()))
            .getStatusCode());
    assertEquals(
        404,
        assertThrows(
                OpenMetadataException.class,
                () -> client.ontologyAxioms().get(axiomOperation.getAxiom().getId()))
            .getStatusCode());

    final OntologyChangeSet draft =
        ns.trackRoot(
            "ontologyChangeSet",
            client.ontologyChangeSets().create(preview.withName(ns.prefix("importDraft"))));
    final OntologyChangeSet applied =
        OntologyChangeSetTestSupport.applyOntologyChangeSet(client, draft, ns, "importEditor");

    assertEquals(OntologyChangeSetState.APPLIED, applied.getState());
    assertEquals(4, applied.getApplicationResult().getOperationsApplied());
    for (final OntologyChangeOperation operation : concepts) {
      final OntologyConcept concept =
          client.ontologyConcepts().get(operation.getConcept().getId().toString());
      assertEquals(operation.getConcept().getIri(), concept.getIri());
      assertEquals(ontology.getFullyQualifiedName(), concept.getOntology().getFullyQualifiedName());
    }
    final OntologyProperty property =
        client.ontologyProperties().get(propertyOperation.getProperty().getId());
    assertEquals(baseIri + "knows", property.getIri().toString());
    assertEquals(List.of(URI.create(baseIri + "Customer")), property.getDomain());
    assertEquals(List.of(URI.create(baseIri + "Party")), property.getRange());
    final OntologyAxiom axiom = client.ontologyAxioms().get(axiomOperation.getAxiom().getId());
    assertEquals(URI.create(baseIri + "Customer"), axiom.getSubjectIri());
    assertEquals(URI.create(baseIri + "Party"), axiom.getExpressions().getFirst().getClassIri());
    assertEquals(active.getId(), client.ontologies().state(ontology.getId()).getActiveReleaseId());
    assertEquals(
        4, client.ontologies().workingDiff(ontology.getId(), 10, null).getPaging().getTotal());
    final var afterApply = client.ontologies().state(ontology.getId());
    final List<UUID> conceptsAfterApply = conceptIds(ontology);

    final NativeOntologyImportPreview repeat =
        client.ontologies().previewImport(ontology.getId(), graphTurtle(baseIri));

    assertEquals(counts(0, 0, 0, 0, 0, 0, 3, 1), repeat.getSummary().getCounts());
    assertEquals(0, repeat.getChangeSet().getOperations().size());
    assertEquals(
        afterApply.getWorkingRevision(),
        client.ontologies().state(ontology.getId()).getWorkingRevision());
    assertEquals(conceptsAfterApply, conceptIds(ontology));
  }

  @Test
  void repeatedDefinitionsAreSkippedAndOnlyNewOnesPlanned(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final var client = SdkClients.adminClient();
    final String baseIri = "https://example.org/model/" + ns.shortPrefix() + "/";
    for (final String name : List.of("Alpha", "Beta", "Gamma")) {
      declareClass(ontology, name, URI.create(baseIri + name));
    }
    final long revision = client.ontologies().state(ontology.getId()).getWorkingRevision();
    final List<UUID> conceptsBefore = conceptIds(ontology);
    final var request =
        new PreviewNativeOntologyImport()
            .withFormat(NativeOntologyImportFormat.TURTLE)
            .withData(
                """
                @prefix ex: <%s> .
                @prefix owl: <http://www.w3.org/2002/07/owl#> .
                @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
                ex:Alpha a owl:Class ; rdfs:label "Alpha" .
                ex:Beta a owl:Class ; rdfs:label "Beta" .
                ex:Gamma a owl:Class ; rdfs:label "Gamma" .
                ex:Delta a owl:Class ; rdfs:label "Delta" .
                """
                    .formatted(baseIri));

    final NativeOntologyImportPreview preview =
        client.ontologies().previewImport(ontology.getId(), request);

    assertEquals(counts(1, 0, 0, 0, 0, 0, 3, 0), preview.getSummary().getCounts());
    assertEquals(1, preview.getChangeSet().getOperations().size());
    assertEquals(
        baseIri + "Delta",
        preview.getChangeSet().getOperations().getFirst().getConcept().getIri().toString());
    assertEquals(revision, client.ontologies().state(ontology.getId()).getWorkingRevision());
    assertEquals(conceptsBefore, conceptIds(ontology));
  }

  @Test
  void targetFreePreviewCountsTheFileAndRequiresCreateOnOntologies(TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final String baseIri = "https://example.org/model/" + ns.shortPrefix() + "/";

    final NativeOntologyImportSummary summary =
        client.ontologies().previewImport(graphTurtle(baseIri));

    assertEquals(NativeOntologyImportFormat.TURTLE, summary.getDetectedFormat());
    assertEquals("Source model", summary.getOntologyLabel());
    assertEquals(counts(2, 0, 1, 0, 1, 0, 0, 0), summary.getCounts());
    try (var fixtures = new RdfAccessFixtures("import" + ns.shortPrefix())) {
      final var role = fixtures.denyRole(MetadataOperation.CREATE, Entity.ONTOLOGY);
      final OpenMetadataClient denied =
          new OpenMetadataClient(
              OpenMetadataConfig.builder()
                  .serverUrl(SdkClients.baseUrl())
                  .accessToken(fixtures.userToken("importer", List.of(role.getId())))
                  .build());
      assertEquals(
          403,
          assertThrows(
                  OpenMetadataException.class,
                  () -> denied.ontologies().previewImport(graphTurtle(baseIri)))
              .getStatusCode());
    }
  }

  @Test
  void applyingLabelChangePreservesSavedMappingMetadata(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final var client = SdkClients.adminClient();
    final URI conceptIri =
        URI.create("https://example.org/model/" + ns.shortPrefix() + "/Customer");
    final var mappings =
        List.of(
            new ConceptMapping()
                .withMappingType(ConceptMapping.ConceptMappingType.EXACT_MATCH)
                .withConceptIri(URI.create("https://external.example/Customer"))
                .withSchemeIri(URI.create("https://external.example/scheme"))
                .withSource("External catalog"));
    final OntologyConcept saved =
        client
            .ontologyConcepts()
            .create(
                new CreateOntologyConcept()
                    .withOntology(ontology.getFullyQualifiedName())
                    .withName("Customer")
                    .withDisplayName("Customer")
                    .withIri(conceptIri)
                    .withConceptType(OntologyConceptType.OWL_CLASS)
                    .withConceptMappings(mappings));
    final var request =
        new PreviewNativeOntologyImport()
            .withFormat(NativeOntologyImportFormat.TURTLE)
            .withData(
                """
                @prefix owl: <http://www.w3.org/2002/07/owl#> .
                @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
                @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
                <%s> a owl:Class; rdfs:label "Updated customer";
                  skos:exactMatch <https://external.example/Customer> .
                """
                    .formatted(conceptIri));
    final var dryRun = client.ontologies().previewImport(ontology.getId(), request);
    assertEquals(counts(0, 1, 0, 0, 0, 0, 0, 0), dryRun.getSummary().getCounts());
    final var preview = dryRun.getChangeSet();
    assertEquals(1, preview.getOperations().size());
    assertEquals(saved.getId(), preview.getOperations().getFirst().getTargetId());
    assertEquals(mappings, client.ontologyConcepts().get(saved.getId()).getConceptMappings());
    final var draft =
        ns.trackRoot(
            "ontologyChangeSet",
            client.ontologyChangeSets().create(preview.withName(ns.prefix("mappingImport"))));

    final var applied =
        OntologyChangeSetTestSupport.applyOntologyChangeSet(client, draft, ns, "mappingEditor");

    assertEquals(OntologyChangeSetState.APPLIED, applied.getState());
    final var updated = client.ontologyConcepts().get(saved.getId());
    assertEquals("Updated customer", updated.getDisplayName());
    assertEquals(mappings, updated.getConceptMappings());
    final var repeat = client.ontologies().previewImport(ontology.getId(), request);
    assertEquals(counts(0, 0, 0, 0, 0, 0, 1, 0), repeat.getSummary().getCounts());
    assertEquals(0, repeat.getChangeSet().getOperations().size());
  }

  @Test
  void missingRequestDoesNotMutateTheWorkingOntology(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final var client = SdkClients.adminClient();
    final long revision = client.ontologies().state(ontology.getId()).getWorkingRevision();

    assertEquals(
        400,
        assertThrows(
                OpenMetadataException.class,
                () -> client.ontologies().previewImport(ontology.getId(), null))
            .getStatusCode());

    assertEquals(revision, client.ontologies().state(ontology.getId()).getWorkingRevision());
    assertEquals(
        1, client.ontologies().workingDiff(ontology.getId(), 10, null).getPaging().getTotal());
  }

  @Test
  void unsupportedOrMalformedRdfDoesNotMutateTheWorkingOntology(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final var client = SdkClients.adminClient();
    final long revision = client.ontologies().state(ontology.getId()).getWorkingRevision();
    final String unsupported =
        """
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        <%s> a owl:Ontology ; owl:imports <https://example.org/remote.ttl> .
        """
            .formatted(ontology.getIri());
    for (final String data : new String[] {unsupported, "@prefix owl: <broken"}) {
      assertEquals(
          400,
          assertThrows(
                  OpenMetadataException.class,
                  () ->
                      client
                          .ontologies()
                          .previewImport(
                              ontology.getId(),
                              new PreviewNativeOntologyImport()
                                  .withFormat(NativeOntologyImportFormat.TURTLE)
                                  .withData(data)))
              .getStatusCode());
      assertEquals(revision, client.ontologies().state(ontology.getId()).getWorkingRevision());
      assertNull(client.ontologies().state(ontology.getId()).getActiveReleaseId());
    }
    assertEquals(
        1, client.ontologies().workingDiff(ontology.getId(), 10, null).getPaging().getTotal());
  }

  @Test
  void failedLaterNativeOperationRollsBackTheImportedConcept(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final var client = SdkClients.adminClient();
    final OntologyConcept collision =
        client
            .ontologyConcepts()
            .create(
                new CreateOntologyConcept()
                    .withOntology(ontology.getFullyQualifiedName())
                    .withName("Collision")
                    .withConceptType(OntologyConceptType.OWL_CLASS));
    final long revision = client.ontologies().state(ontology.getId()).getWorkingRevision();
    final String importedIri = "https://example.org/model/" + ns.shortPrefix() + "/First";
    final CreateOntologyChangeSet preview =
        client.ontologies().previewImport(ontology.getId(), turtle(importedIri)).getChangeSet();
    final UUID importedId = preview.getOperations().getFirst().getConcept().getId();
    final OntologyConcept conflicting =
        new OntologyConcept()
            .withId(UUID.randomUUID())
            .withName(collision.getName())
            .withFullyQualifiedName(collision.getFullyQualifiedName())
            .withIri(URI.create("https://example.org/model/" + ns.shortPrefix() + "/Other"))
            .withConceptType(OntologyConceptType.OWL_CLASS)
            .withOntology(ontology.getEntityReference())
            .withVersion(0.1);
    final OntologyChangeOperation duplicate =
        new OntologyChangeOperation()
            .withId(UUID.randomUUID())
            .withOperationType(OntologyChangeOperationType.UPSERT_CONCEPT)
            .withConcept(conflicting)
            .withState(OntologyChangeOperationState.ACTIVE);
    final OntologyChangeSet draft =
        ns.trackRoot(
            "ontologyChangeSet",
            client
                .ontologyChangeSets()
                .create(
                    preview
                        .withName(ns.prefix("rollbackDraft"))
                        .withOperations(List.of(preview.getOperations().getFirst(), duplicate))
                        .withUndoCursor(2)));

    final OntologyChangeSet failed =
        OntologyChangeSetTestSupport.applyOntologyChangeSet(client, draft, ns, "rollbackEditor");

    assertEquals(OntologyChangeSetState.APPLY_FAILED, failed.getState());
    assertEquals(
        List.of(
            OntologyChangeOperationResultStatus.ROLLED_BACK,
            OntologyChangeOperationResultStatus.FAILED),
        failed.getApplicationResult().getResults().stream()
            .map(OntologyChangeOperationResult::getStatus)
            .toList());
    assertEquals(revision, client.ontologies().state(ontology.getId()).getWorkingRevision());
    assertEquals(
        404,
        assertThrows(
                OpenMetadataException.class,
                () -> client.ontologyConcepts().get(importedId.toString()))
            .getStatusCode());
    assertEquals(
        collision.getId(), client.ontologyConcepts().get(collision.getId().toString()).getId());
  }

  private static PreviewNativeOntologyImport turtle(String conceptIri) {
    return new PreviewNativeOntologyImport()
        .withFormat(NativeOntologyImportFormat.TURTLE)
        .withData(
            """
            @prefix owl: <http://www.w3.org/2002/07/owl#> .
            @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
            <%s> a owl:Class ; rdfs:label "Imported" .
            """
                .formatted(conceptIri));
  }

  private static PreviewNativeOntologyImport graphTurtle(String baseIri) {
    return new PreviewNativeOntologyImport()
        .withFormat(NativeOntologyImportFormat.TURTLE)
        .withData(
            """
            @prefix ex: <%s> .
            @prefix owl: <http://www.w3.org/2002/07/owl#> .
            @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
            <https://external.example/source> a owl:Ontology ; rdfs:label "Source model" .
            ex:Customer a owl:Class ; rdfs:label "Customer" ; rdfs:subClassOf ex:Party .
            ex:Party a owl:Class ; rdfs:label "Party" .
            ex:knows a owl:ObjectProperty ; rdfs:label "knows" ; rdfs:domain ex:Customer ; rdfs:range ex:Party .
            """
                .formatted(baseIri));
  }

  static NativeOntologyImportCounts counts(
      int newConcepts,
      int updatedConcepts,
      int newProperties,
      int updatedProperties,
      int newRelations,
      int newMappings,
      int skippedDefinitions,
      int skippedRelations) {
    return new NativeOntologyImportCounts()
        .withNewConcepts(newConcepts)
        .withUpdatedConcepts(updatedConcepts)
        .withNewProperties(newProperties)
        .withUpdatedProperties(updatedProperties)
        .withNewRelations(newRelations)
        .withNewMappings(newMappings)
        .withSkippedDefinitions(skippedDefinitions)
        .withSkippedRelations(skippedRelations);
  }

  static List<UUID> conceptIds(Ontology ontology) {
    return SdkClients.adminClient()
        .ontologyConcepts()
        .list(new ListParams().addFilter("ontology", ontology.getFullyQualifiedName()))
        .getData()
        .stream()
        .map(OntologyConcept::getId)
        .sorted()
        .toList();
  }
}
