package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateOntologyConcept;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.governance.workflows.OntologyReviewReconciler;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IndependentOntologyRetentionIT extends BaseOntologyApprovalIT {
  @Test
  void archivingPreservesReleaseReadsAndDeletedMemberInheritance(TestNamespace ns) {
    var client = SdkClients.adminClient();
    Ontology ontology = createOntology(ns);
    OntologyConcept concept = concept(ontology);
    var release = capture(ontology);
    client.ontologies().delete(ontology.getId().toString(), Map.of("recursive", "true"));

    assertEquals(
        release.getContentDigest(),
        client.ontologyReleases().get(release.getId()).getContentDigest());
    assertTrue(client.ontologyReleases().structure(release.getId()).getValid());
    var archived =
        client.ontologyConcepts().get(concept.getId().toString(), "owners,reviewers", "deleted");
    assertTrue(archived.getDeleted());
    assertFalse(archived.getReviewers().isEmpty());
    var member =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/ontologyReleases/" + release.getId() + "/members/CONCEPT/" + concept.getId(),
                null,
                OntologyReleaseMember.class);
    assertEquals(concept.getId().toString(), member.getPayload().path("id").asText());
    var exported =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/ontologyReleases/" + release.getId() + "/export",
                null,
                RequestOptions.builder().header("Accept", "text/turtle").build());
    assertTrue(exported.contains("Customer"));

    client.ontologies().restore(ontology.getId());
    assertFalse(client.ontologyConcepts().get(concept.getId().toString()).getDeleted());
    assertEquals(
        release.getContentDigest(),
        client.ontologyReleases().get(release.getId()).getContentDigest());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void retainedReleasesPreventPurgingTheOwnerAndRollbackChildDeletion(
      boolean bulk, TestNamespace ns) {
    var client = SdkClients.adminClient();
    Ontology ontology = createOntology(ns, "retained" + bulk);
    OntologyConcept concept = concept(ontology);
    var release = capture(ontology);
    var task = submit(ns, Entity.ONTOLOGY_RELEASE, release.getFullyQualifiedName());
    final RuntimeException failure;
    if (bulk) {
      failure =
          assertThrows(
              BadRequestException.class,
              () ->
                  Entity.getEntityRepository(Entity.ONTOLOGY)
                      .bulkHardDeleteSubtree(List.of(ontology.getId()), "admin"));
    } else {
      final var response =
          assertThrows(
              OpenMetadataException.class,
              () ->
                  client
                      .ontologies()
                      .delete(
                          ontology.getId().toString(),
                          Map.of("hardDelete", "true", "recursive", "true")));
      assertEquals(400, response.getStatusCode());
      failure = response;
    }
    assertTrue(failure.getMessage().contains("retained releases"));
    assertEquals(ontology.getVersion(), current(ontology).getVersion());
    assertFalse(client.ontologyConcepts().get(concept.getId().toString()).getDeleted());
    assertEquals(
        release.getContentDigest(),
        client.ontologyReleases().get(release.getId()).getContentDigest());
    assertEquals(
        TaskEntityStatus.Approved,
        SdkClients.user1Client()
            .tasks()
            .resolve(task.getId().toString(), decision(TaskResolutionType.Approved))
            .getStatus());
  }

  @Test
  void archivedOntologiesRemainReadableButCannotStartOrCompleteReviews(TestNamespace ns) {
    var client = SdkClients.adminClient();
    Ontology ontology = createOntology(ns);
    var release = capture(ontology);
    var draft = capture(ontology);
    var task = submit(ns, Entity.ONTOLOGY_RELEASE, release.getFullyQualifiedName());
    client.ontologies().delete(ontology.getId().toString());
    final var purgeFailure =
        assertThrows(
            OpenMetadataException.class,
            () ->
                client
                    .ontologies()
                    .delete(ontology.getId().toString(), Map.of("hardDelete", "true")));
    assertEquals(400, purgeFailure.getStatusCode());
    assertTrue(purgeFailure.getMessage().contains("retained releases"));
    assertEquals(
        release.getContentDigest(),
        client.ontologyReleases().get(release.getId()).getContentDigest());
    assertThrows(
        OpenMetadataException.class,
        () ->
            SdkClients.user1Client()
                .tasks()
                .resolve(task.getId().toString(), decision(TaskResolutionType.Approved)));
    assertThrows(
        OpenMetadataException.class,
        () ->
            client
                .tasks()
                .create(reviewRequest(ns, Entity.ONTOLOGY_RELEASE, draft.getFullyQualifiedName())));
    new OntologyReviewReconciler(Entity.getCollectionDAO()).reconcile(task.getId());
    assertEquals(
        EntityStatus.DRAFT, client.ontologyReleases().get(release.getId()).getEntityStatus());
    assertEquals(
        TaskEntityStatus.Cancelled, client.tasks().get(task.getId().toString()).getStatus());
  }

  private static OntologyConcept concept(Ontology ontology) {
    return SdkClients.adminClient()
        .ontologyConcepts()
        .create(
            new CreateOntologyConcept()
                .withName("Customer")
                .withOntology(ontology.getFullyQualifiedName())
                .withConceptType(OntologyConceptType.OWL_CLASS));
  }
}
