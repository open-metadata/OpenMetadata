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

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryDispute;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.PreconditionFailedException;

/**
 * The memory writes that decide a conflict review. Approving supersedes every disputed memory that
 * is still Approved with the reviewed memory and then approves it; rejecting rejects the reviewed
 * memory alone. A decision is refused while it would rest on claims that no longer hold
 * (ADR:2026-10-13-a-memory-conflict-opens-a-review-task-and-approving-it-supersedes-the-disputed-memory).
 */
final class MemoryConflictDecision {

  static final String NO_LONGER_IN_REVIEW =
      "Memory '%s' is no longer in review, so this conflict review cannot decide it";
  static final String CHANGED_AFTER_DETECTION =
      "Memory '%s' changed after the conflict was detected; requeue '%s' to reassess the conflict";
  static final String REJECTED_IN_REVIEW = "Rejected in conflict review";
  static final String SUPERSEDED_IN_REVIEW = "Superseded in conflict review by '%s'";

  private MemoryConflictDecision() {}

  /**
   * Superseding comes first, so a retried approval skips what an interrupted one retired. A memory
   * that is already Approved had its approval written before the task could resolve: retrying
   * converges on superseding what is still Approved.
   */
  static List<MemoryChange> approve(
      ContextMemory reviewed, List<MemoryDispute> disputes, Map<UUID, ContextMemory> disputedById) {
    boolean isApprovedAlready = reviewed.getEntityStatus() == ContextMemoryStatus.APPROVED;
    requireUndecided(reviewed, isApprovedAlready);
    List<MemoryChange> changes = new ArrayList<>(supersessions(reviewed, disputes, disputedById));
    if (!isApprovedAlready) {
      changes.add(stageChange(reviewed, ContextMemoryStatus.APPROVED, null));
    }
    return List.copyOf(changes);
  }

  /** A memory that is already Rejected had its rejection written before the task could resolve. */
  static List<MemoryChange> reject(ContextMemory reviewed, String comment) {
    boolean isRejectedAlready = reviewed.getEntityStatus() == ContextMemoryStatus.REJECTED;
    requireUndecided(reviewed, isRejectedAlready);
    return isRejectedAlready
        ? List.of()
        : List.of(stageChange(reviewed, ContextMemoryStatus.REJECTED, rejectionReason(comment)));
  }

  private static List<MemoryChange> supersessions(
      ContextMemory reviewed, List<MemoryDispute> disputes, Map<UUID, ContextMemory> disputedById) {
    List<MemoryChange> changes = new ArrayList<>();
    for (MemoryDispute dispute : listOrEmpty(disputes)) {
      ContextMemory disputed = disputedById.get(dispute.getMemory().getId());
      if (isApproved(disputed)) {
        requireUnchangedSinceDetection(disputed, dispute, reviewed);
        changes.add(supersede(disputed, reviewed));
      }
    }
    return changes;
  }

  /** Only a memory still in review, or one this same decision already moved, can be decided. */
  private static void requireUndecided(ContextMemory reviewed, boolean isDecidedThisWay) {
    if (!isDecidedThisWay && reviewed.getEntityStatus() != ContextMemoryStatus.DRAFT) {
      throw new PreconditionFailedException(String.format(NO_LONGER_IN_REVIEW, label(reviewed)));
    }
  }

  /** A memory saved before stages existed has none, and was in use: it counts as Approved. */
  private static boolean isApproved(ContextMemory memory) {
    return memory != null
        && (memory.getEntityStatus() == null
            || memory.getEntityStatus() == ContextMemoryStatus.APPROVED);
  }

  private static void requireUnchangedSinceDetection(
      ContextMemory disputed, MemoryDispute dispute, ContextMemory reviewed) {
    Long detectedAt = dispute.getDetectedAt();
    if (detectedAt != null && contentTime(disputed) > detectedAt) {
      throw new PreconditionFailedException(
          String.format(CHANGED_AFTER_DETECTION, label(disputed), label(reviewed)));
    }
  }

  /** Legacy memories have no content clock until their next write; their audit time stands in. */
  private static long contentTime(ContextMemory memory) {
    Long contentTime = memory.getLastContentUpdatedAt();
    return contentTime == null ? memory.getUpdatedAt() : contentTime;
  }

  private static MemoryChange supersede(ContextMemory disputed, ContextMemory reviewed) {
    ContextMemory after =
        copyOf(disputed)
            .withEntityStatus(ContextMemoryStatus.SUPERSEDED)
            .withSupersededBy(referenceTo(reviewed))
            .withStatusReason(String.format(SUPERSEDED_IN_REVIEW, label(reviewed)));
    return new MemoryChange(disputed, after);
  }

  private static MemoryChange stageChange(
      ContextMemory memory, ContextMemoryStatus stage, String reason) {
    return new MemoryChange(
        memory, copyOf(memory).withEntityStatus(stage).withStatusReason(reason));
  }

  private static String rejectionReason(String comment) {
    return nullOrEmpty(comment) || comment.isBlank()
        ? REJECTED_IN_REVIEW
        : REJECTED_IN_REVIEW + ": " + comment.strip();
  }

  private static String label(ContextMemory memory) {
    String title = memory.getTitle();
    return nullOrEmpty(title) || title.isBlank() ? memory.getName() : title;
  }

  private static EntityReference referenceTo(ContextMemory memory) {
    return new EntityReference()
        .withId(memory.getId())
        .withType(Entity.CONTEXT_MEMORY)
        .withName(memory.getName())
        .withFullyQualifiedName(memory.getFullyQualifiedName());
  }

  private static ContextMemory copyOf(ContextMemory memory) {
    return JsonUtils.deepCopy(memory, ContextMemory.class);
  }
}
