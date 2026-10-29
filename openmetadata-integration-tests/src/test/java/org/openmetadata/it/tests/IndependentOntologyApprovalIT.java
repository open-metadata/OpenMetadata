package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IndependentOntologyApprovalIT extends BaseOntologyApprovalIT {
  @Test
  void consumersCannotSubmitOntologyReviews(TestNamespace ns) {
    OntologyRelease target = capture(createOntology(ns));
    OpenMetadataException denied =
        assertThrows(
            OpenMetadataException.class,
            () ->
                SdkClients.user2Client()
                    .tasks()
                    .create(
                        reviewRequest(
                            ns, Entity.ONTOLOGY_RELEASE, target.getFullyQualifiedName())));
    assertEquals(403, denied.getStatusCode());
    assertEquals(
        0,
        SdkClients.adminClient()
            .tasks()
            .list(new ListParams().addFilter("aboutEntity", target.getFullyQualifiedName()))
            .getTotal());
  }

  @Test
  void aSecondSubmissionCannotReplaceAnOpenReview(TestNamespace ns) {
    OntologyRelease target = capture(createOntology(ns));
    Task first = submit(ns, Entity.ONTOLOGY_RELEASE, target.getFullyQualifiedName());
    OpenMetadataException conflict =
        assertThrows(
            OpenMetadataException.class,
            () ->
                SdkClients.adminClient()
                    .tasks()
                    .create(
                        reviewRequest(
                            ns, Entity.ONTOLOGY_RELEASE, target.getFullyQualifiedName())));
    assertEquals(409, conflict.getStatusCode());
    assertEquals(
        List.of(first.getId()),
        SdkClients.adminClient()
            .tasks()
            .list(new ListParams().addFilter("aboutEntity", target.getFullyQualifiedName()))
            .getData()
            .stream()
            .map(Task::getId)
            .toList());
    SdkClients.user1Client()
        .tasks()
        .resolve(first.getId().toString(), decision(TaskResolutionType.Approved));
  }

  @ParameterizedTest
  @EnumSource(
      value = TaskResolutionType.class,
      names = {"Approved", "Rejected"})
  void decidedReleasesCannotStartAnotherReview(TaskResolutionType resolution, TestNamespace ns) {
    final OntologyRelease release = capture(createOntology(ns, "decided" + resolution));
    final Task task = submit(ns, Entity.ONTOLOGY_RELEASE, release.getFullyQualifiedName());
    SdkClients.user1Client().tasks().resolve(task.getId().toString(), decision(resolution));
    final OntologyRelease decided = current(release);
    assertEquals(
        409,
        assertThrows(
                OpenMetadataException.class,
                () ->
                    SdkClients.adminClient()
                        .tasks()
                        .create(
                            reviewRequest(
                                ns, Entity.ONTOLOGY_RELEASE, release.getFullyQualifiedName())))
            .getStatusCode());
    assertEquals(decided.getEntityStatus(), current(release).getEntityStatus());
    assertEquals(decided.getVersion(), current(release).getVersion());
    assertEquals(
        1,
        SdkClients.adminClient()
            .tasks()
            .list(new ListParams().addFilter("aboutEntity", release.getFullyQualifiedName()))
            .getTotal());
  }

  @Test
  void concurrentSubmissionsCommitOnlyOneReviewTask(TestNamespace ns) throws Exception {
    OntologyRelease ontology = capture(createOntology(ns));
    CountDownLatch start = new CountDownLatch(1);
    List<Task> created = new ArrayList<>();
    try (var writers = Executors.newFixedThreadPool(2)) {
      List<Future<Task>> submissions = new ArrayList<>();
      for (int writer = 0; writer < 2; writer++) {
        submissions.add(
            writers.submit(
                () -> {
                  start.await(10, TimeUnit.SECONDS);
                  try {
                    return SdkClients.adminClient()
                        .tasks()
                        .create(
                            reviewRequest(
                                ns, Entity.ONTOLOGY_RELEASE, ontology.getFullyQualifiedName()));
                  } catch (OpenMetadataException conflict) {
                    assertEquals(409, conflict.getStatusCode());
                    return null;
                  }
                }));
      }
      start.countDown();
      for (Future<Task> submission : submissions) {
        Task task = submission.get(30, TimeUnit.SECONDS);
        if (task != null) {
          ns.trackRoot("task", task);
          created.add(task);
        }
      }
    }
    assertEquals(1, created.size());
    assertEquals(created.getFirst().getId(), current(ontology).getReviewTask());
    assertEquals(
        1,
        SdkClients.adminClient()
            .tasks()
            .list(new ListParams().addFilter("aboutEntity", ontology.getFullyQualifiedName()))
            .getTotal());
  }

  @Test
  void ownershipChangesPreserveApprovedContent(TestNamespace ns) {
    Ontology root = createOntology(ns);
    OntologyRelease release = capture(root);
    Task task = submit(ns, Entity.ONTOLOGY_RELEASE, release.getFullyQualifiedName());
    SdkClients.user1Client()
        .tasks()
        .resolve(task.getId().toString(), decision(TaskResolutionType.Approved));
    SdkClients.adminClient()
        .ontologies()
        .update(
            root.getId(),
            current(root).withOwners(List.of(SharedEntities.get().USER2.getEntityReference())));
    OntologyRelease approved = current(release);
    assertEquals(EntityStatus.APPROVED, approved.getEntityStatus());
    assertEquals(release.getContentDigest(), approved.getContentDigest());
    assertEquals(task.getId(), approved.getReviewTask());
  }

  @Test
  void existingApprovalWorkflowApprovesExactlyTheSubmittedRevision(TestNamespace ns) {
    OntologyRelease ontology = capture(createOntology(ns));
    Task task = submit(ns, Entity.ONTOLOGY_RELEASE, ontology.getFullyQualifiedName());
    assertNotNull(task.getOntologyReview());
    assertEquals(ontology.getId(), task.getOntologyReview().getEntityId());
    assertEquals(EntityStatus.IN_REVIEW, current(ontology).getEntityStatus());

    Task resolved =
        SdkClients.user1Client()
            .tasks()
            .resolve(task.getId().toString(), decision(TaskResolutionType.Approved));

    assertEquals(TaskEntityStatus.Approved, resolved.getStatus());
    assertEquals(EntityStatus.APPROVED, current(ontology).getEntityStatus());
    assertEquals(ontology.getReleaseRevision(), current(ontology).getReleaseRevision());
    assertThrows(
        OpenMetadataException.class,
        () ->
            SdkClients.user1Client()
                .tasks()
                .resolve(task.getId().toString(), decision(TaskResolutionType.Approved)));
  }

  @Test
  void contentAuthorCannotApproveEvenAsAdministrator(TestNamespace ns) {
    OntologyRelease ontology = capture(createOntology(ns));
    Task task = submit(ns, Entity.ONTOLOGY_RELEASE, ontology.getFullyQualifiedName());

    assertThrows(
        OpenMetadataException.class,
        () ->
            SdkClients.adminClient()
                .tasks()
                .resolve(task.getId().toString(), decision(TaskResolutionType.Approved)));
    assertEquals(EntityStatus.IN_REVIEW, current(ontology).getEntityStatus());
  }

  @Test
  void missingReviewHistoryCannotBeReplacedByTheCurrentDefinition(TestNamespace ns) {
    final OntologyRelease definition = capture(createOntology(ns));
    final Task task = submit(ns, Entity.ONTOLOGY_RELEASE, definition.getFullyQualifiedName());
    final String extension =
        EntityUtil.getVersionExtension(
            Entity.ONTOLOGY_RELEASE, task.getOntologyReview().getEntityVersion());
    final var history = Entity.getCollectionDAO().entityExtensionDAO();
    assertNotNull(history.getExtension(definition.getId(), extension));
    history.delete(definition.getId(), extension);

    assertThrows(
        OpenMetadataException.class,
        () ->
            SdkClients.user1Client()
                .tasks()
                .resolve(task.getId().toString(), decision(TaskResolutionType.Approved)));
    assertNotEquals(EntityStatus.APPROVED, current(definition).getEntityStatus());
  }

  @Test
  void definitionsWithoutReviewersCannotStartAnApproval(TestNamespace ns) {
    Ontology ontology =
        SdkClients.adminClient().ontologies().create(request(ns).withReviewers(List.of()));
    ns.trackRoot("ontology", ontology);

    OntologyRelease release = capture(ontology);
    assertThrows(
        OpenMetadataException.class,
        () ->
            SdkClients.adminClient()
                .tasks()
                .create(
                    reviewRequest(ns, Entity.ONTOLOGY_RELEASE, release.getFullyQualifiedName())));
    assertEquals(EntityStatus.DRAFT, current(release).getEntityStatus());
  }

  @Test
  void cancelledReviewRequiresAFreshTaskAndCanBeResubmitted(TestNamespace ns) {
    OntologyRelease ontology = capture(createOntology(ns));
    Task original = submit(ns, Entity.ONTOLOGY_RELEASE, ontology.getFullyQualifiedName());
    Task cancelled = SdkClients.adminClient().tasks().close(original.getId().toString());

    assertEquals(TaskEntityStatus.Cancelled, cancelled.getStatus());
    assertEquals(EntityStatus.DRAFT, current(ontology).getEntityStatus());
    assertNull(current(ontology).getReviewTask());
    assertEquals(ontology.getReleaseRevision(), current(ontology).getReleaseRevision());
    assertThrows(
        OpenMetadataException.class,
        () ->
            SdkClients.adminClient()
                .tasks()
                .patch(
                    cancelled.getId().toString(),
                    JsonUtils.readTree(
                        "[{\"op\":\"replace\",\"path\":\"/status\",\"value\":\"Open\"}]")));
    assertThrows(
        OpenMetadataException.class,
        () ->
            SdkClients.user1Client()
                .tasks()
                .resolve(original.getId().toString(), decision(TaskResolutionType.Approved)));

    Task resubmitted = submit(ns, Entity.ONTOLOGY_RELEASE, ontology.getFullyQualifiedName());
    assertNotEquals(original.getId(), resubmitted.getId());
    assertEquals(resubmitted.getId(), current(ontology).getReviewTask());
    SdkClients.user1Client()
        .tasks()
        .resolve(resubmitted.getId().toString(), decision(TaskResolutionType.Approved));
    assertEquals(EntityStatus.APPROVED, current(ontology).getEntityStatus());
  }

  @Test
  void workingDefinitionsHaveNoIndependentApprovalLifecycle(TestNamespace ns) {
    Ontology root = createOntology(ns);
    var concept = declareClass(root, "Customer", URI.create("urn:Customer"));
    for (var definition : List.of(root.getEntityReference(), concept.getEntityReference())) {
      assertEquals(
          400,
          assertThrows(
                  OpenMetadataException.class,
                  () ->
                      SdkClients.adminClient()
                          .tasks()
                          .create(
                              reviewRequest(
                                  ns, definition.getType(), definition.getFullyQualifiedName())))
              .getStatusCode());
    }
  }
}
