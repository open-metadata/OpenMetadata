package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.ActivateOntologyRelease;
import org.openmetadata.schema.api.data.CaptureOntologyRelease;
import org.openmetadata.schema.api.data.CreateOntologyConcept;
import org.openmetadata.schema.api.rdf.SparqlQuery;
import org.openmetadata.schema.api.tasks.ResolveTask;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyReleaseEvent;
import org.openmetadata.schema.type.OntologyReleaseEvent.EventType;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.OntologyReviewReconciler;
import org.openmetadata.service.governance.workflows.WorkflowHandler;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IndependentOntologyActivationIT extends BaseOntologyApprovalIT {
  @Test
  @ResourceLock("ontology-sparql-worker")
  void nonAdminQueriesOnlyTheActiveRelease(TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final var ontology = createOntology(ns);
    final var concept =
        client
            .ontologyConcepts()
            .create(
                new CreateOntologyConcept()
                    .withName("Published")
                    .withOntology(ontology.getFullyQualifiedName())
                    .withConceptType(OntologyConceptType.OWL_CLASS));
    final var request =
        new SparqlQuery()
            .withQuery("SELECT ?class WHERE { ?class a <http://www.w3.org/2002/07/owl#Class> }");
    final String path = "/v1/ontologies/" + ontology.getId() + "/sparql";
    assertEquals(
        400,
        assertThrows(
                OpenMetadataException.class,
                () ->
                    SdkClients.user2Client()
                        .getHttpClient()
                        .execute(HttpMethod.POST, path, request, JsonNode.class))
            .getStatusCode());
    final var release = capture(ontology);
    approve(ns, release);
    activate(client, ontology, release, 0);
    client
        .ontologyConcepts()
        .create(
            new CreateOntologyConcept()
                .withName("WorkingOnly")
                .withOntology(ontology.getFullyQualifiedName())
                .withConceptType(OntologyConceptType.OWL_CLASS));

    final var result =
        SdkClients.user2Client()
            .getHttpClient()
            .execute(HttpMethod.POST, path, request, JsonNode.class);
    assertEquals(1, result.path("results").path("bindings").size());
    assertEquals(
        concept.getIri().toString(),
        result.path("results").path("bindings").get(0).path("class").path("value").asText());
    assertThrows(
        OpenMetadataException.class,
        () ->
            SdkClients.user2Client()
                .getHttpClient()
                .execute(
                    HttpMethod.POST,
                    path,
                    new SparqlQuery()
                        .withQuery(
                            "SELECT * WHERE { SERVICE <http://localhost:9999/> { ?s ?p ?o } }"),
                    JsonNode.class));
  }

  @Test
  @ResourceLock("ontology-sparql-worker")
  void boundsMemoryForNonAdminActiveReleaseQueries(TestNamespace ns) {
    final var ontology = createOntology(ns);
    final var release = capture(ontology);
    approve(ns, release);
    activate(SdkClients.adminClient(), ontology, release, 0);
    final String path = "/v1/ontologies/" + ontology.getId() + "/sparql";
    final var http = SdkClients.user2Client().getHttpClient();
    final StringBuilder query = new StringBuilder("SELECT ?s27 WHERE { BIND(\"12345678\" AS ?s0) ");
    for (int index = 1; index <= 27; index++) {
      query.append("BIND(CONCAT(?s%d, ?s%d) AS ?s%d) ".formatted(index - 1, index - 1, index));
    }
    query.append('}');

    final OpenMetadataException failure =
        assertThrows(
            OpenMetadataException.class,
            () ->
                http.execute(
                    HttpMethod.POST,
                    path,
                    new SparqlQuery().withQuery(query.toString()),
                    JsonNode.class));

    assertEquals(400, failure.getStatusCode());
    assertTrue(failure.getMessage().contains("memory"), failure.getMessage());
    final JsonNode result =
        http.execute(HttpMethod.POST, path, new SparqlQuery().withQuery("ASK {}"), JsonNode.class);
    assertTrue(result.path("boolean").asBoolean());
  }

  @Test
  void approvalActivationAndRollbackAreSeparateAuditedTransitions(TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final var ontology = createOntology(ns);
    final var first = capture(ontology);
    assertEquals(
        409,
        assertThrows(OpenMetadataException.class, () -> activate(client, ontology, first, 0))
            .getStatusCode());
    approve(ns, first);
    assertNull(state(ontology).getActiveReleaseId());
    final var initial = activate(client, ontology, first, 0);
    assertEquals(first.getId(), initial.getActiveReleaseId());
    assertEquals(1L, initial.getActivationRevision());
    assertEquals(
        409,
        assertThrows(
                OpenMetadataException.class,
                () ->
                    client
                        .tasks()
                        .create(
                            reviewRequest(
                                ns, Entity.ONTOLOGY_RELEASE, first.getFullyQualifiedName())))
            .getStatusCode());
    assertEquals(first.getId(), state(ontology).getActiveReleaseId());
    assertEquals(1L, state(ontology).getActivationRevision());

    client
        .ontologies()
        .update(ontology.getId(), current(ontology).withDescription("Working revision two"));
    final var second = capture(ontology);
    approve(ns, second);
    assertEquals(first.getId(), state(ontology).getActiveReleaseId());
    assertEquals(
        409,
        assertThrows(OpenMetadataException.class, () -> activate(client, ontology, second, 0))
            .getStatusCode());
    assertEquals(second.getId(), activate(client, ontology, second, 1).getActiveReleaseId());
    final var rollback = activate(client, ontology, first, 2);
    assertEquals(first.getId(), rollback.getActiveReleaseId());
    assertEquals(3L, rollback.getActivationRevision());
    final var activationEvents =
        events(first).stream()
            .filter(event -> event.getEventType() == EventType.ACTIVATED)
            .toList();
    assertEquals(
        List.of(1L, 3L),
        activationEvents.stream().map(OntologyReleaseEvent::getActivationRevision).toList());
    assertNull(activationEvents.getFirst().getPreviousReleaseId());
    assertEquals(second.getId(), activationEvents.getLast().getPreviousReleaseId());
    assertEquals(
        List.of(
            EventType.CAPTURED,
            EventType.REVIEW_REQUESTED,
            EventType.APPROVED,
            EventType.ACTIVATED,
            EventType.ACTIVATED),
        events(first).stream().map(event -> event.getEventType()).toList());
    assertEquals(
        first.getContentDigest(), client.ontologyReleases().get(first.getId()).getContentDigest());
  }

  @Test
  void activationRequiresOwnerEditPermissionAndAMatchingLiveOntology(TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final var ontology = createOntology(ns);
    final var other = createOntology(ns, "other");
    final var release = capture(ontology);
    approve(ns, release);
    assertEquals(
        403,
        assertThrows(
                OpenMetadataException.class,
                () -> activate(SdkClients.user2Client(), ontology, release, 0))
            .getStatusCode());
    assertEquals(
        400,
        assertThrows(OpenMetadataException.class, () -> activate(client, other, release, 0))
            .getStatusCode());
    client.ontologies().delete(ontology.getId().toString());
    assertEquals(
        404,
        assertThrows(OpenMetadataException.class, () -> activate(client, ontology, release, 0))
            .getStatusCode());
    assertNull(state(other).getActiveReleaseId());
  }

  @Test
  void concurrentActivationsCommitOnePointerAndOneEvent(TestNamespace ns) throws Exception {
    final var ontology = createOntology(ns);
    final var first = capture(ontology);
    declareClass(ontology, "Second", java.net.URI.create("https://example.org/model/Second"));
    final var second = capture(ontology);
    approve(ns, first);
    approve(ns, second);
    final var ready = new CountDownLatch(2);
    try (var writers = Executors.newFixedThreadPool(2)) {
      final var left = writers.submit(() -> activateTogether(ontology, first, ready));
      final var right = writers.submit(() -> activateTogether(ontology, second, ready));
      assertEquals(1, left.get(30, TimeUnit.SECONDS) + right.get(30, TimeUnit.SECONDS));
    }
    assertEquals(1L, state(ontology).getActivationRevision());
    final long events =
        List.of(first, second).stream()
            .flatMap(release -> events(release).stream())
            .filter(event -> event.getEventType() == EventType.ACTIVATED)
            .count();
    assertEquals(1, events);
  }

  @Test
  void directPublishApprovesAnUnreviewedDraftAndAuditsWhy(TestNamespace ns) {
    final var ontology = unreviewedOntology(ns, "direct");
    declareClass(ontology, "Direct", java.net.URI.create(ontology.getNamespace() + "Direct"));
    final var draft = capture(ontology);
    assertEquals(EntityStatus.DRAFT, draft.getEntityStatus());

    final var author = createUser(ns, "author", "OntologyAuthor");
    final var active = activate(clientFor(author), ontology, draft, 0);

    assertEquals(draft.getId(), active.getActiveReleaseId());
    final var published = current(draft);
    assertEquals(EntityStatus.APPROVED, published.getEntityStatus());
    assertEquals(
        OntologyRelease.ApprovalBasis.NO_REVIEWERS_CONFIGURED, published.getApprovalBasis());
    final var audit = events(draft);
    assertEquals(
        List.of(EventType.CAPTURED, EventType.APPROVED, EventType.ACTIVATED),
        audit.stream().map(OntologyReleaseEvent::getEventType).toList());
    assertEquals(List.of(), audit.get(1).getVoters());
    assertEquals(
        OntologyRelease.ApprovalBasis.NO_REVIEWERS_CONFIGURED, audit.get(1).getApprovalBasis());
    final String caller = author.getName();
    assertEquals(caller, audit.get(1).getCreatedBy());
    assertEquals(caller, audit.get(2).getCreatedBy());
  }

  @Test
  void directPublishPublishesTheReusedDraft(TestNamespace ns) {
    final var ontology = unreviewedOntology(ns, "reused");
    final var first = capture(ontology);
    final var again = capture(ontology);
    assertEquals(first.getId(), again.getId());

    assertEquals(
        again.getId(), activate(SdkClients.adminClient(), ontology, again, 0).getActiveReleaseId());
  }

  @Test
  void aSecondDraftCapturedFromTheSameBaseCannotPublishTheVersionTheFirstTook(TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final var ontology = unreviewedOntology(ns, "twin");
    final var first = captureBumped(ontology);
    declareClass(ontology, "Twin", java.net.URI.create(ontology.getNamespace() + "Twin"));
    final var second = captureBumped(ontology);
    assertEquals("0.1.0", first.getSemanticVersion());
    assertEquals("0.1.0", second.getSemanticVersion());

    activate(client, ontology, first, 0);
    final var refused =
        assertThrows(OpenMetadataException.class, () -> activate(client, ontology, second, 1));

    assertEquals(409, refused.getStatusCode());
    assertTrue(
        refused.getMessage().contains("Version 0.1.0 is already published"), refused.getMessage());
    assertEquals(first.getId(), state(ontology).getActiveReleaseId());
    assertEquals(EntityStatus.DRAFT, current(second).getEntityStatus());
  }

  @Test
  void captureAfterARollbackSuggestsAVersionNoReleaseHasPublished(TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final var ontology = unreviewedOntology(ns, "rolled");
    final var first = captureBumped(ontology);
    activate(client, ontology, first, 0);
    declareClass(ontology, "Next", java.net.URI.create(ontology.getNamespace() + "Next"));
    final var second = captureBumped(ontology);
    assertEquals("0.2.0", second.getSemanticVersion());
    activate(client, ontology, second, 1);
    activate(client, ontology, first, 2);
    declareClass(ontology, "Later", java.net.URI.create(ontology.getNamespace() + "Later"));

    final var third = captureBumped(ontology);

    assertEquals("0.3.0", third.getSemanticVersion());
    assertEquals(third.getId(), activate(client, ontology, third, 3).getActiveReleaseId());
  }

  @Test
  void activationIsRefusedWhileReviewersAreListed(TestNamespace ns) {
    final var ontology = createOntology(ns);
    final var draft = capture(ontology);

    final var refused =
        assertThrows(
            OpenMetadataException.class,
            () -> activate(SdkClients.adminClient(), ontology, draft, 0));

    assertEquals(409, refused.getStatusCode());
    assertTrue(
        refused.getMessage().contains("Reviewers are configured. Request a review."),
        refused.getMessage());
    assertEquals(EntityStatus.DRAFT, current(draft).getEntityStatus());
    assertNull(current(draft).getApprovalBasis());
    assertNull(state(ontology).getActiveReleaseId());
  }

  @Test
  void aReviewerAddedAfterCaptureSendsTheDraftToReview(TestNamespace ns) {
    final var ontology = unreviewedOntology(ns, "late");
    final var draft = capture(ontology);
    setReviewers(ontology, List.of(SharedEntities.get().USER1.getEntityReference()));

    assertEquals(
        409,
        assertThrows(
                OpenMetadataException.class,
                () -> activate(SdkClients.adminClient(), ontology, draft, 0))
            .getStatusCode());

    final var task = submit(ns, Entity.ONTOLOGY_RELEASE, draft.getFullyQualifiedName());
    assertEquals(EntityStatus.IN_REVIEW, current(draft).getEntityStatus());
    assertEquals(task.getId(), current(draft).getReviewTask());
    assertEquals(
        List.of(EventType.CAPTURED, EventType.REVIEW_REQUESTED),
        events(draft).stream().map(OntologyReleaseEvent::getEventType).toList());
  }

  @Test
  void removingEveryReviewerLetsTheDraftPublishDirectly(TestNamespace ns) {
    final var ontology = createOntology(ns);
    final var draft = capture(ontology);
    assertEquals(
        409,
        assertThrows(
                OpenMetadataException.class,
                () -> activate(SdkClients.adminClient(), ontology, draft, 0))
            .getStatusCode());

    setReviewers(ontology, List.of());

    assertEquals(
        draft.getId(), activate(SdkClients.adminClient(), ontology, draft, 0).getActiveReleaseId());
    assertEquals(
        OntologyRelease.ApprovalBasis.NO_REVIEWERS_CONFIGURED, current(draft).getApprovalBasis());
  }

  @Test
  void anOpenReviewKeepsItsReviewersAndWithdrawalIsAudited(TestNamespace ns) {
    final var ontology = createOntology(ns);
    final var draft = capture(ontology);
    final var task = submit(ns, Entity.ONTOLOGY_RELEASE, draft.getFullyQualifiedName());

    final var locked =
        assertThrows(OpenMetadataException.class, () -> setReviewers(ontology, List.of()));

    assertEquals(409, locked.getStatusCode());
    assertEquals(1, current(ontology).getReviewers().size());
    final var workflow = WorkflowHandler.getInstance();
    workflow
        .getRuntimeService()
        .deleteProcessInstance(
            workflow.approvalTaskContext(task.getId()).processInstanceId(), "Review withdrawn");
    new OntologyReviewReconciler(Entity.getCollectionDAO()).reconcile(task.getId());
    assertEquals(EntityStatus.DRAFT, current(draft).getEntityStatus());
    assertEquals(
        List.of(EventType.CAPTURED, EventType.REVIEW_REQUESTED, EventType.REVIEW_WITHDRAWN),
        events(draft).stream().map(OntologyReleaseEvent::getEventType).toList());
  }

  @Test
  void reviewerChangesAndDirectPublishesAlwaysSerialize(TestNamespace ns) throws Exception {
    final int pairs = 50;
    final var ontologies = new java.util.ArrayList<Ontology>();
    final var drafts = new java.util.ArrayList<OntologyRelease>();
    for (int i = 0; i < pairs; i++) {
      final var ontology = unreviewedOntology(ns, "race" + i);
      ontologies.add(ontology);
      drafts.add(capture(ontology));
    }
    final var reviewer = SharedEntities.get().USER1.getEntityReference();
    final var start = new CountDownLatch(1);
    final var results = new java.util.ArrayList<java.util.concurrent.Future<Integer>>();
    try (var pool = Executors.newFixedThreadPool(32)) {
      for (int i = 0; i < pairs; i++) {
        final var ontology = ontologies.get(i);
        final var draft = drafts.get(i);
        pool.submit(
            () -> {
              start.await();
              setReviewers(ontology, List.of(reviewer));
              return null;
            });
        results.add(
            pool.submit(
                () -> {
                  start.await();
                  try {
                    activate(SdkClients.adminClient(), ontology, draft, 0);
                    return 200;
                  } catch (OpenMetadataException refused) {
                    return refused.getStatusCode();
                  }
                }));
      }
      start.countDown();
      pool.shutdown();
      assertTrue(pool.awaitTermination(180, TimeUnit.SECONDS));
    }
    for (int i = 0; i < pairs; i++) {
      final int status = results.get(i).get();
      final var draft = current(drafts.get(i));
      final var active = state(ontologies.get(i)).getActiveReleaseId();
      assertEquals(1, current(ontologies.get(i)).getReviewers().size());
      if (status == 200) {
        assertEquals(draft.getId(), active);
        assertEquals(EntityStatus.APPROVED, draft.getEntityStatus());
        assertEquals(
            OntologyRelease.ApprovalBasis.NO_REVIEWERS_CONFIGURED, draft.getApprovalBasis());
      } else {
        assertEquals(409, status);
        assertNull(active);
        assertEquals(EntityStatus.DRAFT, draft.getEntityStatus());
        assertNull(draft.getApprovalBasis());
      }
      assertTrue(draft.getEntityStatus() != EntityStatus.IN_REVIEW);
    }
  }

  @Test
  void rolesWithoutAuthorRightsCannotPublishDirectly(TestNamespace ns) {
    final var ontology = unreviewedOntology(ns, "forbidden");
    final var draft = capture(ontology);
    for (final String role : List.of("DataConsumer", "NONE")) {
      final var user = createUser(ns, "pub", role);
      assertEquals(
          403,
          assertThrows(
                  OpenMetadataException.class, () -> activate(clientFor(user), ontology, draft, 0))
              .getStatusCode(),
          role);
    }
    final var reviewerUser = createUser(ns, "listed", "OntologyReviewer");
    setReviewers(ontology, List.of(reviewerUser.getEntityReference()));
    assertEquals(
        403,
        assertThrows(
                OpenMetadataException.class,
                () -> activate(clientFor(reviewerUser), ontology, draft, 0))
            .getStatusCode());
    assertNull(state(ontology).getActiveReleaseId());
    assertEquals(EntityStatus.DRAFT, current(draft).getEntityStatus());
  }

  @Test
  void secondReleaseAndRollbackNeedNoReview(TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final var ontology = unreviewedOntology(ns, "history");
    final var first = capture(ontology);
    assertEquals(first.getId(), activate(client, ontology, first, 0).getActiveReleaseId());
    declareClass(ontology, "Second", java.net.URI.create(ontology.getNamespace() + "Second"));
    final var second = capture(ontology);

    assertEquals(second.getId(), activate(client, ontology, second, 1).getActiveReleaseId());
    final var rolledBack = activate(client, ontology, first, 2);

    assertEquals(first.getId(), rolledBack.getActiveReleaseId());
    assertEquals(3L, rolledBack.getActivationRevision());
    assertEquals(
        List.of(EventType.CAPTURED, EventType.APPROVED, EventType.ACTIVATED, EventType.ACTIVATED),
        events(first).stream().map(OntologyReleaseEvent::getEventType).toList());
  }

  @Test
  void activatingTheActiveReleaseAgainAddsNoEvent(TestNamespace ns) {
    final var ontology = unreviewedOntology(ns, "noop");
    final var draft = capture(ontology);
    activate(SdkClients.adminClient(), ontology, draft, 0);

    final var again = activate(SdkClients.adminClient(), ontology, draft, 1);

    assertEquals(draft.getId(), again.getActiveReleaseId());
    assertEquals(1L, again.getActivationRevision());
    assertEquals(3, events(draft).size());
  }

  @Test
  @ResourceLock("ontology-sparql-worker")
  void queryReadsTheConceptsOfADirectlyPublishedRelease(TestNamespace ns) {
    final var ontology = unreviewedOntology(ns, "query");
    final var concept =
        declareClass(ontology, "Queried", java.net.URI.create(ontology.getNamespace() + "Queried"));
    activate(SdkClients.adminClient(), ontology, capture(ontology), 0);

    final var result =
        SdkClients.user2Client()
            .getHttpClient()
            .execute(
                HttpMethod.POST,
                "/v1/ontologies/" + ontology.getId() + "/sparql",
                new SparqlQuery()
                    .withQuery(
                        "SELECT ?class WHERE { ?class a <http://www.w3.org/2002/07/owl#Class> }"),
                JsonNode.class);

    assertEquals(1, result.path("results").path("bindings").size());
    assertEquals(
        concept.getIri().toString(),
        result.path("results").path("bindings").get(0).path("class").path("value").asText());
  }

  @Test
  void rejectingWithoutAReasonIsRefusedByTheServer(TestNamespace ns) {
    final var ontology = createOntology(ns);
    final var draft = capture(ontology);
    final var task = submit(ns, Entity.ONTOLOGY_RELEASE, draft.getFullyQualifiedName());

    final var refused =
        assertThrows(
            OpenMetadataException.class,
            () ->
                SdkClients.user1Client()
                    .tasks()
                    .resolve(
                        task.getId().toString(),
                        new ResolveTask().withResolutionType(TaskResolutionType.Rejected)));

    assertEquals(400, refused.getStatusCode());
    assertTrue(
        refused.getMessage().contains("A rejection requires a reason"), refused.getMessage());
    assertEquals(EntityStatus.IN_REVIEW, current(draft).getEntityStatus());
  }

  private static OntologyRelease captureBumped(Ontology ontology) {
    final var service = SdkClients.adminClient().ontologies();
    final var state = service.state(ontology.getId());
    return service.capture(
        ontology.getId(),
        new CaptureOntologyRelease()
            .withExpectedWorkingRevision(state.getWorkingRevision())
            .withExpectedLatestReleaseRevision(state.getLastReleaseRevision())
            .withVersionBump(CaptureOntologyRelease.VersionBump.MINOR));
  }

  private static Ontology unreviewedOntology(TestNamespace ns, String name) {
    final Ontology ontology =
        SdkClients.adminClient()
            .ontologies()
            .create(
                request(ns)
                    .withName(ns.prefix(name))
                    .withIri(
                        java.net.URI.create("https://example.org/model/" + ns.shortPrefix(name)))
                    .withReviewers(List.of()));
    ns.trackRoot("ontology", ontology);
    return ontology;
  }

  private static void setReviewers(Ontology ontology, List<EntityReference> reviewers) {
    SdkClients.adminClient()
        .ontologies()
        .patch(
            ontology.getId(),
            JsonUtils.readTree(
                "[{\"op\":\"add\",\"path\":\"/reviewers\",\"value\":"
                    + JsonUtils.pojoToJson(reviewers)
                    + "}]"));
  }

  private static User createUser(TestNamespace ns, String base, String role) {
    final String name = ns.shortPrefix(base + role);
    final CreateUser request =
        new CreateUser().withName(name).withEmail(name + "@test.om.org").withDescription("v7 user");
    if (!"NONE".equals(role)) {
      request.withRoles(List.of(SdkClients.adminClient().roles().getByName(role).getId()));
    }
    return ns.trackRoot(Entity.USER, SdkClients.adminClient().users().create(request));
  }

  private static OpenMetadataClient clientFor(User user) {
    return SdkClients.createClient(user.getEmail(), user.getEmail(), new String[] {});
  }

  private static int activateTogether(
      Ontology ontology, OntologyRelease release, CountDownLatch ready)
      throws InterruptedException {
    ready.countDown();
    assertTrue(ready.await(10, TimeUnit.SECONDS));
    try {
      activate(SdkClients.adminClient(), ontology, release, 0);
      return 1;
    } catch (OpenMetadataException conflict) {
      assertEquals(409, conflict.getStatusCode());
      return 0;
    }
  }

  private static void approve(TestNamespace ns, OntologyRelease release) {
    final var task = submit(ns, Entity.ONTOLOGY_RELEASE, release.getFullyQualifiedName());
    SdkClients.user1Client()
        .tasks()
        .resolve(task.getId().toString(), decision(TaskResolutionType.Approved));
  }

  private static OntologyState activate(
      OpenMetadataClient client, Ontology ontology, OntologyRelease release, long expected) {
    return client
        .ontologies()
        .activate(
            ontology.getId(),
            new ActivateOntologyRelease()
                .withReleaseId(release.getId())
                .withExpectedActivationRevision(expected));
  }

  private static OntologyState state(Ontology ontology) {
    return SdkClients.adminClient().ontologies().state(ontology.getId());
  }

  private static List<OntologyReleaseEvent> events(OntologyRelease release) {
    final var response =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/ontologyReleases/" + release.getId() + "/events?limit=10",
                null,
                JsonNode.class);
    return JsonUtils.readObjects(response.path("data").toString(), OntologyReleaseEvent.class);
  }
}
