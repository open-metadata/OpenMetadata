/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.context.review;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.governance.workflows.WorkflowEventConsumer.GOVERNANCE_BOT;

import jakarta.json.Json;
import jakarta.json.JsonPatch;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TaskAvailableTransition;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.util.RestUtil.PatchResponse;
import org.openmetadata.service.util.WebsocketNotificationHandler;

/**
 * Keeps one open review task on every Draft memory held in review by disputes, rewrites it when
 * the memory's disputes or owners change, and closes it when the memory leaves review outside the
 * task
 * (ADR:2026-10-13-a-memory-conflict-opens-a-review-task-and-approving-it-supersedes-the-disputed-memory).
 */
@Slf4j
public final class MemoryConflictReviewTasks {

  public static final TaskEntityType TASK_TYPE = TaskEntityType.MemoryConflictReview;

  static final String APPROVE = "approve";
  static final String REJECT = "reject";
  static final String REVIEW_TITLE = "Review conflicting memory";

  /**
   * Fixed text: every user may read tasks while a memory may be Private or Shared, so the task names
   * memories by reference and never says what they hold. Context Center reads both memories through
   * their visibility rules to compare them.
   */
  static final String REVIEW_DESCRIPTION =
      "A memory in review contradicts Approved memories. Approving it supersedes them; rejecting it"
          + " keeps them. Compare them in Context Center, under Memories → Needs review.";

  static final String CLOSED_OUTSIDE_REVIEW =
      "Closed because the memory left its conflict review outside this task (now %s)";
  static final String DELETED_IN_REVIEW = "Closed because the memory was deleted during its review";
  private static final String OWNERS = "owners";
  private static final int MAX_OPEN_REVIEWS = 10;

  private static final List<TaskAvailableTransition> TRANSITIONS =
      List.of(
          new TaskAvailableTransition()
              .withId(APPROVE)
              .withLabel("Approve")
              .withTargetTaskStatus(TaskEntityStatus.Approved)
              .withResolutionType(TaskResolutionType.Approved)
              .withRequiresComment(false),
          new TaskAvailableTransition()
              .withId(REJECT)
              .withLabel("Reject")
              .withTargetTaskStatus(TaskEntityStatus.Rejected)
              .withResolutionType(TaskResolutionType.Rejected)
              .withRequiresComment(false));

  private static final List<Function<ContextMemory, Object>> REVIEWED_FIELDS =
      List.of(ContextMemory::getDisputes, ContextMemory::getOwners);

  /** A memory the reviewed one contradicts, and when that was detected. */
  record Contradiction(EntityReference memory, Long detectedAt) {}

  /**
   * Every memory the reviewed one contradicts. A decision retried after the memory left Draft,
   * which releases its disputes, reads them from here.
   */
  record OpenedFor(List<Contradiction> disputes) {}

  private MemoryConflictReviewTasks() {}

  /**
   * Runs after a memory write commits, so it cannot undo the write: a failure is logged, and the
   * next write to the memory tries again.
   */
  public static void afterWrite(ContextMemory previous, ContextMemory current) {
    try {
      if (Boolean.TRUE.equals(current.getDeleted())) {
        LOG.debug(
            "[MemoryConflictReview] memory {} is deleted; its delete closes the review",
            current.getId());
      } else if (isHeldForConflicts(current)) {
        openOrRefresh(previous, current);
      } else if (leavesReviewOutsideTheTask(previous, current)) {
        closeOpenTasks(
            current,
            String.format(CLOSED_OUTSIDE_REVIEW, String.valueOf(current.getEntityStatus())));
      }
    } catch (RuntimeException failure) {
      LOG.error(
          "[MemoryConflictReview] could not update the review task of memory {}",
          current.getId(),
          failure);
    }
  }

  /**
   * A deleted memory cannot be decided, so its review closes; a hard delete removes the task with
   * the memory's other relationships.
   */
  public static void afterDelete(ContextMemory memory, boolean hardDelete) {
    try {
      if (!hardDelete && isHeldForConflicts(memory)) {
        closeOpenTasks(memory, DELETED_IN_REVIEW);
      }
    } catch (RuntimeException failure) {
      LOG.error(
          "[MemoryConflictReview] could not close the review task of memory {}",
          memory.getId(),
          failure);
    }
  }

