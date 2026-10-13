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
import static org.openmetadata.service.governance.workflows.WorkflowEventConsumer.GOVERNANCE_BOT;

import jakarta.json.Json;
import jakarta.json.JsonArrayBuilder;
import jakarta.json.JsonException;
import jakarta.json.JsonPatch;
import jakarta.ws.rs.BadRequestException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryDispute;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.resources.context.ContextMemoryVisibility;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.EntityETag;
import org.openmetadata.service.util.RestUtil.PatchResponse;

/**
 * Applies the decision of a memory conflict review task, as the person who decided it. Being able
 * to resolve the task authorizes the decision about the reviewed memory; superseding a disputed
 * memory additionally needs the right to read and supersede it directly. Every check runs before
 * the first write, so a refusal leaves both memories as they were and the task open; a write that
 * fails later leaves the task open for a retry, which converges.
 */
@Slf4j
public final class MemoryConflictResolution {

  static final String NOT_A_MEMORY = "A memory conflict review must be about a context memory";
  static final String DECIDE_TO_END_REVIEW =
      "Approve or reject this memory conflict review: it closes by itself once its memory leaves"
          + " review";
  static final String CHANGED_WHILE_DECIDING =
      "A memory in this review changed while it was being decided; reload it and decide again";
  static final String MAY_NOT_READ_DISPUTED =
      "User '%s' may not supersede a disputed memory they cannot read";
  private static final String DISPUTED_FIELDS =
      ContextMemoryVisibility.guardFields(Entity.CONTEXT_MEMORY, "owners");

  enum Verdict {
    APPROVE,
    REJECT
  }

  private static final Map<TaskResolutionType, Verdict> VERDICTS =
      Map.of(
          TaskResolutionType.Approved, Verdict.APPROVE,
          TaskResolutionType.AutoApproved, Verdict.APPROVE,
          TaskResolutionType.Rejected, Verdict.REJECT,
          TaskResolutionType.AutoRejected, Verdict.REJECT);

  /**
   * The memory whose review this thread is deciding. Its own writes take it out of review and must
   * not close the task they resolve; every other write that does, a governance workflow's included,
   * must.
   */
  private static final ThreadLocal<UUID> DECIDING = new ThreadLocal<>();

  private MemoryConflictResolution() {}

  static boolean isDeciding(UUID memoryId) {
    return memoryId != null && memoryId.equals(DECIDING.get());
  }

  static void whileDeciding(UUID memoryId, Runnable writes) {
    DECIDING.set(memoryId);
    try {
      writes.run();
    } finally {
      DECIDING.remove();
    }
  }

  public static boolean decides(Task task) {
    return task.getType() == MemoryConflictReviewTasks.TASK_TYPE;
  }

  /** Other resolutions, such as cancelling the task, leave the memories as they are. */
  static Optional<Verdict> verdictOf(TaskResolutionType resolution) {
    return Optional.ofNullable(resolution).map(VERDICTS::get);
  }

  public static void decide(Task task, TaskResolutionType resolution, String comment, String user) {
    Optional<Verdict> verdict = verdictOf(resolution);
    if (verdict.isEmpty()) {
      requireReviewEnded(task);
    }
    verdict.ifPresent(decided -> apply(decided, task, comment, user));
  }

  /**
   * While its memory is held for conflicts the review is the only way out of review, so it ends by
   * a decision, not by closing it; the server closes it once the memory leaves review.
   */
  public static void requireReviewEnded(Task task) {
    boolean isHeld = false;
    try {
      isHeld = MemoryConflictReviewTasks.isHeldForConflicts(reviewedMemory(task));
    } catch (EntityNotFoundException deleted) {
      LOG.debug("[MemoryConflictReview] the memory of task {} is gone", task.getId(), deleted);
    }
    if (isHeld) {
      throw new BadRequestException(DECIDE_TO_END_REVIEW);
    }
  }

  private static void apply(Verdict verdict, Task task, String comment, String user) {
    ContextMemory reviewed = reviewedMemory(task);
    List<MemoryChange> changes = changesFor(verdict, task, reviewed, comment, user);
    changes.stream()
        .filter(change -> !change.before().getId().equals(reviewed.getId()))
        .forEach(change -> requireMaySupersede(change, user));
    whileDeciding(reviewed.getId(), () -> changes.forEach(change -> write(change, user)));
    LOG.info("[MemoryConflictReview] {} decided {} for memory {}", user, verdict, reviewed.getId());
  }

  private static List<MemoryChange> changesFor(
      Verdict verdict, Task task, ContextMemory reviewed, String comment, String user) {
    List<MemoryDispute> disputes = disputesOf(task, reviewed);
    return verdict == Verdict.APPROVE
        ? MemoryConflictDecision.approve(reviewed, disputes, readableDisputed(disputes, user))
        : MemoryConflictDecision.reject(reviewed, comment);
  }

