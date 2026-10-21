package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.RdfAccessFixtures;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CaptureOntologyRelease;
import org.openmetadata.schema.api.data.CreateOntologyConcept;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyReleaseEvent;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.ontology.OntologyReview;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IndependentOntologyReleaseIT extends BaseOntologyApprovalIT {

  @Test
  void releaseMembershipCannotBypassConceptReadPermissions(TestNamespace ns) {
    Ontology ontology = createOntology(ns);
    OntologyConcept concept =
        SdkClients.adminClient()
            .ontologyConcepts()
            .create(
                new CreateOntologyConcept()
                    .withName("RestrictedConcept")
                    .withConceptType(OntologyConceptType.OWL_CLASS)
                    .withOntology(ontology.getFullyQualifiedName()));
    OntologyRelease release = capture(ontology, state(ontology).getWorkingRevision());
    try (RdfAccessFixtures fixtures = new RdfAccessFixtures("release" + ns.shortPrefix())) {
      var role = fixtures.denyRole(MetadataOperation.VIEW_ALL, Entity.ONTOLOGY_CONCEPT);
      var editor = fixtures.allowRole(MetadataOperation.EDIT_ALL, Entity.ONTOLOGY);
      String token = fixtures.userToken("reader", List.of(role.getId(), editor.getId()));
      OpenMetadataClient denied =
          new OpenMetadataClient(
              OpenMetadataConfig.builder()
                  .serverUrl(SdkClients.baseUrl())
                  .accessToken(token)
                  .build());
      assertEquals(
          403,
          assertThrows(
                  OpenMetadataException.class,
                  () -> denied.ontologyConcepts().get(concept.getId().toString()))
              .getStatusCode());
      assertNotNull(
          denied
              .getHttpClient()
              .execute(
                  HttpMethod.GET,
                  "/v1/ontologyReleases/" + release.getId(),
                  null,
                  OntologyRelease.class));
      assertMemberReadDenied(denied, release, concept);
      assertEquals(
          403,
          assertThrows(
                  OpenMetadataException.class,
                  () ->
                      denied
                          .getHttpClient()
                          .execute(
                              HttpMethod.POST,
                              "/v1/ontologies/" + ontology.getId() + "/releases",
                              new CaptureOntologyRelease()
                                  .withExpectedWorkingRevision(
                                      state(ontology).getWorkingRevision()),
                              OntologyRelease.class))
              .getStatusCode());
      assertEquals(1L, state(ontology).getLastReleaseRevision());
      SdkClients.adminClient()
          .ontologyConcepts()
          .delete(concept.getId().toString(), Map.of("hardDelete", "true"));
      assertMemberReadDenied(denied, release, concept);
    }
  }

  @Test
  void concurrentCapturesAllocateDistinctRevisionsForTheSameContent(TestNamespace ns)
      throws Exception {
    Ontology ontology = createOntology(ns);
    long revision = state(ontology).getWorkingRevision();
    Callable<OntologyRelease> capture = () -> capture(ontology, revision);
    try (var executor = Executors.newFixedThreadPool(2)) {
      var first = executor.submit(capture);
      var second = executor.submit(capture);
      OntologyRelease one = first.get(30, java.util.concurrent.TimeUnit.SECONDS);
      OntologyRelease two = second.get(30, java.util.concurrent.TimeUnit.SECONDS);
      assertEquals(Set.of(1L, 2L), Set.of(one.getReleaseRevision(), two.getReleaseRevision()));
      assertNotEquals(one.getId(), two.getId());
      assertEquals(one.getContentDigest(), two.getContentDigest());
    }
    assertEquals(2L, state(ontology).getLastReleaseRevision());
    assertEquals(revision, state(ontology).getWorkingRevision());
  }

  @Test
  void capturedReleasesImmediatelyAppearInTheirOntologyList(TestNamespace ns) {
    Ontology ontology = createOntology(ns);
    String path = "/v1/ontologyReleases?ontologyId=" + ontology.getId();
    JsonNode before =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(HttpMethod.GET, path, null, JsonNode.class);
    assertEquals(0, before.path("paging").path("total").asInt());
    OntologyRelease release = capture(ontology, state(ontology).getWorkingRevision());
    JsonNode after =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(HttpMethod.GET, path, null, JsonNode.class);
    assertEquals(1, after.path("paging").path("total").asInt());
    assertEquals(release.getId().toString(), after.path("data").get(0).path("id").asText());
  }

  @Test
  void capturesRequireOntologyEditPermission(TestNamespace ns) {
    Ontology ontology = createOntology(ns);
    long revision = state(ontology).getWorkingRevision();
    assertEquals(
        403,
        assertThrows(
                OpenMetadataException.class,
                () ->
                    SdkClients.user2Client()
                        .getHttpClient()
                        .execute(
                            HttpMethod.POST,
                            "/v1/ontologies/" + ontology.getId() + "/releases",
                            new CaptureOntologyRelease().withExpectedWorkingRevision(revision),
                            OntologyRelease.class))
            .getStatusCode());
    assertEquals(0L, state(ontology).getLastReleaseRevision());
  }

  @Test
  void memberPagingStaysWithinTheRequestedRelease(TestNamespace ns) {
    Ontology ontology = createOntology(ns);
    for (String name : new String[] {"Customer", "Account"}) {
      SdkClients.adminClient()
          .ontologyConcepts()
          .create(
              new CreateOntologyConcept()
                  .withName(name)
                  .withConceptType(OntologyConceptType.OWL_CLASS)
                  .withOntology(ontology.getFullyQualifiedName()));
    }
    OntologyRelease release = capture(ontology, state(ontology).getWorkingRevision());
    String path = "/v1/ontologyReleases/" + release.getId() + "/members/CONCEPT?limit=1";
    JsonNode first =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(HttpMethod.GET, path, null, JsonNode.class);
    assertEquals(1, first.path("data").size());
    assertEquals(2, first.path("paging").path("total").asInt());
    String after = first.path("paging").path("after").asText();
    assertTrue(!after.isBlank());
    SdkClients.adminClient()
        .ontologyConcepts()
        .create(
            new CreateOntologyConcept()
                .withName("LaterDraft")
                .withConceptType(OntologyConceptType.OWL_CLASS)
                .withOntology(ontology.getFullyQualifiedName()));
    capture(ontology, state(ontology).getWorkingRevision());
    JsonNode second =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(HttpMethod.GET, path + "&after=" + after, null, JsonNode.class);
    assertEquals(1, second.path("data").size());
    assertEquals(release.getId().toString(), second.path("data").get(0).path("releaseId").asText());
    assertNotEquals(
        first.path("data").get(0).path("memberId"), second.path("data").get(0).path("memberId"));
    assertTrue(
        second.path("paging").path("after").isMissingNode()
            || second.path("paging").path("after").isNull());
  }

  @Test
  void capturedMembersSurviveWorkingEditsAndDeletion(TestNamespace ns) {
    Ontology ontology = createOntology(ns);
    OntologyConcept concept =
        SdkClients.adminClient()
            .ontologyConcepts()
            .create(
                new CreateOntologyConcept()
                    .withName("Customer")
                    .withConceptType(OntologyConceptType.OWL_CLASS)
                    .withOntology(ontology.getFullyQualifiedName())
                    .withDescription("Captured definition"));
    OntologyState before = state(ontology);
    OntologyRelease release = capture(ontology, before.getWorkingRevision());
    assertEquals(EntityStatus.DRAFT, release.getEntityStatus());
    assertEquals(SharedEntities.get().USER1.getId(), release.getReviewers().getFirst().getId());
    assertEquals(2, release.getMemberCount());
    assertEquals(before.getWorkingRevision(), release.getSourceWorkingRevision());
    assertNotNull(release.getContentDigest());
    assertNotNull(release.getSealedAt());
    assertNull(state(ontology).getActiveReleaseId());
    OntologyReleaseMember frozen = member(release, concept.getId());
    assertEquals(concept.getVersion(), frozen.getSourceVersion());
    for (String field : List.of("version", "owners", "reviewers", "href", "changeDescription")) {
      assertTrue(frozen.getPayload().path(field).isMissingNode(), field);
    }
    assertEquals("Captured definition", frozen.getPayload().path("description").asText());
    SdkClients.adminClient()
        .ontologyConcepts()
        .update(concept.getId(), concept.withDescription("Working edit"));
    assertTrue(state(ontology).getWorkingRevision() > before.getWorkingRevision());
    assertEquals(frozen, member(release, concept.getId()));
    SdkClients.adminClient()
        .ontologyConcepts()
        .delete(concept.getId().toString(), Map.of("hardDelete", "true"));
    assertEquals(frozen, member(release, concept.getId()));
    OntologyRelease later = capture(ontology, state(ontology).getWorkingRevision());
    assertEquals(2L, later.getReleaseRevision());
    assertEquals(1, later.getMemberCount());
    assertNotEquals(release.getContentDigest(), later.getContentDigest());
  }

  @Test
  void staleCaptureLeavesTheReleaseCounterUnchanged(TestNamespace ns) {
    Ontology ontology = createOntology(ns);
    OntologyState before = state(ontology);
    SdkClients.adminClient()
        .ontologies()
        .update(ontology.getId(), ontology.withDescription("New working revision"));
    assertEquals(
        412,
        assertThrows(
                OpenMetadataException.class, () -> capture(ontology, before.getWorkingRevision()))
            .getStatusCode());
    assertEquals(0L, state(ontology).getLastReleaseRevision());
    assertNull(state(ontology).getActiveReleaseId());
  }

  @Test
  void releasesUseExistingApprovalTasksAndIgnoreLaterWorkingEdits(TestNamespace ns) {
    Ontology ontology = createOntology(ns);
    OntologyRelease release = capture(ontology, state(ontology).getWorkingRevision());
    Task task = submit(ns, "ontologyRelease", release.getFullyQualifiedName());
    SdkClients.adminClient()
        .ontologies()
        .update(ontology.getId(), ontology.withDescription("Next release draft"));
    SdkClients.user1Client()
        .tasks()
        .resolve(task.getId().toString(), decision(TaskResolutionType.Approved));
    OntologyRelease approved = get(release.getId());
    assertEquals(EntityStatus.APPROVED, approved.getEntityStatus());
    assertEquals(release.getContentDigest(), approved.getContentDigest());
    final OntologyRelease reviewed =
        SdkClients.user1Client()
            .ontologyReleases()
            .getVersion(release.getId(), task.getOntologyReview().getEntityVersion());
    assertEquals(release.getVersion(), reviewed.getVersion());
    assertEquals(EntityStatus.DRAFT, reviewed.getEntityStatus());
    assertEquals(release.getContentDigest(), reviewed.getContentDigest());
    assertEquals(task.getOntologyReview().getContentDigest(), OntologyReview.digest(reviewed));
    assertNull(state(ontology).getActiveReleaseId());
    JsonNode firstPage = events(release, "?limit=1");
    assertEquals(2, firstPage.path("paging").path("total").asInt());
    assertEquals("CAPTURED", firstPage.path("data").get(0).path("eventType").asText());
    String cursor = firstPage.path("paging").path("after").asText();
    JsonNode lastPage = events(release, "?limit=1&after=" + cursor);
    OntologyReleaseEvent decision =
        JsonUtils.getObjectMapper()
            .convertValue(lastPage.path("data").get(0), OntologyReleaseEvent.class);
    assertEquals(OntologyReleaseEvent.EventType.APPROVED, decision.getEventType());
    assertEquals(task.getId(), decision.getTaskId());
    assertEquals(task.getWorkflowDefinitionId(), decision.getWorkflowDefinitionId());
    assertEquals(task.getOntologyReview(), decision.getReviewTarget());
    assertEquals(List.of(SharedEntities.get().USER1.getName()), decision.getVoters());
    assertEquals(release.getContentDigest(), decision.getContentDigest());
    assertEquals(TaskResolutionType.Approved, decision.getResolution().getType());
    OntologyRelease other = capture(ontology, state(ontology).getWorkingRevision());
    assertEquals(
        400,
        assertThrows(OpenMetadataException.class, () -> events(other, "?after=" + cursor))
            .getStatusCode());
  }

  @Test
  void releaseHeaderHistoryRequiresReleaseReadPermission(TestNamespace ns) {
    Ontology ontology = createOntology(ns);
    OntologyRelease release = capture(ontology, state(ontology).getWorkingRevision());
    try (RdfAccessFixtures fixtures = new RdfAccessFixtures("history" + ns.shortPrefix())) {
      var role = fixtures.denyRole(MetadataOperation.VIEW_ALL, Entity.ONTOLOGY_RELEASE);
      var denied =
          new OpenMetadataClient(
              OpenMetadataConfig.builder()
                  .serverUrl(SdkClients.baseUrl())
                  .accessToken(fixtures.userToken("reader", List.of(role.getId())))
                  .build());
      assertEquals(
          403,
          assertThrows(
                  OpenMetadataException.class,
                  () -> denied.ontologyReleases().getVersion(release.getId(), release.getVersion()))
              .getStatusCode());
    }
  }

  @Test
  void rejectedReleaseKeepsItsSealedContentAndWorkflowEvidence(TestNamespace ns) {
    Ontology ontology = createOntology(ns);
    OntologyRelease release = capture(ontology, state(ontology).getWorkingRevision());
    Task task = submit(ns, "ontologyRelease", release.getFullyQualifiedName());
    SdkClients.user1Client()
        .tasks()
        .resolve(task.getId().toString(), decision(TaskResolutionType.Rejected));
    assertEquals(EntityStatus.REJECTED, get(release.getId()).getEntityStatus());
    assertEquals(release.getContentDigest(), get(release.getId()).getContentDigest());
    JsonNode events = events(release, "");
    assertEquals(2, events.path("data").size());
    assertEquals("REJECTED", events.path("data").get(1).path("eventType").asText());
    assertEquals(task.getId().toString(), events.path("data").get(1).path("taskId").asText());
    assertNull(state(ontology).getActiveReleaseId());
  }

  @Test
  void changingReviewersInvalidatesPendingReleaseApproval(TestNamespace ns) {
    Ontology ontology = createOntology(ns);
    OntologyRelease release = capture(ontology, state(ontology).getWorkingRevision());
    Task task = submit(ns, "ontologyRelease", release.getFullyQualifiedName());
    SdkClients.adminClient()
        .ontologies()
        .update(
            ontology.getId(),
            ontology.withReviewers(List.of(SharedEntities.get().USER2.getEntityReference())));
    assertThrows(
        OpenMetadataException.class,
        () ->
            SdkClients.user1Client()
                .tasks()
                .resolve(task.getId().toString(), decision(TaskResolutionType.Approved)));
    assertNotEquals(EntityStatus.APPROVED, get(release.getId()).getEntityStatus());
    assertEquals(1, events(release, "").path("data").size());
    assertNull(state(ontology).getActiveReleaseId());
  }

  @Test
  void sealedContentCannotBePatchedOrApprovedDirectly(TestNamespace ns) {
    Ontology ontology = createOntology(ns);
    OntologyRelease release = capture(ontology, state(ontology).getWorkingRevision());
    for (String field : new String[] {"contentDigest", "entityStatus"}) {
      var patch = JsonUtils.getObjectMapper().createArrayNode();
      patch
          .addObject()
          .put("op", "replace")
          .put("path", "/" + field)
          .put("value", field.equals("entityStatus") ? "Approved" : "0".repeat(64));
      assertThrows(
          OpenMetadataException.class,
          () ->
              SdkClients.adminClient()
                  .getHttpClient()
                  .execute(
                      HttpMethod.PATCH,
                      "/v1/ontologyReleases/" + release.getId(),
                      patch,
                      OntologyRelease.class));
    }
    assertEquals(release.getContentDigest(), get(release.getId()).getContentDigest());
    assertEquals(EntityStatus.DRAFT, get(release.getId()).getEntityStatus());
  }

  private static OntologyState state(Ontology ontology) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            "/v1/ontologies/" + ontology.getId() + "/state",
            null,
            OntologyState.class);
  }

  private static OntologyRelease capture(Ontology ontology, long revision) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            "/v1/ontologies/" + ontology.getId() + "/releases",
            new CaptureOntologyRelease().withExpectedWorkingRevision(revision),
            OntologyRelease.class);
  }

  private static OntologyRelease get(UUID id) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.GET, "/v1/ontologyReleases/" + id, null, OntologyRelease.class);
  }

  private static JsonNode events(OntologyRelease release, String query) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            "/v1/ontologyReleases/" + release.getId() + "/events" + query,
            null,
            JsonNode.class);
  }

  private static void assertMemberReadDenied(
      OpenMetadataClient denied, OntologyRelease release, OntologyConcept concept) {
    for (String suffix : List.of("", "/" + concept.getId())) {
      assertEquals(
          403,
          assertThrows(
                  OpenMetadataException.class,
                  () ->
                      denied
                          .getHttpClient()
                          .execute(
                              HttpMethod.GET,
                              "/v1/ontologyReleases/"
                                  + release.getId()
                                  + "/members/CONCEPT"
                                  + suffix,
                              null,
                              JsonNode.class))
              .getStatusCode());
    }
  }

  private static OntologyReleaseMember member(OntologyRelease release, UUID conceptId) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            "/v1/ontologyReleases/" + release.getId() + "/members/CONCEPT/" + conceptId,
            null,
            OntologyReleaseMember.class);
  }
}
