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
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
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
import org.openmetadata.service.resources.context.ContextMemoryVisibility;
import org.openmetadata.service.resources.context.ContextMemoryWriteAccess;
import org.openmetadata.service.security.AuthorizationException;

/**
 * Approves a document's Unprocessed extracted memories for a person who decides them, written as a
 * review decision is (ADR:2026-11-06-a-documents-extracted-memories-are-approved-from-the-document).
 * Only the pills the person was shown are approved, and only as they were read. A pill asking the
 * question of another Unprocessed, Draft or Approved pill with a different answer is a second value,
 * and one re-extraction would hold beside a decided pill may be that decision reworded: both stay
 * pending. A pill several documents share has one review, so what any of them leaves pending stays
 * pending from the others, and so does a value a decision in another document holds.
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
  private final Predicate<ContextMemory> heldByADecision;

  /** {@code heldByADecision}: whether, read now, a memory a person decided holds a pending pill. */
  public ExtractedMemoryApprover(
      ContextMemoryRepository repository, Predicate<ContextMemory> heldByADecision) {
    this.repository = repository;
    this.heldByADecision = heldByADecision;
  }

  /** The pills approval may take, and those it leaves for a person to decide. */
  record Plan(List<ContextMemory> approvable, List<ContextMemory> needsDecision) {
    List<EntityReference> needsDecisionReferences() {
      return needsDecision.stream().map(ContextMemory::getEntityReference).toList();
    }
  }

  /** What approving {@code source}'s extracted memories would do, as read now; writes nothing. */
  public ExtractedMemoryApproval preview(EntityReference source, String user, boolean isAdmin) {
    Plan plan = visiblePlan(source, user, isAdmin);
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
      EntityReference source, List<ComparedMemory> shown, String user, boolean isAdmin) {
    Plan plan = visiblePlan(source, user, isAdmin);
    Map<UUID, ContextMemory> approvable =
        plan.approvable().stream().collect(Collectors.toMap(ContextMemory::getId, pill -> pill));
    int approved = 0;
    for (ComparedMemory read : shown) {
      // Taken once: a pill listed twice is no longer approvable the second time.
      ContextMemory pill = approvable.remove(read.getId());
      // The guarded PATCH also rejects a sharing change after this visibility check.
      if (isAsRead(pill, read)
          && ContextMemoryVisibility.isVisibleToUser(pill, user, isAdmin)
          && approveOne(pill, user)) {
        approved++;
      }
    }
    return new ExtractedMemoryApproval()
        .withApproved(approved)
        .withFailed(shown.size() - approved)
        .withNeedsDecision(plan.needsDecisionReferences());
  }

  private Plan visiblePlan(EntityReference source, String user, boolean isAdmin) {
    List<ContextMemory> memories = extractedFrom(source);
    Set<UUID> heldInLinkedDocuments = heldInOtherDocuments(memories, source);
    Plan plan =
        plan(
            memories,
            pill -> heldInLinkedDocuments.contains(pill.getId()) || heldByADecision.test(pill));
    return new Plan(
        ContextMemoryVisibility.filterByVisibility(plan.approvable(), user, isAdmin),
        ContextMemoryVisibility.filterByVisibility(plan.needsDecision(), user, isAdmin));
  }

  static Plan plan(List<ContextMemory> memories) {
    return plan(memories, pill -> false);
  }

  /** {@code heldElsewhere}: whether a memory outside the document leaves a pill for a decision. */
  static Plan plan(List<ContextMemory> memories, Predicate<ContextMemory> heldElsewhere) {
    Map<Boolean, List<ContextMemory>> contested =
        memories.stream()
            .filter(ExtractedMemoryApprover::awaitsApproval)
            .collect(
                Collectors.partitioningBy(
                    memory -> isContested(memory, memories) || heldElsewhere.test(memory)));
    return new Plan(contested.get(false), contested.get(true));
  }

  /** What the other documents this document's pending pills are linked to leave for a decision. */
  private Set<UUID> heldInOtherDocuments(List<ContextMemory> memories, EntityReference source) {
    return otherDocuments(memories, source).stream()
        .flatMap(document -> plan(extractedFrom(document)).needsDecision().stream())
        .map(ContextMemory::getId)
        .collect(Collectors.toSet());
  }

  /** One read for every pending pill of the document. */
  private Collection<EntityReference> otherDocuments(
      List<ContextMemory> memories, EntityReference source) {
    List<UUID> pending =
        memories.stream()
            .filter(ExtractedMemoryApprover::awaitsApproval)
            .map(ContextMemory::getId)
            .toList();
    return repository.listExtractedSources(pending).values().stream()
        .flatMap(List::stream)
        .filter(document -> !document.getId().equals(source.getId()))
        .collect(
            Collectors.toMap(EntityReference::getId, Function.identity(), (first, second) -> first))
        .values();
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
        && MemoryReviewHolds.sameQuestion(other, memory)
        && !StringUtils.stripToEmpty(other.getAnswer())
            .equalsIgnoreCase(StringUtils.stripToEmpty(memory.getAnswer()));
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
