package org.openmetadata.service.governance.workflows;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolution;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.OntologyEntityRepository;
import org.openmetadata.service.jdbi3.OntologyReleaseRepository;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.util.FreshReadScope;

/** Binds ontology revisions to the existing approval-task lifecycle. */
public final class OntologyApprovalWorkflow {
  private static final Set<String> ENTITY_TYPES = Set.of(Entity.ONTOLOGY_RELEASE);

  private OntologyApprovalWorkflow() {}

  public static boolean isReview(final Task task) {
    return task.getOntologyReview() != null
        || (task.getType() == TaskEntityType.RequestApproval
            && task.getAbout() != null
            && ENTITY_TYPES.contains(task.getAbout().getType()));
  }

  public static void prepare(final Task task, final boolean update) {
    if (!update
        && task.getType() == TaskEntityType.RequestApproval
        && task.getAbout() != null
        && !Entity.ONTOLOGY_RELEASE.equals(task.getAbout().getType())
        && Entity.getEntityRepository(task.getAbout().getType())
            instanceof OntologyEntityRepository<?>) {
      throw new BadRequestException("Submit the whole ontology release for approval");
    }
    if (!update && isReview(task)) {
      try (FreshReadScope.Handle ignored = FreshReadScope.enter()) {
        repository(task).prepareReview(task);
      }
    }
  }

  public static void start(final Task task) {
    if (isReview(task)) {
      repository(task).startReview(task);
      trackExecution(task.getId(), null);
    }
  }

  public static void validate(final Task task, final String user) {
    if (isReview(task)) {
      try (FreshReadScope.Handle ignored = FreshReadScope.enter()) {
        repository(task).validateReview(task, user);
      }
    }
  }

  public static void lockTarget(final Task task) {
    repository(task).lockReviewTarget(task);
  }

  public static void validateRuntime(final Task task) {
    try (FreshReadScope.Handle ignored = FreshReadScope.enter()) {
      repository(task).validateRuntimeReview(task);
    }
  }

  public static void validateCurrentReview(final Task task) {
    repository(task).requireCurrentReview(task);
  }

  public static void complete(final Task task, final String user) {
    if (isReview(task)) {
      repository(task).completeReview(task, user);
    }
  }

  public static void cancel(final Task task) {
    if (isReview(task)
        && TaskRepository.isTerminalStatus(task.getStatus())
        && task.getStatus() != TaskEntityStatus.Rejected) {
      if (task.getAbout() != null) {
        repository(task).cancelReview(task);
      }
      trackExecution(task.getId(), null);
    }
  }

  public static void recordDecision(
      final Task task,
      final OntologyWorkflowDecision decision,
      final Map<String, Object> variables) {
    decision.requireTarget(task);
    final WorkflowHandler workflow = WorkflowHandler.getInstance();
    final WorkflowHandler.ApprovalTaskContext context = workflow.approvalTaskContext(task.getId());
    final List<String> voters = new ArrayList<>(context.voters());
    voters.addAll(decision.voters());
    final Object previous =
        workflow
            .getRuntimeService()
            .getVariable(context.processInstanceId(), OntologyWorkflowDecision.VARIABLE);
    if (previous instanceof String json) {
      final OntologyWorkflowDecision prior =
          JsonUtils.readValue(json, OntologyWorkflowDecision.class);
      prior.requireTarget(task);
      voters.addAll(prior.voters());
    }
    voters.stream().distinct().forEach(voter -> validate(task, voter));
    trackExecution(task.getId(), context.processInstanceId());
    variables.put(
        OntologyWorkflowDecision.VARIABLE,
        JsonUtils.pojoToJson(
            new OntologyWorkflowDecision(
                task.getId(),
                task.getOntologyReview(),
                decision.resolution(),
                decision.user(),
                voters.stream().distinct().toList(),
                decision.transition(),
                decision.comment())));
  }

