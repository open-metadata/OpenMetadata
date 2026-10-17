package org.openmetadata.service.governance.workflows;

import static org.openmetadata.service.governance.workflows.WorkflowEventConsumer.GOVERNANCE_BOT;

import io.dropwizard.lifecycle.Managed;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.history.HistoricProcessInstance;
import org.flowable.engine.runtime.ProcessInstance;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TaskResolution;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.WorkflowInstanceConflictException;
import org.openmetadata.service.governance.workflows.WorkflowHandler.TaskResolutionOutcome;
import org.openmetadata.service.governance.workflows.WorkflowInstanceTerminator.TerminationRequest;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.jdbi3.WorkflowInstanceRepository;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.tasks.TaskWorkflowLifecycleResolver.WorkflowStartVariables;
import org.openmetadata.service.util.FreshReadScope;

/** Replays committed workflow decisions; the task and definition still own their lifecycle. */
@Slf4j
public final class OntologyReviewReconciler implements Managed {
  public static final String EXTENSION = "ontology.reviewExecution";
  private static final int PAGE_SIZE = 100;
  private static final Duration START_TIMEOUT = Duration.ofMinutes(5);
  private final CollectionDAO dao;
  private ScheduledExecutorService scheduler;
  private String after = "";

  public record Execution(String processInstanceId) {}

  public OntologyReviewReconciler(final CollectionDAO dao) {
    this.dao = dao;
  }

  @Override
  public void start() {
    scheduler =
        Executors.newSingleThreadScheduledExecutor(
            Thread.ofPlatform().daemon().name("ontology-review-reconciliation").factory());
    scheduler.scheduleWithFixedDelay(this::runSafely, 10, 30, TimeUnit.SECONDS);
  }

  @Override
  public void stop() {
    if (scheduler != null) {
      scheduler.shutdownNow();
    }
  }

  private void runSafely() {
    try {
      runOnce();
    } catch (RuntimeException exception) {
      LOG.warn("Unable to read pending ontology reviews", exception);
    }
  }

  public void runOnce() {
    if (!WorkflowHandler.isInitialized()) {
      return;
    }
    final List<String> ids = dao.entityExtensionDAO().listExtensionIds(EXTENSION, after, PAGE_SIZE);
    for (final String id : ids) {
      try {
        reconcile(UUID.fromString(id));
      } catch (RuntimeException exception) {
        LOG.warn("Ontology review {} remains pending reconciliation", id, exception);
      }
    }
    after = ids.size() == PAGE_SIZE ? ids.getLast() : "";
  }

  public void reconcile(final UUID taskId) {
    final String json = dao.entityExtensionDAO().getExtension(taskId, EXTENSION);
    if (json == null) {
      return;
    }
    try (FreshReadScope.Handle ignored = FreshReadScope.enter()) {
      final TaskRepository tasks = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
      final Task stored = tasks.findCommittedTask(taskId);
      if (stored == null) {
        cancelExecution(taskId);
        return;
      }
      final Task task = tasks.get(null, taskId, tasks.getFields("*"), Include.ALL, false);
      if (TaskRepository.isTerminalStatus(task.getStatus())
          || task.getResolution() != null
          || Boolean.TRUE.equals(task.getDeleted())) {
        cancelExecution(taskId);
      } else {
        try {
          OntologyApprovalWorkflow.validateCurrentReview(task);
          reconcileDecision(tasks, task, JsonUtils.readValue(json, Execution.class));
        } catch (BadRequestException | AuthorizationException | EntityNotFoundException exception) {
          LOG.info(
              "Ontology review {} awaits a valid review context: {}",
              taskId,
              exception.getMessage());
        }
      }
    }
  }

