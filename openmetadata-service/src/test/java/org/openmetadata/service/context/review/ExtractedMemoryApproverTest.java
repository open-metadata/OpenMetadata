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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.governance.workflows.WorkflowEventConsumer.GOVERNANCE_BOT;

import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.context.ExtractedMemoryApproval;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.util.RestUtil.PatchResponse;

class ExtractedMemoryApproverTest {

  private static ContextMemory pill(
      String question, ContextMemoryStatus status, ContextMemorySourceType sourceType) {
    UUID id = UUID.randomUUID();
    return new ContextMemory()
        .withId(id)
        .withName("pill-" + id)
        .withFullyQualifiedName("pill-" + id)
        .withQuestion(question)
        .withAnswer("An answer")
        .withEntityStatus(status)
        .withSourceType(sourceType);
  }

  private static ContextMemory extracted(String question, ContextMemoryStatus status) {
    return pill(question, status, ContextMemorySourceType.FILE_EXTRACTION);
  }

  private static List<UUID> ids(List<ContextMemory> memories) {
    return memories.stream().map(ContextMemory::getId).toList();
  }

  @Test
  void pendingPillsOfDistinctQuestionsAreApprovable() {
    ContextMemory window = extracted("What is the refund window?", ContextMemoryStatus.UNPROCESSED);
    ContextMemory fee = extracted("What is the refund fee?", ContextMemoryStatus.UNPROCESSED);

    ExtractedMemoryApprover.Plan plan = ExtractedMemoryApprover.plan(List.of(window, fee));

    assertEquals(ids(List.of(window, fee)), ids(plan.approvable()));
    assertEquals(List.of(), plan.needsDecision());
  }

  /** The extractor keeps two pills for one question only when their values conflict. */
  @Test
  void twoPendingValuesOfOneQuestionBothNeedADecision() {
    ContextMemory fifteen = extracted("Commission rate?", ContextMemoryStatus.UNPROCESSED);
    ContextMemory twenty = extracted("  commission RATE? ", ContextMemoryStatus.UNPROCESSED);

    ExtractedMemoryApprover.Plan plan = ExtractedMemoryApprover.plan(List.of(fifteen, twenty));

    assertEquals(List.of(), plan.approvable());
    assertEquals(ids(List.of(fifteen, twenty)), ids(plan.needsDecision()));
  }

  /** An Approved value, a correction's included, or one in conflict review, contests the pill. */
  @ParameterizedTest
  @EnumSource(
      value = ContextMemoryStatus.class,
      names = {"APPROVED", "DRAFT"})
  void aPendingPillBesideAnotherStatedValueNeedsADecision(ContextMemoryStatus stated) {
    ContextMemory pending = extracted("Commission rate?", ContextMemoryStatus.UNPROCESSED);
    ContextMemory correction = pill("Commission rate?", stated, ContextMemorySourceType.MANUAL);

    ExtractedMemoryApprover.Plan plan = ExtractedMemoryApprover.plan(List.of(pending, correction));

    assertEquals(List.of(), plan.approvable());
    assertEquals(ids(List.of(pending)), ids(plan.needsDecision()));
  }

  /** A retired value no longer answers the question, so a new value beside it is approvable. */
  @ParameterizedTest
  @EnumSource(
      value = ContextMemoryStatus.class,
      names = {"REJECTED", "SUPERSEDED", "ARCHIVED", "DEPRECATED", "INVALIDATED"})
  void aRetiredValueOfTheSameQuestionDoesNotHoldANewValue(ContextMemoryStatus retired) {
    ContextMemory pending =
        extracted("Commission rate?", ContextMemoryStatus.UNPROCESSED).withAnswer("20%");

    ExtractedMemoryApprover.Plan plan =
        ExtractedMemoryApprover.plan(
            List.of(pending, extracted("Commission rate?", retired).withAnswer("15%")));

    assertEquals(ids(List.of(pending)), ids(plan.approvable()));
  }

  /** A reviewer rejected the refund window: the same value reworded must not come back approved. */
  @Test
  void aRewordingOfARejectedValueNeedsADecision() {
    ContextMemory rejected =
        extracted("What is the refund window?", ContextMemoryStatus.REJECTED).withAnswer("30 days");
    ContextMemory reworded =
        extracted("What is the window for refunds?", ContextMemoryStatus.UNPROCESSED)
            .withAnswer("30 days");

    ExtractedMemoryApprover.Plan plan = ExtractedMemoryApprover.plan(List.of(rejected, reworded));

    assertEquals(List.of(), plan.approvable());
    assertEquals(ids(List.of(reworded)), ids(plan.needsDecision()));
  }

