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
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.context.ExtractedMemoryApproval;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.context.center.ContextMemoryExtractor;
import org.openmetadata.service.context.center.MemoryReviewHolds;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.resources.context.ContextMemoryWriteAccess;
import org.openmetadata.service.security.AuthorizationException;

/**
 * Approves a document's Unprocessed extracted memories for a person who decides them, written as a
 * review decision is (ADR:2026-11-06-a-documents-extracted-memories-are-approved-from-the-document).
 * A pill sharing its question with another pending or Approved pill of the document is a second
 * value, and one re-extraction would hold beside a decided pill may be that decision reworded: both
 * stay pending for a person to decide.
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

  /** The pills approval may take, and those that share their question with another value. */
  record Plan(List<ContextMemory> approvable, List<ContextMemory> needsDecision) {
    ExtractedMemoryApproval result(int approved) {
      return new ExtractedMemoryApproval()
          .withApproved(approved)
          .withFailed(approvable.size() - approved)
          .withNeedsDecision(
              needsDecision.stream().map(ContextMemory::getEntityReference).toList());
    }
  }

  /** What approving {@code source}'s extracted memories would do; writes nothing. */
  public ExtractedMemoryApproval preview(EntityReference source) {
    Plan plan = plan(extractedFrom(source));
    return plan.result(plan.approvable().size());
  }

  /** Approves each pill {@link #preview} names on its own, as {@code user} decided it. */
  public ExtractedMemoryApproval approve(EntityReference source, String user) {
    Plan plan = plan(extractedFrom(source));
    int approved = 0;
    for (ContextMemory pill : plan.approvable()) {
      if (approveOne(pill, user)) {
        approved++;
      }
    }
    return plan.result(approved);
  }

  static Plan plan(List<ContextMemory> memories) {
    Map<String, Long> valuesByQuestion =
        memories.stream()
            .filter(memory -> STATING.contains(memory.getEntityStatus()))
            .collect(
                Collectors.groupingBy(ExtractedMemoryApprover::questionKey, Collectors.counting()));
    Map<Boolean, List<ContextMemory>> contested =
        memories.stream()
            .filter(ExtractedMemoryApprover::awaitsApproval)
            .collect(
                Collectors.partitioningBy(
                    memory -> isContested(memory, memories, valuesByQuestion)));
    return new Plan(contested.get(false), contested.get(true));
  }

  /**
   * Another value of its question needs a person to choose, and so does a value re-extraction would
   * hold beside a decided pill: it may be a value a reviewer rejected or replaced, reworded.
   */
  private static boolean isContested(
      ContextMemory memory, List<ContextMemory> memories, Map<String, Long> valuesByQuestion) {
    return valuesByQuestion.get(questionKey(memory)) > 1
        || memories.stream().anyMatch(decided -> MemoryReviewHolds.holds(decided, memory));
  }

  /** Only an Unprocessed pill extraction made: a Draft awaits its conflict review. */
  private static boolean awaitsApproval(ContextMemory memory) {
    return memory.getEntityStatus() == ContextMemoryStatus.UNPROCESSED
        && ContextMemoryWriteAccess.isAutomatedSource(memory.getSourceType());
  }

  private static String questionKey(ContextMemory memory) {
    return ContextMemoryExtractor.questionKey(memory.getQuestion());
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
