package org.openmetadata.service.governance.workflows.metadata;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.governance.workflows.WorkflowEventConsumer.GOVERNANCE_BOT;

import jakarta.json.Json;
import jakarta.json.JsonPatch;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.CollectMetadataTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.MetadataCollectionConfiguration;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.RequiredMetadataField;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataCompletionPayload;
import org.openmetadata.schema.type.TaskAvailableTransition;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskPriority;
import org.openmetadata.schema.type.TaskResolution;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.rules.RuleEngine;
import org.openmetadata.service.util.RestUtil.PatchResponse;
import org.openmetadata.service.util.WebsocketNotificationHandler;

/**
 * Keeps one Metadata Completion task per asset and lifecycle stage: it lists the stage's required
 * fields that are still empty, completes itself once they are filled in, and closes when the asset
 * leaves the stage
 * (ADR:2026-10-15-a-lifecycle-stage-asks-for-its-missing-metadata-in-one-task).
 */
@Slf4j
public final class MetadataCollectionService {
  public static final TaskEntityType TASK_TYPE = TaskEntityType.MetadataCompletion;

  static final String RECHECK = "recheck";
  static final String TITLE = "Fill in missing metadata";
  static final String DESCRIPTION =
      "Fill in the fields this asset still needs to leave %s. The task completes itself once they"
          + " are filled in.";
  static final String STILL_MISSING =
      "Still missing: %s. The task completes itself once these are filled in.";
  static final String FILLED_IN = "Every required field is filled in";
  static final String LEFT_STAGE = "The asset left %s";
  private static final int MAX_STALE_TASKS = 10;

  static final List<TaskAvailableTransition> TRANSITIONS =
      List.of(
          new TaskAvailableTransition()
              .withId(RECHECK)
              .withLabel("Re-check")
              .withTargetTaskStatus(TaskEntityStatus.Completed)
              .withResolutionType(TaskResolutionType.Completed)
              .withRequiresComment(false));

  private final TaskRepository repository;
  private final EntityReference actor;

  public MetadataCollectionService(final TaskRepository repository, final EntityReference actor) {
    this.repository = repository;
    this.actor = actor;
  }

  public void reconcile(
      final EntityInterface<?> entity,
      final MetadataCollectionConfiguration configuration,
      final String workflow,
      final String node) {
    final UUID id = taskId(entity.getId(), workflow, node);
    closeTasksOfOtherStages(entity, id);
    final boolean inStage = isInStage(entity, configuration.getStage());
    final List<String> missing = inStage ? missingFields(entity, configuration) : List.of();
    final Optional<Task> existing = findTask(id);
    if (missing.isEmpty()) {
      existing.filter(MetadataCollectionService::isOpen).ifPresent(task -> finish(task, inStage));
    } else if (existing.isEmpty()) {
      open(entity, configuration, workflow, node, id, missing);
    } else if (!Boolean.TRUE.equals(existing.get().getDeleted())) {
      refresh(existing.get(), entity, configuration, workflow, node, missing);
    }
  }

  /** Resolving the task only re-checks it: it completes once nothing is missing. */
  public static boolean decides(final Task task) {
    return task != null && task.getType() == TASK_TYPE;
  }

  public static void requireFilledIn(final Task task) {
    final MetadataCompletionPayload payload =
        JsonUtils.convertValue(task.getPayload(), MetadataCompletionPayload.class);
    final EntityInterface<?> entity = Entity.getEntity(task.getAbout(), "*", Include.NON_DELETED);
    final List<String> missing =
        isInStage(entity, payload.getStage())
            ? configuration(payload.getWorkflow(), payload.getNode())
                .map(configuration -> missingFields(entity, configuration))
                .orElse(List.of())
            : List.of();
    if (!missing.isEmpty()) {
      throw BadRequestException.of(
          String.format(
              STILL_MISSING,
              missing.stream()
                  .map(MetadataCollectionService::fieldName)
                  .collect(Collectors.joining(", "))));
    }
  }