  /** The edit modal saves a correction's text as question and answer: its old value is held. */
  @Test
  void theValueAnEditedCorrectionReplacedNeedsADecision() {
    ContextMemory correction =
        pill(
                "The refund window is 45 days",
                ContextMemoryStatus.APPROVED,
                ContextMemorySourceType.MANUAL)
            .withAnswer("The refund window is 45 days");
    ContextMemory replaced =
        extracted("What is the refund window?", ContextMemoryStatus.UNPROCESSED)
            .withAnswer("30 days");

    ExtractedMemoryApprover.Plan plan = ExtractedMemoryApprover.plan(List.of(correction, replaced));

    assertEquals(List.of(), plan.approvable());
    assertEquals(ids(List.of(replaced)), ids(plan.needsDecision()));
  }

  /** Only Unprocessed pills extraction made are approved: a Draft awaits its conflict review. */
  @Test
  void neitherADraftNorAPersonsPendingMemoryIsApprovable() {
    ContextMemory draft = extracted("Refund window?", ContextMemoryStatus.DRAFT);
    ContextMemory manual =
        pill("Refund fee?", ContextMemoryStatus.UNPROCESSED, ContextMemorySourceType.MANUAL);

    ExtractedMemoryApprover.Plan plan = ExtractedMemoryApprover.plan(List.of(draft, manual));

    assertEquals(List.of(), plan.approvable());
    assertEquals(List.of(), plan.needsDecision());
  }

  /** A re-extraction may release a pill while its document is approved: it counts as failed. */
  @Test
  void aPillReleasedMeanwhileCountsAsFailedAndTheOthersAreApproved() {
    ContextMemory released =
        extracted("What is the refund window?", ContextMemoryStatus.UNPROCESSED)
            .withVersion(0.1)
            .withUpdatedAt(1L);
    ContextMemory kept =
        extracted("What is the refund fee?", ContextMemoryStatus.UNPROCESSED)
            .withVersion(0.1)
            .withUpdatedAt(1L);
    ContextMemoryRepository writes = mock(ContextMemoryRepository.class);
    when(writes.patch(
            isNull(), eq(released.getId()), eq("alice"), any(), any(), any(), eq(GOVERNANCE_BOT)))
        .thenThrow(new EntityNotFoundException("released by a re-extraction"));
    when(writes.patch(
            isNull(), eq(kept.getId()), eq("alice"), any(), any(), any(), eq(GOVERNANCE_BOT)))
        .thenReturn(new PatchResponse<>(Response.Status.OK, kept, EventType.ENTITY_UPDATED));

    ExtractedMemoryApproval result = approveWriting(writes, List.of(released, kept));

    assertEquals(1, result.getApproved());
    assertEquals(1, result.getFailed());
  }

  private static ExtractedMemoryApproval approveWriting(
      ContextMemoryRepository writes, List<ContextMemory> pills) {
    EntityReference file =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.CONTEXT_FILE);
    ContextMemoryRepository listing = mock(ContextMemoryRepository.class);
    when(listing.listExtractedMemories(file.getId(), Entity.CONTEXT_FILE)).thenReturn(pills);
    try (MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      entities.when(() -> Entity.getEntityRepository(Entity.CONTEXT_MEMORY)).thenReturn(writes);
      return new ExtractedMemoryApprover(listing).approve(file, "alice");
    }
  }

  @Test
  void aPreviewCountsWhatApprovalWouldDoAndNamesWhatItLeaves() {
    EntityReference file =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.CONTEXT_FILE);
    ContextMemory window = extracted("What is the refund window?", ContextMemoryStatus.UNPROCESSED);
    ContextMemory fifteen = extracted("Commission rate?", ContextMemoryStatus.UNPROCESSED);
    ContextMemory twenty = extracted("Commission rate?", ContextMemoryStatus.UNPROCESSED);
    ContextMemoryRepository repository = mock(ContextMemoryRepository.class);
    when(repository.listExtractedMemories(file.getId(), Entity.CONTEXT_FILE))
        .thenReturn(List.of(window, fifteen, twenty));

    ExtractedMemoryApproval preview = new ExtractedMemoryApprover(repository).preview(file);

    assertEquals(1, preview.getApproved());
    assertEquals(0, preview.getFailed());
    assertEquals(
        List.of(fifteen.getId(), twenty.getId()),
        preview.getNeedsDecision().stream().map(EntityReference::getId).toList());
  }
}
