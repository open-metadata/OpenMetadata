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
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.ActivateOntologyRelease;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.OntologyReleaseEvent;
import org.openmetadata.schema.type.OntologyReleaseEvent.EventType;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IndependentOntologyActivationIT extends BaseOntologyApprovalIT {
  @Test
  void approvalActivationAndRollbackAreSeparateAuditedTransitions(TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final var ontology = createOntology(ns);
    final var first = capture(ontology);
    assertEquals(
        400,
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
        List.of(EventType.CAPTURED, EventType.APPROVED, EventType.ACTIVATED, EventType.ACTIVATED),
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