  /** A field path as people read it: {@code extension.costCenter} reads "Cost center". */
  static String fieldName(final String path) {
    final String words =
        path.replaceFirst("^extension\\.", "")
            .replace('.', ' ')
            .replaceAll("([a-z])([A-Z])", "$1 $2")
            .toLowerCase(Locale.ROOT);
    return Character.toUpperCase(words.charAt(0)) + words.substring(1);
  }

  static UUID taskId(final UUID entityId, final String workflow, final String node) {
    return UUID.nameUUIDFromBytes(
        "%s:%s:%s".formatted(entityId, workflow, node).getBytes(StandardCharsets.UTF_8));
  }

  static List<String> missingFields(
      final EntityInterface<?> entity, final MetadataCollectionConfiguration configuration) {
    final Map<String, Object> fields = JsonUtils.getMap(entity);
    return listOrEmpty(configuration.getFields()).stream()
        .filter(
            field -> !Boolean.TRUE.equals(RuleEngine.getInstance().apply(field.getRules(), fields)))
        .map(RequiredMetadataField::getField)
        .toList();
  }

  private static boolean isInStage(final EntityInterface<?> entity, final EntityStatus stage) {
    final Enum<?> current = entity.getEntityStatus();
    return current != null && stage != null && stage.value().equals(current.toString());
  }

  /** The node's current configuration: an edited or deleted workflow asks for what it asks now. */
  private static Optional<MetadataCollectionConfiguration> configuration(
      final String workflow, final String node) {
    final WorkflowDefinition definition =
        Entity.findByNameOrNull(Entity.WORKFLOW_DEFINITION, workflow, Include.NON_DELETED);
    return Optional.ofNullable(definition).stream()
        .flatMap(found -> listOrEmpty(found.getNodes()).stream())
        // Workflow nodes deserialize polymorphically by subType, so the collect node is found by
        // its concrete definition class.
        .filter(candidate -> candidate instanceof CollectMetadataTaskDefinition)
        .map(CollectMetadataTaskDefinition.class::cast)
        .filter(candidate -> node.equals(candidate.getName()))
        .map(CollectMetadataTaskDefinition::getConfig)
        .findFirst();
  }

  /**
   * An asset is in one stage at a time, so a task opened for another stage it has left closes the
   * next time any of its stages is reconciled.
   */
  private void closeTasksOfOtherStages(final EntityInterface<?> entity, final UUID current) {
    Task open = repository.findOpenTaskByEntityAndType(entity.getFullyQualifiedName(), TASK_TYPE);
    int closed = 0;
    while (open != null && !current.equals(open.getId()) && closed < MAX_STALE_TASKS) {
      final MetadataCompletionPayload payload =
          JsonUtils.convertValue(open.getPayload(), MetadataCompletionPayload.class);
      if (isInStage(entity, payload.getStage())) {
        open = null;
      } else {
        finish(open, false);
        closed++;
        open = repository.findOpenTaskByEntityAndType(entity.getFullyQualifiedName(), TASK_TYPE);
      }
    }
  }

  private Optional<Task> findTask(final UUID id) {
    Optional<Task> task = Optional.empty();
    try {
      task = Optional.of(repository.get(null, id, repository.getFields("*"), Include.ALL, false));
    } catch (EntityNotFoundException missing) {
      LOG.debug("[MetadataCompletion] no task {} yet", id);
    }
    return task;
  }

  private static boolean isOpen(final Task task) {
    return !Boolean.TRUE.equals(task.getDeleted())
        && !TaskRepository.isTerminalStatus(task.getStatus());
  }

