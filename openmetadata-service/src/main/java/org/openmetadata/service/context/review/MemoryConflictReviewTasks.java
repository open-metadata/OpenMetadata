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
import java.util.HashMap;
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
import org.openmetadata.schema.entity.context.MemoryDispute;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
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
import org.openmetadata.service.governance.workflows.EntityStatusWorkflows;
import org.openmetadata.service.jdbi3.TaskRepository;

/**
 * Keeps one open review task on every Draft memory held in review by disputes, retitles it when
 * the memory's title, disputes or owners change, and closes it when the memory leaves review
 * outside the task
 * (ADR:2026-10-13-a-memory-conflict-opens-a-review-task-and-approving-it-supersedes-the-disputed-memory).
 */
@Slf4j
public final class MemoryConflictReviewTasks {

  public static final TaskEntityType TASK_TYPE = TaskEntityType.MemoryConflictReview;

  static final String APPROVE = "approve";
  static final String REJECT = "reject";
  static final String CLOSED_OUTSIDE_REVIEW =
      "Closed because the memory left its conflict review outside this task (now %s)";
  static final String DELETED_IN_REVIEW = "Closed because the memory was deleted during its review";
  static final String MEMORY_GONE = "this memory no longer exists";
  private static final String CLAIM_FIELDS = "owners,primaryEntity,sourceEntity";

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

  private static final List<Function<ContextMemory, Object>> SHOWN_FIELDS =
      List.of(
          ContextMemory::getTitle,
          ContextMemory::getQuestion,
          ContextMemory::getAnswer,
          ContextMemory::getPrimaryEntity,
          ContextMemory::getDisputes,
          ContextMemory::getOwners);

  /**
   * A memory the reviewed one contradicts: its reference, titled because memory names are
   * generated (an extracted memory is named after its source plus a UUID), why it conflicts, when
   * that was detected, and its claim, which a memory that no longer exists does not have.
   */
  record Contradiction(EntityReference memory, String reason, Long detectedAt, MemoryClaim claim) {}

  /**
   * What the task records about the conflict: the reviewed memory's title and claim, and every
   * memory it contradicts. A reviewer compares {@code claim} with each contradiction's claim.
   */
  record OpenedFor(
      Double memoryVersion, String memoryTitle, MemoryClaim claim, List<Contradiction> disputes) {}

  private MemoryConflictReviewTasks() {}

