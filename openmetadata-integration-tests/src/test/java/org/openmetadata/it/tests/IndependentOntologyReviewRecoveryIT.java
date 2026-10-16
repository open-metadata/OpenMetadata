package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.OntologyApprovalWorkflow;
import org.openmetadata.service.governance.workflows.OntologyReviewReconciler;
import org.openmetadata.service.governance.workflows.OntologyWorkflowDecision;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.governance.workflows.WorkflowHandler.TaskResolutionOutcome;
import org.openmetadata.service.jdbi3.TaskRepository;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IndependentOntologyReviewRecoveryIT extends BaseOntologyApprovalIT {
  @Test
  void committedWorkflowDecisionIsRecoveredWithoutVotingAgain(TestNamespace ns) {
    OntologyRelease ontology = capture(createOntology(ns));
    Task task = submit(ns, Entity.ONTOLOGY_RELEASE, ontology.getFullyQualifiedName());
    completeWorkflowOnly(task);
    OntologyReviewReconciler reconciler = new OntologyReviewReconciler(Entity.getCollectionDAO());

    reconciler.reconcile(task.getId());
    OntologyRelease approved = current(ontology);
    assertEquals(EntityStatus.APPROVED, approved.getEntityStatus());
    assertEquals(
        TaskEntityStatus.Approved,
        SdkClients.adminClient().tasks().get(task.getId().toString()).getStatus());
    reconciler.reconcile(task.getId());
    assertEquals(approved.getVersion(), current(ontology).getVersion());
    assertNull(
        Entity.getCollectionDAO()
            .entityExtensionDAO()
            .getExtension(task.getId(), OntologyReviewReconciler.EXTENSION));
  }

  @Test
  void simultaneousRecoveryAttemptsApplyOneDecision(TestNamespace ns) throws Exception {
    OntologyRelease ontology = capture(createOntology(ns));
    Task task = submit(ns, Entity.ONTOLOGY_RELEASE, ontology.getFullyQualifiedName());
    completeWorkflowOnly(task);
    reconcileConcurrently(task);

    assertEquals(EntityStatus.APPROVED, current(ontology).getEntityStatus());
    assertEquals(0.3, current(ontology).getVersion());
    assertEquals(
        TaskEntityStatus.Approved,
        SdkClients.adminClient().tasks().get(task.getId().toString()).getStatus());
  }

  private static void reconcileConcurrently(Task task) throws Exception {
    CountDownLatch start = new CountDownLatch(1);
    try (var workers = Executors.newVirtualThreadPerTaskExecutor()) {
      List<? extends Future<?>> recoveries =
          IntStream.range(0, 4)
              .mapToObj(
                  index ->
                      workers.submit(
                          () -> {
                            assertTrue(start.await(30, TimeUnit.SECONDS));
                            new OntologyReviewReconciler(Entity.getCollectionDAO())
                                .reconcile(task.getId());
                            return null;
                          }))
              .toList();
      start.countDown();
      for (Future<?> recovery : recoveries) {
        recovery.get(30, TimeUnit.SECONDS);
      }
    }
  }

  @Test
  void recoveryUsesTheCapturedReleaseAfterFurtherWorkingEdits(TestNamespace ns) {
    Ontology root = createOntology(ns);
    OntologyRelease release = capture(root);
    Task task = submit(ns, Entity.ONTOLOGY_RELEASE, release.getFullyQualifiedName());
    completeWorkflowOnly(task);
    SdkClients.adminClient()
        .ontologies()
        .update(root.getId(), current(root).withDescription("Next release"));
    new OntologyReviewReconciler(Entity.getCollectionDAO()).reconcile(task.getId());
    assertEquals(EntityStatus.APPROVED, current(release).getEntityStatus());
    assertEquals(release.getContentDigest(), current(release).getContentDigest());
    assertEquals(
        TaskEntityStatus.Approved, SdkClients.adminClient().tasks().get(task.getId()).getStatus());
  }

  @Test
  void cancelledReviewRemovesItsWorkflowExecutions(TestNamespace ns) {
    OntologyRelease ontology = capture(createOntology(ns));
    Task task = submit(ns, Entity.ONTOLOGY_RELEASE, ontology.getFullyQualifiedName());
    assertTrue(WorkflowHandler.getInstance().hasActiveRuntimeTask(task.getId()));
    SdkClients.adminClient().tasks().close(task.getId().toString());

    OntologyReviewReconciler reconciler = new OntologyReviewReconciler(Entity.getCollectionDAO());
    Awaitility.await()
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> {
              reconciler.reconcile(task.getId());
              assertEquals(
                  0,
                  WorkflowHandler.getInstance()
                      .getRuntimeService()
                      .createProcessInstanceQuery()
                      .processInstanceBusinessKey(task.getWorkflowInstanceId().toString())
                      .count());
            });
    reconciler.reconcile(task.getId());
    assertEquals(EntityStatus.DRAFT, current(ontology).getEntityStatus());
    assertNull(
        Entity.getCollectionDAO()
            .entityExtensionDAO()
            .getExtension(task.getId(), OntologyReviewReconciler.EXTENSION));
  }

  @Test
  void workflowFailureBeforeTheFirstVoteReturnsTheDefinitionToDraft(TestNamespace ns) {
    OntologyRelease ontology = capture(createOntology(ns));
    Task task = submit(ns, Entity.ONTOLOGY_RELEASE, ontology.getFullyQualifiedName());
    WorkflowHandler workflow = WorkflowHandler.getInstance();
    String processId = workflow.approvalTaskContext(task.getId()).processInstanceId();
    workflow.getRuntimeService().deleteProcessInstance(processId, "Failure before the first vote");

    new OntologyReviewReconciler(Entity.getCollectionDAO()).reconcile(task.getId());

    assertEquals(EntityStatus.DRAFT, current(ontology).getEntityStatus());
    assertEquals(
        TaskEntityStatus.Cancelled,
        SdkClients.adminClient().tasks().get(task.getId().toString()).getStatus());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void activeReviewCannotBeDeletedBeforeItIsClosed(boolean hardDelete, TestNamespace ns) {
    OntologyRelease ontology = capture(createOntology(ns, "deleteTask" + hardDelete));
    Task task = submit(ns, Entity.ONTOLOGY_RELEASE, ontology.getFullyQualifiedName());

    OpenMetadataException rejected =
        assertThrows(
            OpenMetadataException.class,
            () ->
                SdkClients.adminClient()
                    .tasks()
                    .delete(
                        task.getId().toString(),
                        Map.of("hardDelete", Boolean.toString(hardDelete))));

    assertEquals(400, rejected.getStatusCode());
    assertEquals(EntityStatus.IN_REVIEW, current(ontology).getEntityStatus());
    SdkClients.adminClient().tasks().close(task.getId().toString());
    assertEquals(EntityStatus.DRAFT, current(ontology).getEntityStatus());
  }

  @Test
  void archivingTheOntologyCancelsItsReleaseReview(TestNamespace ns) {
    OntologyRelease ontology = capture(createOntology(ns));
    Task task = submit(ns, Entity.ONTOLOGY_RELEASE, ontology.getFullyQualifiedName());
    SdkClients.adminClient().ontologies().delete(ontology.getOntology().getId().toString());

    new OntologyReviewReconciler(Entity.getCollectionDAO()).reconcile(task.getId());

    assertEquals(
        TaskEntityStatus.Cancelled,
        SdkClients.adminClient().tasks().get(task.getId().toString()).getStatus());
  }

  @Test
  void aCrashBeforeWorkflowStartDoesNotStrandTheDefinition(TestNamespace ns) {
    OntologyRelease ontology = capture(createOntology(ns));
    Task task =
        persistUnstartedReview(
            ns,
            ontology,
            System.currentTimeMillis() - Duration.ofMinutes(10).toMillis(),
            TaskRepository.PENDING_WORKFLOW_START_STAGE_ID);

    new OntologyReviewReconciler(Entity.getCollectionDAO()).reconcile(task.getId());

    assertEquals(EntityStatus.DRAFT, current(ontology).getEntityStatus());
    assertEquals(
        TaskEntityStatus.Cancelled,
        SdkClients.adminClient().tasks().get(task.getId().toString()).getStatus());
  }

  @Test
  void aFailedWorkflowStartReturnsTheDefinitionToDraft(TestNamespace ns) {
    OntologyRelease ontology = capture(createOntology(ns));
    Task task =
        persistUnstartedReview(
            ns,
            ontology,
            System.currentTimeMillis(),
            TaskRepository.WORKFLOW_START_FAILED_STAGE_ID);

    new OntologyReviewReconciler(Entity.getCollectionDAO()).reconcile(task.getId());

    assertEquals(EntityStatus.DRAFT, current(ontology).getEntityStatus());
    assertEquals(
        TaskEntityStatus.Cancelled,
        SdkClients.adminClient().tasks().get(task.getId().toString()).getStatus());
  }

  @Test
  void aRecentSubmissionHasTimeToStartItsWorkflow(TestNamespace ns) {
    OntologyRelease ontology = capture(createOntology(ns));
    Task task =
        persistUnstartedReview(
            ns,
            ontology,
            System.currentTimeMillis(),
            TaskRepository.PENDING_WORKFLOW_START_STAGE_ID);

    new OntologyReviewReconciler(Entity.getCollectionDAO()).reconcile(task.getId());

    assertEquals(EntityStatus.IN_REVIEW, current(ontology).getEntityStatus());
    assertEquals(
        TaskEntityStatus.Open,
        SdkClients.adminClient().tasks().get(task.getId().toString()).getStatus());
  }

  private static Task persistUnstartedReview(
      TestNamespace ns, OntologyRelease ontology, long createdAt, String stage) {
    TaskRepository tasks = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    Task task =
        new Task()
            .withId(UUID.randomUUID())
            .withType(TaskEntityType.RequestApproval)
            .withCategory(TaskCategory.Approval)
            .withAbout(ontology.getEntityReference())
            .withCreatedBy(SdkClients.adminClient().users().getByName("admin").getEntityReference())
            .withCreatedAt(createdAt)
            .withUpdatedAt(createdAt)
            .withUpdatedBy("admin")
            .withVersion(0.1)
            .withDeleted(false);
    tasks.prepareInternal(task, false);
    task.setWorkflowStageId(stage);
    tasks.executeInTransaction(
        () -> {
          tasks.storeEntity(task, false);
          tasks.storeRelationships(task);
          return null;
        });
    return ns.trackRoot(Entity.TASK, task);
  }

  private static void completeWorkflowOnly(Task snapshot) {
    TaskRepository tasks = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    Task task = tasks.get(null, snapshot.getId(), tasks.getFields("*"));
    String user = SharedEntities.get().USER1.getName();
    OntologyApprovalWorkflow.validate(task, user);
    OntologyApprovalWorkflow.validateRuntime(task);
    WorkflowHandler workflow = WorkflowHandler.getInstance();
    Map<String, Object> variables =
        workflow.transformToNodeVariables(
            task.getId(), Map.of("result", "approve", "updatedBy", user));
    OntologyApprovalWorkflow.recordDecision(
        task,
        new OntologyWorkflowDecision(
            task.getId(),
            task.getOntologyReview(),
            TaskResolutionType.Approved,
            user,
            List.of(user),
            null,
            "Committed before restart"),
        variables);
    TaskResolutionOutcome outcome = workflow.resolveTaskOutcome(task.getId(), variables);
    assertTrue(
        outcome == TaskResolutionOutcome.COMPLETED
            || outcome == TaskResolutionOutcome.STAGE_ADVANCED);
  }
}