  /**
   * A direct PATCH checks a memory's visibility before its policy, and a refusal names the memory
   * it refuses, so an approval reads only Approved disputed memories the resolver can read.
   */
  private static Map<UUID, ContextMemory> readableDisputed(
      List<MemoryDispute> disputes, String user) {
    Map<UUID, ContextMemory> disputed = disputedMemories(disputes);
    boolean isAdmin = SubjectContext.getSubjectContext(user).isAdmin();
    boolean hidesOne =
        disputed.values().stream()
            .anyMatch(
                memory ->
                    memory.getEntityStatus() == ContextMemoryStatus.APPROVED
                        && !ContextMemoryVisibility.isVisibleToUser(memory, user, isAdmin));
    if (hidesOne) {
      throw new AuthorizationException(String.format(MAY_NOT_READ_DISPUTED, user));
    }
    return disputed;
  }

  /**
   * A memory in review holds its disputes; leaving Draft releases them, so a decision retried after
   * its writes landed reads the disputes the task recorded.
   */
  private static List<MemoryDispute> disputesOf(Task task, ContextMemory reviewed) {
    return reviewed.getEntityStatus() == ContextMemoryStatus.DRAFT
        ? listOrEmpty(reviewed.getDisputes())
        : recordedDisputes(task);
  }

  static List<MemoryDispute> recordedDisputes(Task task) {
    MemoryConflictReviewTasks.OpenedFor openedFor =
        task.getPayload() == null
            ? null
            : JsonUtils.convertValueLenient(
                task.getPayload(), MemoryConflictReviewTasks.OpenedFor.class);
    return openedFor == null
        ? List.of()
        : listOrEmpty(openedFor.disputes()).stream()
            .map(
                contradiction ->
                    new MemoryDispute()
                        .withMemory(contradiction.memory())
                        .withDetectedAt(contradiction.detectedAt()))
            .toList();
  }

  private static ContextMemory reviewedMemory(Task task) {
    EntityReference about = task.getAbout();
    if (about == null || !Entity.CONTEXT_MEMORY.equals(about.getType())) {
      throw new BadRequestException(NOT_A_MEMORY);
    }
    return Entity.getEntity(Entity.CONTEXT_MEMORY, about.getId(), "owners", Include.NON_DELETED);
  }

  private static Map<UUID, ContextMemory> disputedMemories(List<MemoryDispute> disputes) {
    Map<UUID, ContextMemory> disputed = new HashMap<>();
    disputes.forEach(
        dispute -> {
          UUID id = dispute.getMemory().getId();
          try {
            disputed.put(
                id,
                Entity.getEntity(Entity.CONTEXT_MEMORY, id, DISPUTED_FIELDS, Include.NON_DELETED));
          } catch (EntityNotFoundException deleted) {
            LOG.debug("[MemoryConflictReview] disputed memory {} is gone", id, deleted);
          }
        });
    return disputed;
  }

  /** The same check a direct PATCH superseding that memory would face. */
  private static void requireMaySupersede(MemoryChange change, String user) {
    UUID memoryId = change.before().getId();
    DefaultAuthorizer.authorizeUser(
        user,
        new OperationContext(Entity.CONTEXT_MEMORY, diff(change)),
        new ResourceContext<>(
            Entity.CONTEXT_MEMORY, memoryId, null, ResourceContextInterface.Operation.PATCH));
  }

  /**
   * Guarded on the version and the update time read, so a concurrent edit fails the decision
   * instead of being overwritten: consecutive edits by one user can keep the version.
   */
  private static void write(MemoryChange change, String user) {
    ContextMemory before = change.before();
    JsonArrayBuilder operations =
        Json.createArrayBuilder()
            .add(
                Json.createObjectBuilder()
                    .add("op", "test")
                    .add("path", "/updatedAt")
                    .add("value", before.getUpdatedAt()));
    diff(change).toJsonArray().forEach(operations::add);
    PatchResponse<ContextMemory> response;
    try {
      response =
          memoryRepository()
              .patch(
                  null,
                  before.getId(),
                  user,
                  Json.createPatch(operations.build()),
                  ChangeSource.MANUAL,
                  EntityETag.generateWeakETag(before),
                  GOVERNANCE_BOT);
    } catch (JsonException changedSinceRead) {
      throw new PreconditionFailedException(CHANGED_WHILE_DECIDING);
    }
    memoryRepository()
        .storeChangeEventForAsyncOperation(response.entity(), response.changeType(), false, user);
  }

  private static JsonPatch diff(MemoryChange change) {
    return JsonUtils.getJsonPatch(change.before(), change.after());
  }

  private static ContextMemoryRepository memoryRepository() {
    return (ContextMemoryRepository) Entity.getEntityRepository(Entity.CONTEXT_MEMORY);
  }
}