  private void open(
      final EntityInterface<?> entity,
      final MetadataCollectionConfiguration configuration,
      final String workflow,
      final String node,
      final UUID id,
      final List<String> missing) {
    final List<EntityReference> assignees = assignees(entity, configuration);
    if (assignees.isEmpty()) {
      LOG.info(
          "[MetadataCompletion] {} has no {} to ask for {}",
          entity.getFullyQualifiedName(),
          configuration.getTaskAssignees().value(),
          missing);
      return;
    }
    final long now = System.currentTimeMillis();
    final Task task =
        new Task()
            .withId(id)
            .withDisplayName(TITLE)
            .withDescription(String.format(DESCRIPTION, configuration.getStage().value()))
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TASK_TYPE)
            .withStatus(TaskEntityStatus.Open)
            .withPriority(TaskPriority.Medium)
            .withAbout(entity.getEntityReference())
            .withAssignees(assignees)
            .withPayload(payload(configuration, workflow, node, missing))
            .withAvailableTransitions(TRANSITIONS)
            .withCreatedBy(actor)
            .withCreatedAt(now)
            .withUpdatedBy(actor.getName())
            .withUpdatedAt(now);
    try {
      final Task created = repository.createInternal(task);
      repository.storeChangeEventForAsyncOperation(
          created, EventType.ENTITY_CREATED, false, GOVERNANCE_BOT);
      WebsocketNotificationHandler.handleTaskNotification(created);
    } catch (RuntimeException failure) {
      // Two events can reach the same stage concurrently; the deterministic id lets one create it.
      if (findTask(id).isEmpty()) {
        throw failure;
      }
    }
  }

  /** Reopens a closed task and rewrites what it asks for and whom, keeping its history. */
  private void refresh(
      final Task existing,
      final EntityInterface<?> entity,
      final MetadataCollectionConfiguration configuration,
      final String workflow,
      final String node,
      final List<String> missing) {
    final Task task =
        isOpen(existing) ? existing : repository.reopenTask(existing, actor.getName());
    final List<EntityReference> assignees = assignees(entity, configuration);
    final MetadataCompletionPayload payload = payload(configuration, workflow, node, missing);
    final boolean changed =
        !Objects.equals(
                JsonUtils.convertValue(task.getPayload(), MetadataCompletionPayload.class), payload)
            || !Objects.equals(task.getAvailableTransitions(), TRANSITIONS)
            || (!assignees.isEmpty() && !sameAssignees(task.getAssignees(), assignees));
    if (changed) {
      final JsonPatch patch =
          Json.createPatchBuilder()
              .add("/payload", JsonUtils.getJsonStructure(payload))
              .add("/availableTransitions", JsonUtils.getJsonStructure(TRANSITIONS))
              .add(
                  "/assignees",
                  JsonUtils.getJsonStructure(
                      assignees.isEmpty() ? listOrEmpty(task.getAssignees()) : assignees))
              .build();
      final PatchResponse<Task> response =
          repository.patch(null, task.getId(), GOVERNANCE_BOT, patch, ChangeSource.AUTOMATED, null);
      repository.storeChangeEventForAsyncOperation(
          response.entity(), response.changeType(), false, GOVERNANCE_BOT);
    }
  }

  private static boolean sameAssignees(
      final List<EntityReference> current, final List<EntityReference> wanted) {
    return Objects.equals(
        listOrEmpty(current).stream().map(EntityReference::getId).toList(),
        wanted.stream().map(EntityReference::getId).toList());
  }

  private static MetadataCompletionPayload payload(
      final MetadataCollectionConfiguration configuration,
      final String workflow,
      final String node,
      final List<String> missing) {
    return new MetadataCompletionPayload()
        .withWorkflow(workflow)
        .withNode(node)
        .withStage(configuration.getStage())
        .withTargetStage(configuration.getTargetStage())
        .withMissingFields(missing);
  }

  private static List<EntityReference> assignees(
      final EntityInterface<?> entity, final MetadataCollectionConfiguration configuration) {
    final List<EntityReference> references =
        switch (configuration.getTaskAssignees()) {
          case OWNERS -> entity.getOwners();
          case REVIEWERS -> entity.getReviewers();
          case CANDIDATES -> configuration.getCandidates();
        };
    return List.copyOf(listOrEmpty(references));
  }

  private void finish(final Task task, final boolean complete) {
    final MetadataCompletionPayload payload =
        JsonUtils.convertValue(task.getPayload(), MetadataCompletionPayload.class);
    final TaskResolution resolution =
        new TaskResolution()
            .withType(complete ? TaskResolutionType.Completed : TaskResolutionType.Cancelled)
            .withResolvedBy(actor)
            .withResolvedAt(System.currentTimeMillis())
            .withComment(
                complete ? FILLED_IN : String.format(LEFT_STAGE, payload.getStage().value()));
    repository.resolveTask(task, resolution, actor.getName());
  }
}