  private void reconcileDecision(
      final TaskRepository tasks, final Task task, final Execution execution) {
    final String processId =
        execution.processInstanceId() == null ? findExecution(task) : execution.processInstanceId();
    if (processId == null) {
      if (failedToStart(task)) {
        cancelObsoleteReview(tasks, task, "The ontology approval workflow failed to start");
      }
      return;
    }
    final WorkflowHandler workflow = WorkflowHandler.getInstance();
    final TaskResolutionOutcome outcome = workflow.taskResolutionOutcome(processId);
    if (outcome == TaskResolutionOutcome.COMPLETED) {
      final OntologyWorkflowDecision decision =
          workflow.completedOntologyDecision(processId).orElse(null);
      if (decision != null) {
        OntologyApprovalWorkflow.completeDecision(task, decision);
      } else {
        cancelObsoleteReview(
            tasks, task, "The workflow completed without an ontology approval decision");
      }
    } else if (outcome == TaskResolutionOutcome.PROCESS_FAILED) {
      cancelObsoleteReview(
          tasks, task, "The ontology approval workflow did not complete successfully");
    }
  }

  private static boolean failedToStart(final Task task) {
    return TaskRepository.WORKFLOW_START_FAILED_STAGE_ID.equals(task.getWorkflowStageId())
        || (task.getCreatedAt() < System.currentTimeMillis() - START_TIMEOUT.toMillis()
            && WorkflowHandler.getInstance()
                    .getRuntimeService()
                    .createProcessInstanceQuery()
                    .variableValueEquals(
                        WorkflowStartVariables.TASK_ENTITY_ID, task.getId().toString())
                    .count()
                == 0);
  }

  private String findExecution(final Task task) {
    final WorkflowDefinition definition =
        Entity.getEntity(
            Entity.WORKFLOW_DEFINITION, task.getWorkflowDefinitionId(), "", Include.ALL);
    final List<HistoricProcessInstance> executions =
        WorkflowHandler.getInstance()
            .getProcessEngineConfiguration()
            .getHistoryService()
            .createHistoricProcessInstanceQuery()
            .processDefinitionKey(definition.getFullyQualifiedName())
            .variableValueEquals(WorkflowStartVariables.TASK_ENTITY_ID, task.getId().toString())
            .listPage(0, 2);
    if (executions.size() > 1) {
      throw new BadRequestException("An ontology review must have exactly one workflow execution");
    }
    final String processId = executions.isEmpty() ? null : executions.getFirst().getId();
    if (processId != null) {
      OntologyApprovalWorkflow.trackExecution(task.getId(), processId);
    }
    return processId;
  }

  private void cancelObsoleteReview(
      final TaskRepository tasks, final Task task, final String reason) {
    tasks.executeInTransaction(
        () -> {
          try (FreshReadScope.Handle ignored = FreshReadScope.enter()) {
            dao.workflowDefinitionDAO()
                .findJsonByIdForUpdate(task.getWorkflowDefinitionId(), Include.ALL);
            final Task current =
                tasks.get(null, task.getId(), tasks.getFields("*"), Include.ALL, false);
            return TaskRepository.isTerminalStatus(current.getStatus())
                    || current.getResolution() != null
                ? current
                : tasks.resolveTask(
                    current,
                    new TaskResolution()
                        .withType(TaskResolutionType.Cancelled)
                        .withResolvedAt(System.currentTimeMillis())
                        .withComment(reason),
                    GOVERNANCE_BOT);
          }
        });
    cancelExecution(task.getId());
  }

  private void cancelExecution(final UUID taskId) {
    final WorkflowHandler workflow = WorkflowHandler.getInstance();
    final List<ProcessInstance> roots =
        workflow
            .getRuntimeService()
            .createProcessInstanceQuery()
            .variableValueEquals(WorkflowStartVariables.TASK_ENTITY_ID, taskId.toString())
            .excludeSubprocesses(true)
            .listPage(0, PAGE_SIZE);
    roots.forEach(this::terminateExecution);
    if (roots.isEmpty()) {
      dao.entityExtensionDAO().delete(taskId, EXTENSION);
    }
  }

  private void terminateExecution(final ProcessInstance root) {
    try {
      final WorkflowInstanceRepository instances =
          (WorkflowInstanceRepository)
              Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE);
      WorkflowInstanceTerminator.forCurrentEngine(instances)
          .terminate(
              new TerminationRequest(
                  UUID.fromString(root.getBusinessKey()),
                  "Ontology review is no longer active",
                  GOVERNANCE_BOT));
    } catch (WorkflowInstanceConflictException exception) {
      LOG.debug("Workflow {} cleanup will retry: {}", root.getId(), exception.getMessage());
    }
  }
}
