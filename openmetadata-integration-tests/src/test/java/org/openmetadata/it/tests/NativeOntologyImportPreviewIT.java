package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.OntologyChangeSetTestSupport;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.ActivateOntologyRelease;
import org.openmetadata.schema.api.data.CreateOntologyChangeSet;
import org.openmetadata.schema.api.data.CreateOntologyConcept;
import org.openmetadata.schema.api.data.PreviewNativeOntologyImport;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationResult;
import org.openmetadata.schema.type.OntologyChangeOperationResultStatus;
import org.openmetadata.schema.type.OntologyChangeOperationState;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.service.Entity;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class NativeOntologyImportPreviewIT extends BaseOntologyApprovalIT {
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
    final String conceptIri = "https://example.org/model/" + ns.shortPrefix() + "/Imported";

    final CreateOntologyChangeSet preview =
        client.ontologies().previewImport(ontology.getId(), turtle(conceptIri));

    assertEquals(ontology.getFullyQualifiedName(), preview.getOntology());
    assertEquals(before.getWorkingRevision(), preview.getBaseWorkingRevision());
    assertEquals(1, preview.getOperations().size());
    final var operation = preview.getOperations().getFirst();
    assertEquals(OntologyChangeOperationType.UPSERT_CONCEPT, operation.getOperationType());
    assertEquals(conceptIri, operation.getConcept().getIri().toString());
    assertNotNull(operation.getConcept().getId());
    assertEquals(
        before.getWorkingRevision(),
        client.ontologies().state(ontology.getId()).getWorkingRevision());
    assertEquals(active.getId(), client.ontologies().state(ontology.getId()).getActiveReleaseId());
    assertEquals(
        0, client.ontologies().workingDiff(ontology.getId(), 10, null).getPaging().getTotal());
    assertEquals(
        404,
        assertThrows(
                OpenMetadataException.class,
                () -> client.ontologyConcepts().get(operation.getConcept().getId().toString()))
            .getStatusCode());

    final OntologyChangeSet draft =
        ns.trackRoot(
            "ontologyChangeSet",
            client.ontologyChangeSets().create(preview.withName(ns.prefix("importDraft"))));
    final OntologyChangeSet applied =
        OntologyChangeSetTestSupport.applyOntologyChangeSet(client, draft, ns, "importEditor");

    assertEquals(OntologyChangeSetState.APPLIED, applied.getState());
    assertEquals(1, applied.getApplicationResult().getOperationsApplied());
    final OntologyConcept concept =
        client.ontologyConcepts().get(operation.getConcept().getId().toString());
    assertEquals(conceptIri, concept.getIri().toString());
    assertEquals(ontology.getFullyQualifiedName(), concept.getOntology().getFullyQualifiedName());
    assertEquals(active.getId(), client.ontologies().state(ontology.getId()).getActiveReleaseId());
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
                                  .withFormat(PreviewNativeOntologyImport.Format.TURTLE)
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
        client.ontologies().previewImport(ontology.getId(), turtle(importedIri));
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
        .withFormat(PreviewNativeOntologyImport.Format.TURTLE)
        .withData(
            """
            @prefix owl: <http://www.w3.org/2002/07/owl#> .
            @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
            <%s> a owl:Class ; rdfs:label "Imported" .
            """
                .formatted(conceptIri));
  }
}
