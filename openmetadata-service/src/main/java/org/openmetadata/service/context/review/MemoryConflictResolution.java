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
import jakarta.json.JsonPatch;
import jakarta.ws.rs.BadRequestException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.EntityETag;

/**
 * Applies the decision of a memory conflict review task, as the person who decided it. Being able
 * to resolve the task authorizes the decision about the reviewed memory; superseding a disputed
 * memory additionally needs the right to supersede it directly. Any refusal throws before a memory
 * is written, so the task stays open.
 */
@Slf4j
public final class MemoryConflictResolution {

  static final String NOT_A_MEMORY = "A memory conflict review must be about a context memory";

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

  private MemoryConflictResolution() {}

  public static boolean decides(Task task) {
    return task.getType() == MemoryConflictReviewTasks.TASK_TYPE;
  }

  /** Other resolutions, such as cancelling the task, leave the memories as they are. */
  static Optional<Verdict> verdictOf(TaskResolutionType resolution) {
    return Optional.ofNullable(resolution).map(VERDICTS::get);
  }

  public static void decide(Task task, TaskResolutionType resolution, String comment, String user) {
    verdictOf(resolution).ifPresent(verdict -> apply(verdict, task, comment, user));
  }

  private static void apply(Verdict verdict, Task task, String comment, String user) {
    ContextMemory reviewed = reviewedMemory(task);
    List<MemoryChange> changes =
        verdict == Verdict.APPROVE
            ? MemoryConflictDecision.approve(reviewed, disputedMemories(reviewed))
            : MemoryConflictDecision.reject(reviewed, comment);
    changes.stream()
        .filter(change -> !change.before().getId().equals(reviewed.getId()))
        .forEach(change -> requireMaySupersede(change, user));
    changes.forEach(change -> write(change, user));
    LOG.info("[MemoryConflictReview] {} decided {} for memory {}", user, verdict, reviewed.getId());
  }

  private static ContextMemory reviewedMemory(Task task) {
    EntityReference about = task.getAbout();
    if (about == null || !Entity.CONTEXT_MEMORY.equals(about.getType())) {
      throw new BadRequestException(NOT_A_MEMORY);
    }
    return Entity.getEntity(Entity.CONTEXT_MEMORY, about.getId(), "owners", Include.NON_DELETED);
  }

  private static Map<UUID, ContextMemory> disputedMemories(ContextMemory reviewed) {
    Map<UUID, ContextMemory> disputed = new HashMap<>();
    listOrEmpty(reviewed.getDisputes())
        .forEach(
            dispute -> {
              UUID id = dispute.getMemory().getId();
              try {
                disputed.put(
                    id, Entity.getEntity(Entity.CONTEXT_MEMORY, id, "owners", Include.NON_DELETED));
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
    memoryRepository()
        .patch(
            null,
            before.getId(),
            user,
            Json.createPatch(operations.build()),
            ChangeSource.MANUAL,
            EntityETag.generateWeakETag(before),
            GOVERNANCE_BOT);
  }

  private static JsonPatch diff(MemoryChange change) {
    return JsonUtils.getJsonPatch(change.before(), change.after());
  }

  private static EntityRepository<?> memoryRepository() {
    return Entity.getEntityRepository(Entity.CONTEXT_MEMORY);
  }
}