  /**
   * A write that takes a held memory out of review closes its task, unless it is that task's own
   * decision: a governance workflow's write, made as {@code governance-bot}, closes it too.
   */
  static boolean leavesReviewOutsideTheTask(ContextMemory previous, ContextMemory current) {
    return mayLeaveReview(previous, current)
        && !MemoryConflictResolution.isDeciding(current.getId());
  }

  /**
   * One writer's edits within a session consolidate, and the previous version a hook then sees is
   * the one before the session: a memory the session put into review and took out again looks held
   * in neither. So any change to the stage or the disputes looks for an open review to close.
   */
  static boolean mayLeaveReview(ContextMemory previous, ContextMemory current) {
    return previous != null
        && (isHeldForConflicts(previous)
            || previous.getEntityStatus() != current.getEntityStatus()
            || !Objects.equals(previous.getDisputes(), current.getDisputes()));
  }

  static boolean isHeldForConflicts(ContextMemory memory) {
    return memory != null
        && memory.getEntityStatus() == ContextMemoryStatus.DRAFT
        && !nullOrEmpty(memory.getDisputes());
  }

  private static void openOrRefresh(ContextMemory previous, ContextMemory current) {
    Task open = openReview(current);
    if (open == null) {
      open(current);
    } else if (changesWhatTheReviewShows(previous, current)) {
      refresh(open, current);
    }
  }

  private static void open(ContextMemory memory) {
    ContextMemory reviewed = reviewedAsWritten(memory);
    EntityReference creator =
        Entity.getEntityReferenceByName(Entity.USER, GOVERNANCE_BOT, Include.ALL);
    Task task =
        taskRepository()
            .createInternal(
                reviewTask(
                    reviewed, disputedMemories(reviewed), creator, System.currentTimeMillis()));
    taskRepository()
        .storeChangeEventForAsyncOperation(task, EventType.ENTITY_CREATED, false, GOVERNANCE_BOT);
    WebsocketNotificationHandler.handleTaskNotification(task);
    LOG.info(
        "[MemoryConflictReview] opened task {} for memory {}", task.getTaskId(), memory.getId());
  }

  /** Rewrites who decides and what the review weighs; its status, comments and history stay. */
  private static void refresh(Task open, ContextMemory memory) {
    ContextMemory reviewed = reviewedAsWritten(memory);
    Task current =
        reviewTask(reviewed, disputedMemories(reviewed), open.getCreatedBy(), open.getCreatedAt());
    JsonPatch patch =
        Json.createPatchBuilder()
            .add("/assignees", JsonUtils.getJsonStructure(current.getAssignees()))
            .add("/payload", JsonUtils.getJsonStructure(current.getPayload()))
            .build();
    PatchResponse<Task> response =
        taskRepository()
            .patch(null, open.getId(), GOVERNANCE_BOT, patch, ChangeSource.AUTOMATED, null);
    taskRepository()
        .storeChangeEventForAsyncOperation(
            response.entity(), response.changeType(), false, GOVERNANCE_BOT);
    LOG.info(
        "[MemoryConflictReview] refreshed task {} for memory {}", open.getTaskId(), memory.getId());
  }

  /** The task records the memory's disputes and assigns the owners of every side. */
  static boolean changesWhatTheReviewShows(ContextMemory previous, ContextMemory current) {
    return previous == null
        || REVIEWED_FIELDS.stream()
            .anyMatch(field -> !Objects.equals(field.apply(previous), field.apply(current)));
  }

  /**
   * The memory as its write left it. Reading it back within the same request can return the copy
   * cached before the write, so only the owners are loaded, and only when the write did not carry
   * them.
   */
  private static ContextMemory reviewedAsWritten(ContextMemory memory) {
    ContextMemory reviewed = JsonUtils.deepCopy(memory, ContextMemory.class);
    if (reviewed.getOwners() == null) {
      reviewed.setOwners(storedMemory(memory.getId()).map(ContextMemory::getOwners).orElse(null));
    }
    return reviewed;
  }