  public static Task completeDecision(final Task task, final OntologyWorkflowDecision decision) {
    final TaskRepository tasks = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    return tasks.executeInTransaction(
        () -> {
          try (FreshReadScope.Handle ignored = FreshReadScope.enter()) {
            lockTarget(task);
            final Task current =
                tasks.get(null, task.getId(), tasks.getFields("*"), Include.ALL, false);
            decision.requireTarget(current);
            return TaskRepository.isTerminalStatus(current.getStatus())
                    || current.getResolution() != null
                ? current
                : applyDecision(tasks, current, decision);
          }
        });
  }

  private static Task applyDecision(
      final TaskRepository tasks, final Task task, final OntologyWorkflowDecision decision) {
    decision.voters().forEach(voter -> validate(task, voter));
    final TaskResolution resolution =
        new TaskResolution()
            .withType(decision.resolution())
            .withResolvedBy(
                Entity.getEntityReferenceByName(Entity.USER, decision.user(), Include.NON_DELETED))
            .withResolvedAt(System.currentTimeMillis())
            .withComment(decision.comment());
    final Task resolved =
        tasks.resolveTask(task, resolution, decision.transition(), decision.user());
    complete(resolved, decision.user());
    repository(task).recordDecision(resolved, decision);
    Entity.getCollectionDAO()
        .entityExtensionDAO()
        .delete(task.getId(), OntologyReviewReconciler.EXTENSION);
    return resolved;
  }

  public static void trackExecution(final UUID taskId, final String processId) {
    final var extensions = Entity.getCollectionDAO().entityExtensionDAO();
    if (processId != null
        || extensions.getExtension(taskId, OntologyReviewReconciler.EXTENSION) == null) {
      extensions.insert(
          taskId,
          OntologyReviewReconciler.EXTENSION,
          "ontologyReviewExecution",
          JsonUtils.pojoToJson(new OntologyReviewReconciler.Execution(processId)));
    }
  }

  public static void requireUnchangedTarget(final Task original, final Task updated) {
    if (!Objects.equals(original.getOntologyReview(), updated.getOntologyReview())
        || (isReview(original)
            && (!Objects.equals(original.getType(), updated.getType())
                || !sameReference(original.getAbout(), updated.getAbout())
                || !sameReference(original.getCreatedBy(), updated.getCreatedBy())
                || !Objects.equals(
                    original.getWorkflowDefinitionId(), updated.getWorkflowDefinitionId())))) {
      throw new BadRequestException(
          "An ontology task's review target and workflow cannot be changed");
    }
    if (isReview(original)
        && (TaskRepository.isTerminalStatus(original.getStatus())
            || original.getResolution() != null)
        && (original.getStatus() != updated.getStatus()
            || !Objects.equals(original.getResolution(), updated.getResolution()))) {
      throw new BadRequestException(
          "A finished ontology review cannot be changed; submit a new approval task");
    }
  }

  public static void requireDeletable(final Task task) {
    if (isReview(task)
        && ((!TaskRepository.isTerminalStatus(task.getStatus()) && task.getResolution() == null)
            || Entity.getCollectionDAO()
                    .entityExtensionDAO()
                    .getExtension(task.getId(), OntologyReviewReconciler.EXTENSION)
                != null)) {
      throw new BadRequestException(
          "Close the ontology review and wait for workflow cleanup before deleting its task");
    }
  }

  private static boolean sameReference(final EntityReference first, final EntityReference second) {
    return first == null
        ? second == null
        : second != null
            && Objects.equals(first.getId(), second.getId())
            && Objects.equals(first.getType(), second.getType());
  }

  private static OntologyReleaseRepository repository(final Task task) {
    if (task.getAbout() == null || !ENTITY_TYPES.contains(task.getAbout().getType())) {
      throw new BadRequestException("Invalid ontology approval target");
    }
    return (OntologyReleaseRepository) Entity.getEntityRepository(task.getAbout().getType());
  }
}
