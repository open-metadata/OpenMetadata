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

import static org.openmetadata.service.governance.workflows.WorkflowEventConsumer.GOVERNANCE_BOT;

import jakarta.ws.rs.BadRequestException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.context.ExtractedMemoryApproval;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.type.ComparedMemory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.context.center.MemoryReviewHolds;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.resources.context.ContextMemoryWriteAccess;
import org.openmetadata.service.security.AuthorizationException;

/**
 * Approves a document's Unprocessed extracted memories for a person who decides them, written as a
 * review decision is (ADR:2026-11-06-a-documents-extracted-memories-are-approved-from-the-document).
 * Only the pills the person was shown are approved, and only as they were read. A pill asking the
 * question of another Unprocessed, Draft or Approved pill of the document is a second value, and one
 * re-extraction would hold beside a decided pill may be that decision reworded: both stay pending.
 */
@Slf4j
public final class ExtractedMemoryApprover {
  static final String CHANGED_WHILE_APPROVING =
      "The memory changed while its document's memories were being approved";

  /** Stages in which a pill still gives its question a value. */
  private static final Set<ContextMemoryStatus> STATING =
      Set.of(
          ContextMemoryStatus.UNPROCESSED, ContextMemoryStatus.DRAFT, ContextMemoryStatus.APPROVED);

  private final ContextMemoryRepository repository;

  public ExtractedMemoryApprover(ContextMemoryRepository repository) {
    this.repository = repository;
  }

  /** The pills approval may take, and those it leaves for a person to decide. */
  record Plan(List<ContextMemory> approvable, List<ContextMemory> needsDecision) {
    List<EntityReference> needsDecisionReferences() {
      return needsDecision.stream().map(ContextMemory::getEntityReference).toList();
    }
  }

  /** What approving {@code source}'s extracted memories would do, as read now; writes nothing. */
  public ExtractedMemoryApproval preview(EntityReference source) {
    Plan plan = plan(extractedFrom(source));
    return new ExtractedMemoryApproval()
        .withApproved(plan.approvable().size())
        .withFailed(0)
        .withNeedsDecision(plan.needsDecisionReferences())
        .withApprovable(plan.approvable().stream().map(ExtractedMemoryApprover::asRead).toList());
  }

  /**
   * Approves, as {@code user} decided it, each pill of {@code shown} still approvable as it was read:
   * a shown pill that changed or is no longer approvable fails, and one never shown is untouched.
   */
  public ExtractedMemoryApproval approve(
      EntityReference source, List<ComparedMemory> shown, String user) {
    Plan plan = plan(extractedFrom(source));
    Map<UUID, ContextMemory> approvable =
        plan.approvable().stream().collect(Collectors.toMap(ContextMemory::getId, pill -> pill));
    int approved = 0;
    for (ComparedMemory read : shown) {
      // Taken once: a pill listed twice is no longer approvable the second time.
      ContextMemory pill = approvable.remove(read.getId());
      if (isAsRead(pill, read) && approveOne(pill, user)) {
        approved++;
      }
    }
    return new ExtractedMemoryApproval()
        .withApproved(approved)
        .withFailed(shown.size() - approved)
        .withNeedsDecision(plan.needsDecisionReferences());
  }

  static Plan plan(List<ContextMemory> memories) {
    Map<Boolean, List<ContextMemory>> contested =
        memories.stream()
            .filter(ExtractedMemoryApprover::awaitsApproval)
            .collect(Collectors.partitioningBy(memory -> isContested(memory, memories)));
    return new Plan(contested.get(false), contested.get(true));
  }

  /**
   * Another Unprocessed, Draft or Approved value of its question needs a person to choose, and so
   * does a value re-extraction would hold beside a decided pill: it may be one a reviewer rejected
   * or replaced, reworded.
   */
  private static boolean isContested(ContextMemory memory, List<ContextMemory> memories) {
    return memories.stream()
        .filter(other -> !other.getId().equals(memory.getId()))
        .anyMatch(
            other -> isAnotherValueOf(other, memory) || MemoryReviewHolds.holds(other, memory));
  }

  private static boolean isAnotherValueOf(ContextMemory other, ContextMemory memory) {
    return STATING.contains(other.getEntityStatus())
        && MemoryReviewHolds.sameQuestion(other, memory);
  }

  /** Only an Unprocessed pill extraction made: a Draft awaits its conflict review. */
  private static boolean awaitsApproval(ContextMemory memory) {
    return memory.getEntityStatus() == ContextMemoryStatus.UNPROCESSED
        && ContextMemoryWriteAccess.isAutomatedSource(memory.getSourceType());
  }

  private static ComparedMemory asRead(ContextMemory pill) {
    return new ComparedMemory()
        .withId(pill.getId())
        .withContentUpdatedAt(MemoryConflictDecision.contentTime(pill));
  }

  private static boolean isAsRead(ContextMemory pill, ComparedMemory read) {
    return pill != null
        && read.getContentUpdatedAt() != null
        && MemoryConflictDecision.contentTime(pill) == read.getContentUpdatedAt();
  }

  private List<ContextMemory> extractedFrom(EntityReference source) {
    return repository.listExtractedMemories(source.getId(), source.getType());
  }

  /** A pill refused, changed or released meanwhile is not approved and does not fail the others. */
  private static boolean approveOne(ContextMemory pill, String user) {
    boolean approved = false;
    try {
      GuardedMemoryPatch.apply(
          new MemoryChange(pill, approvedCopy(pill)),
          new GuardedMemoryPatch.Writer(
              user, ChangeSource.MANUAL, GOVERNANCE_BOT, CHANGED_WHILE_APPROVING));
      approved = true;
    } catch (PreconditionFailedException
        | BadRequestException
        | AuthorizationException
        | EntityNotFoundException e) {
      LOG.info(
          "[ExtractedMemoryApproval] memory {} was not approved: {}", pill.getId(), e.getMessage());
    }
    return approved;
  }

  private static ContextMemory approvedCopy(ContextMemory pill) {
    return JsonUtils.deepCopy(pill, ContextMemory.class)
        .withEntityStatus(ContextMemoryStatus.APPROVED);
  }
}
