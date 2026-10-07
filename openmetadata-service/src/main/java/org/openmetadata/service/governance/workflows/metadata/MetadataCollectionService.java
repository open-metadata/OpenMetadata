package org.openmetadata.service.governance.workflows.metadata;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.MetadataCollectionConfiguration;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TaskAvailableTransition;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskPriority;
import org.openmetadata.schema.type.TaskResolution;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.rules.RuleEngine;

/** Maintains one task per entity, workflow node and field across repeated entity events. */
public final class MetadataCollectionService {
  private final TaskRepository repository;
  private final WorkflowHandler workflows;
  private final EntityReference actor;

  public MetadataCollectionService(
      final TaskRepository repository,
      final WorkflowHandler workflows,
      final EntityReference actor) {
    this.repository = repository;
    this.workflows = workflows;
    this.actor = actor;
  }

  public void reconcile(
      final EntityInterface entity,
      final MetadataCollectionConfiguration configuration,
      final String key) {
    final UUID id = taskId(entity.getId(), key, configuration.getField());
    final Optional<Task> existing = findTask(id);
    final boolean applies =
        configuration.getAppliesWhen() == null
            || configuration.getAppliesWhen().isBlank()
            || matches(configuration.getAppliesWhen(), entity);
    final boolean complete = matches(configuration.getRules(), entity);
    if (!applies || complete) {
      existing.filter(this::isOpen).ifPresent(task -> finish(task, complete));
    } else if (configuration.getStage() != entity.getEntityStatus()) {
      existing.filter(this::isOpen).ifPresent(task -> finish(task, false));
    } else if (existing.isEmpty()) {
      createMissingTask(entity, configuration, id);
    } else if (!Boolean.TRUE.equals(existing.get().getDeleted()) && !isOpen(existing.get())) {
      repository.reopenTaskWithWorkflow(existing.get(), actor.getName());
    }
  }

  static UUID taskId(final UUID entityId, final String key, final String field) {
    return UUID.nameUUIDFromBytes(
        (entityId + ":" + key + ":" + field).getBytes(StandardCharsets.UTF_8));
  }

  private boolean matches(final String rules, final EntityInterface entity) {
    return Boolean.TRUE.equals(RuleEngine.getInstance().apply(rules, JsonUtils.getMap(entity)));
  }

  private Optional<Task> findTask(final UUID id) {
    try {
      return Optional.of(repository.get(null, id, repository.getFields("*"), Include.ALL, false));
    } catch (EntityNotFoundException missing) {
      return Optional.empty();
    }
  }

  private boolean isOpen(final Task task) {
    return !Boolean.TRUE.equals(task.getDeleted())
        && !TaskRepository.isTerminalStatus(task.getStatus());
  }

  private void createMissingTask(
      final EntityInterface entity,
      final MetadataCollectionConfiguration configuration,
      final UUID id) {
    final List<EntityReference> assignees = assignees(entity, configuration);
    if (assignees.isEmpty()) {
      return;
    }
    final Task task = newTask(entity, configuration, id).withAssignees(assignees);
    try {
      repository.create(null, task);
    } catch (RuntimeException failure) {
      // Two events can reach the same check concurrently; the deterministic primary key wins once.
      if (findTask(id).isEmpty()) {
        throw failure;
      }
    }
  }

  private List<EntityReference> assignees(
      final EntityInterface entity, final MetadataCollectionConfiguration configuration) {
    final List<EntityReference> references =
        switch (configuration.getTaskAssignees()) {
          case OWNERS -> entity.getOwners();
          case REVIEWERS -> entity.getReviewers();
          case CANDIDATES -> configuration.getCandidates();
        };
    return references == null ? List.of() : List.copyOf(references);
  }

  private Task newTask(
      final EntityInterface entity,
      final MetadataCollectionConfiguration configuration,
      final UUID id) {
    final boolean description = "description".equals(configuration.getField());
    return new Task()
        .withId(id)
        .withName("Complete " + configuration.getField())
        .withDisplayName("Complete " + configuration.getField() + " · " + entity.getName())
        .withDescription(instructions(configuration))
        .withCategory(TaskCategory.MetadataUpdate)
        .withType(description ? TaskEntityType.DescriptionUpdate : TaskEntityType.CustomTask)
        .withStatus(TaskEntityStatus.Open)
        .withPriority(TaskPriority.Medium)
        .withAbout(entity.getEntityReference())
        .withPayload(payload(entity, configuration))
        .withCreatedBy(actor)
        .withCreatedAt(System.currentTimeMillis())
        .withUpdatedBy(actor.getName())
        .withUpdatedAt(System.currentTimeMillis());
  }

  private String instructions(final MetadataCollectionConfiguration configuration) {
    return "Complete `"
        + configuration.getField()
        + "` on the linked asset. The lifecycle advances only when the field check passes.\n\n"
        + Optional.ofNullable(configuration.getGuidance()).orElse("")
        + (configuration.getExample() == null ? "" : "\n\nExample: " + configuration.getExample());
  }

  private Map<String, String> payload(
      final EntityInterface entity, final MetadataCollectionConfiguration configuration) {
    return "description".equals(configuration.getField())
        ? Map.of(
            "fieldPath",
            "description",
            "currentDescription",
            Optional.ofNullable(entity.getDescription()).orElse(""),
            "newDescription",
            "")
        : Map.of("fieldPath", configuration.getField(), "data", instructions(configuration));
  }

  private void finish(final Task task, final boolean complete) {
    final String stage = complete ? "completed" : "cancelled";
    workflows.terminateTaskProcessInstance(
        task.getId(), "Lifecycle field check satisfied or no longer applicable");
    final TaskResolution resolution =
        new TaskResolution()
            .withType(complete ? TaskResolutionType.Completed : TaskResolutionType.Cancelled)
            .withResolvedBy(actor)
            .withResolvedAt(System.currentTimeMillis())
            .withComment(
                complete
                    ? "Lifecycle field check passed"
                    : "Lifecycle condition no longer applies");
    repository.resolveTask(
        task,
        resolution,
        new TaskAvailableTransition()
            .withTargetStageId(stage)
            .withTargetTaskStatus(
                complete ? TaskEntityStatus.Completed : TaskEntityStatus.Cancelled),
        actor.getName());
  }
}