  /** Two writes landing together can each open a review, so every open one closes. */
  private static void closeOpenTasks(ContextMemory memory, String comment) {
    Task open = openReview(memory);
    int closed = 0;
    while (open != null && closed < MAX_OPEN_REVIEWS) {
      taskRepository().closeTask(open, memory.getUpdatedBy(), comment);
      closed++;
      open = openReview(memory);
    }
  }

  private static Task openReview(ContextMemory memory) {
    return taskRepository().findOpenTaskByEntityAndType(memory.getFullyQualifiedName(), TASK_TYPE);
  }

  /**
   * The server opens the task as {@code governance-bot}: a creator may not resolve their own task,
   * and the person whose write disputed the memory may be one of the owners who decide it.
   */
  static Task reviewTask(
      ContextMemory reviewed, List<ContextMemory> disputed, EntityReference creator, long now) {
    return new Task()
        .withId(UUID.randomUUID())
        .withDisplayName(REVIEW_TITLE)
        .withDescription(REVIEW_DESCRIPTION)
        .withCategory(TaskCategory.Review)
        .withType(TASK_TYPE)
        .withStatus(TaskEntityStatus.Open)
        .withAbout(referenceTo(reviewed.getEntityReference()).withType(Entity.CONTEXT_MEMORY))
        .withAssignees(assignees(reviewed, disputed))
        .withCreatedBy(creator)
        .withPayload(openedFor(reviewed))
        .withAvailableTransitions(TRANSITIONS)
        .withCreatedAt(now)
        .withUpdatedBy(GOVERNANCE_BOT)
        .withUpdatedAt(now);
  }

  /** Whoever owns either side of the conflict can decide it. */
  static List<EntityReference> assignees(ContextMemory reviewed, List<ContextMemory> disputed) {
    Map<UUID, EntityReference> owners = new LinkedHashMap<>();
    List<ContextMemory> involved = new ArrayList<>(List.of(reviewed));
    involved.addAll(disputed);
    involved.forEach(
        memory ->
            listOrEmpty(memory.getOwners())
                .forEach(owner -> owners.putIfAbsent(owner.getId(), owner)));
    return new ArrayList<>(owners.values());
  }

  private static List<ContextMemory> disputedMemories(ContextMemory reviewed) {
    List<ContextMemory> disputed = new ArrayList<>();
    listOrEmpty(reviewed.getDisputes())
        .forEach(dispute -> storedMemory(dispute.getMemory().getId()).ifPresent(disputed::add));
    return disputed;
  }

  static OpenedFor openedFor(ContextMemory reviewed) {
    List<Contradiction> contradictions =
        listOrEmpty(reviewed.getDisputes()).stream()
            .map(
                dispute ->
                    new Contradiction(referenceTo(dispute.getMemory()), dispute.getDetectedAt()))
            .toList();
    return new OpenedFor(contradictions);
  }

  /** A stored memory reference reads as the memory's title, which the task must not carry. */
  static EntityReference referenceTo(EntityReference memory) {
    return new EntityReference()
        .withId(memory.getId())
        .withType(memory.getType())
        .withName(memory.getName())
        .withFullyQualifiedName(memory.getFullyQualifiedName());
  }

  private static Optional<ContextMemory> storedMemory(UUID memoryId) {
    Optional<ContextMemory> memory = Optional.empty();
    try {
      memory =
          Optional.of(
              Entity.getEntity(Entity.CONTEXT_MEMORY, memoryId, OWNERS, Include.NON_DELETED));
    } catch (EntityNotFoundException deleted) {
      LOG.debug("[MemoryConflictReview] memory {} no longer exists", memoryId, deleted);
    }
    return memory;
  }

  private static TaskRepository taskRepository() {
    return (TaskRepository) Entity.getEntityRepository(Entity.TASK);
  }
}