  /**
   * Runs after a memory write commits, so it cannot undo the write: a failure is logged, and the
   * next write to the memory tries again.
   */
  public static void afterWrite(ContextMemory previous, ContextMemory current) {
    try {
      if (isHeldForConflicts(current)) {
        openOrRefresh(previous, current);
      } else if (isHeldForConflicts(previous) && !EntityStatusWorkflows.isWorkflowChange(current)) {
        closeOpenTask(
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
        closeOpenTask(memory, DELETED_IN_REVIEW);
      }
    } catch (RuntimeException failure) {
      LOG.error(
          "[MemoryConflictReview] could not close the review task of memory {}",
          memory.getId(),
          failure);
    }
  }

  static boolean isHeldForConflicts(ContextMemory memory) {
    return memory != null
        && memory.getEntityStatus() == ContextMemoryStatus.DRAFT
        && !nullOrEmpty(memory.getDisputes());
  }

  private static void openOrRefresh(ContextMemory previous, ContextMemory current) {
    Task open =
        taskRepository().findOpenTaskByEntityAndType(current.getFullyQualifiedName(), TASK_TYPE);
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
    LOG.info(
        "[MemoryConflictReview] opened task {} for memory {}", task.getTaskId(), memory.getId());
  }

  /**
   * Rewrites what the open task shows; its status, comments and history stay. Written as whoever
   * changed the memory, impersonated by {@code governance-bot}: an update by a bot that may not
   * edit display names keeps the task's old title.
   */
  private static void refresh(Task open, ContextMemory memory) {
    ContextMemory reviewed = reviewedAsWritten(memory);
    Task current =
        reviewTask(reviewed, disputedMemories(reviewed), open.getCreatedBy(), open.getCreatedAt());
    JsonPatch patch =
        Json.createPatchBuilder()
            .add("/displayName", current.getDisplayName())
            .add("/description", current.getDescription())
            .add("/assignees", JsonUtils.getJsonStructure(current.getAssignees()))
            .add("/payload", JsonUtils.getJsonStructure(current.getPayload()))
            .build();
    taskRepository()
        .patch(null, open.getId(), writerOf(memory), patch, ChangeSource.AUTOMATED, GOVERNANCE_BOT);
    LOG.info(
        "[MemoryConflictReview] refreshed task {} for memory {}", open.getTaskId(), memory.getId());
  }

  private static String writerOf(ContextMemory memory) {
    String writer = memory.getUpdatedBy();
    return nullOrEmpty(writer) ? GOVERNANCE_BOT : writer;
  }

  /** The task shows the memory's claim and disputes, and assigns the owners of every side. */
  static boolean changesWhatTheReviewShows(ContextMemory previous, ContextMemory current) {
    return previous == null
        || SHOWN_FIELDS.stream()
            .anyMatch(field -> !Objects.equals(field.apply(previous), field.apply(current)));
  }

  /**
   * The memory as its write left it. Reading it back within the same request can return the copy
   * cached before the write, so only the fields the write did not carry are loaded.
   */
  private static ContextMemory reviewedAsWritten(ContextMemory memory) {
    ContextMemory reviewed = JsonUtils.deepCopy(memory, ContextMemory.class);
    if (reviewed.getOwners() == null || reviewed.getPrimaryEntity() == null) {
      ContextMemory stored =
          Entity.getEntity(
              Entity.CONTEXT_MEMORY, memory.getId(), CLAIM_FIELDS, Include.NON_DELETED);
      reviewed.setOwners(Optional.ofNullable(reviewed.getOwners()).orElse(stored.getOwners()));
      reviewed.setPrimaryEntity(
          Optional.ofNullable(reviewed.getPrimaryEntity()).orElse(stored.getPrimaryEntity()));
      reviewed.setSourceEntity(
          Optional.ofNullable(reviewed.getSourceEntity()).orElse(stored.getSourceEntity()));
    }
    return reviewed;
  }

  private static void closeOpenTask(ContextMemory memory, String comment) {
    Task open =
        taskRepository().findOpenTaskByEntityAndType(memory.getFullyQualifiedName(), TASK_TYPE);
    if (open != null) {
      taskRepository().closeTask(open, memory.getUpdatedBy(), comment);
    }
  }

  /**
   * The server opens the task as {@code governance-bot}: a creator may not resolve their own task,
   * and the person whose write disputed the memory may be one of the owners who decide it.
   */
  static Task reviewTask(
      ContextMemory reviewed, List<ContextMemory> disputed, EntityReference creator, long now) {
    OpenedFor openedFor = openedFor(reviewed, disputed);
    return new Task()
        .withId(UUID.randomUUID())
        .withDisplayName("Review conflicting memory: " + openedFor.memoryTitle())
        .withDescription(describe(openedFor))
        .withCategory(TaskCategory.Review)
        .withType(TASK_TYPE)
        .withStatus(TaskEntityStatus.Open)
        .withAbout(reviewed.getEntityReference().withType(Entity.CONTEXT_MEMORY))
        .withAssignees(assignees(reviewed, disputed))
        .withCreatedBy(creator)
        .withPayload(openedFor)
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

  private static OpenedFor openedFor(ContextMemory reviewed, List<ContextMemory> disputed) {
    Map<UUID, ContextMemory> disputedById = new HashMap<>();
    disputed.forEach(memory -> disputedById.put(memory.getId(), memory));
    List<Contradiction> contradictions =
        listOrEmpty(reviewed.getDisputes()).stream()
            .map(dispute -> contradiction(dispute, disputedById.get(dispute.getMemory().getId())))
            .toList();
    return new OpenedFor(
        reviewed.getVersion(), label(reviewed), MemoryClaim.of(reviewed), contradictions);
  }

  /** A disputed memory that no longer exists keeps its name: there is no title left to read. */
  private static Contradiction contradiction(MemoryDispute dispute, ContextMemory disputed) {
    EntityReference memory = JsonUtils.deepCopy(dispute.getMemory(), EntityReference.class);
    memory.setDisplayName(disputed == null ? memory.getName() : label(disputed));
    MemoryClaim claim = disputed == null ? null : MemoryClaim.of(disputed);
    return new Contradiction(memory, dispute.getReason(), dispute.getDetectedAt(), claim);
  }

  private static String describe(OpenedFor openedFor) {
    StringBuilder description =
        new StringBuilder(
                "This memory contradicts Approved knowledge. Approving it supersedes the memories"
                    + " it contradicts; rejecting it keeps them.\n\n**In review:** ")
            .append(statedClaim(openedFor.claim()));
    for (Contradiction contradiction : openedFor.disputes()) {
      description
          .append("\n\n**Contradicts \"")
          .append(contradiction.memory().getDisplayName())
          .append("\":** ")
          .append(statedClaim(contradiction.claim()))
          .append("\n\n**Why:** ")
          .append(contradiction.reason());
    }
    return description.toString();
  }

  private static String statedClaim(MemoryClaim claim) {
    return claim == null ? MEMORY_GONE : Objects.toString(claim.answer(), "");
  }

  private static Optional<ContextMemory> storedMemory(UUID memoryId) {
    Optional<ContextMemory> memory = Optional.empty();
    try {
      memory =
          Optional.of(
              Entity.getEntity(Entity.CONTEXT_MEMORY, memoryId, CLAIM_FIELDS, Include.NON_DELETED));
    } catch (EntityNotFoundException deleted) {
      LOG.debug("[MemoryConflictReview] memory {} no longer exists", memoryId, deleted);
    }
    return memory;
  }

  static String label(ContextMemory memory) {
    String title = memory.getTitle();
    return nullOrEmpty(title) || title.isBlank() ? memory.getName() : title;
  }

  private static TaskRepository taskRepository() {
    return (TaskRepository) Entity.getEntityRepository(Entity.TASK);
  }
}
