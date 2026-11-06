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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.governance.workflows.WorkflowEventConsumer.GOVERNANCE_BOT;

import jakarta.ws.rs.core.Response;
import java.util.Arrays;
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
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.type.ComparedMemory;
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
        .withSourceType(sourceType)
        .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.ENTITY))
        .withVersion(0.1)
        .withUpdatedAt(1L);
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

  /** "What's" asks what "What is" asks: two values of the refund window both need a decision. */
  @Test
  void questionsDifferingOnlyInPunctuationOrAContractionAreOneQuestion() {
    ContextMemory thirty =
        extracted("What is the refund window?", ContextMemoryStatus.UNPROCESSED)
            .withAnswer("30 days");
    ContextMemory fortyFive =
        extracted("What's the refund window", ContextMemoryStatus.UNPROCESSED)
            .withAnswer("45 days");

    ExtractedMemoryApprover.Plan plan = ExtractedMemoryApprover.plan(List.of(thirty, fortyFive));

    assertEquals(List.of(), plan.approvable());
    assertEquals(ids(List.of(thirty, fortyFive)), ids(plan.needsDecision()));
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
        extracted("What is the refund window?", ContextMemoryStatus.UNPROCESSED);
    ContextMemory kept = extracted("What is the refund fee?", ContextMemoryStatus.UNPROCESSED);
    ContextMemoryRepository writes = mock(ContextMemoryRepository.class);
    when(writes.patch(
            isNull(), eq(released.getId()), eq("alice"), any(), any(), any(), eq(GOVERNANCE_BOT)))
        .thenThrow(new EntityNotFoundException("released by a re-extraction"));
    when(writes.patch(
            isNull(), eq(kept.getId()), eq("alice"), any(), any(), any(), eq(GOVERNANCE_BOT)))
        .thenReturn(new PatchResponse<>(Response.Status.OK, kept, EventType.ENTITY_UPDATED));

    ExtractedMemoryApproval result =
        approveWriting(writes, List.of(released, kept), asRead(released, kept));

    assertEquals(1, result.getApproved());
    assertEquals(1, result.getFailed());
  }

  /** Approval takes only what the person was shown: a pill extracted since stays pending. */
  @Test
  void aPillThePreviewDidNotListIsLeftUntouched() {
    ContextMemory shown = extracted("What is the refund fee?", ContextMemoryStatus.UNPROCESSED);
    ContextMemory extractedSince =
        extracted("What is the refund window?", ContextMemoryStatus.UNPROCESSED);
    ContextMemoryRepository writes = approvingEverything(shown, extractedSince);

    ExtractedMemoryApproval result =
        approveWriting(writes, List.of(shown, extractedSince), asRead(shown));

    assertEquals(1, result.getApproved());
    assertEquals(0, result.getFailed());
    verify(writes, never())
        .patch(any(), eq(extractedSince.getId()), any(), any(), any(), any(), any());
  }

  /** A pill whose claim changed after the preview read it is not approved as it now reads. */
  @Test
  void aListedPillWhoseClaimChangedSinceThePreviewFails() {
    ContextMemory read = extracted("What is the refund fee?", ContextMemoryStatus.UNPROCESSED);
    List<ComparedMemory> shown = asRead(read);
    ContextMemory rewritten = read.withAnswer("Another answer").withLastContentUpdatedAt(2L);
    ContextMemoryRepository writes = approvingEverything(rewritten);

    ExtractedMemoryApproval result = approveWriting(writes, List.of(rewritten), shown);

    assertEquals(0, result.getApproved());
    assertEquals(1, result.getFailed());
    verify(writes, never()).patch(any(), any(UUID.class), any(), any(), any(), any(), any());
  }

  /** A listed pill another value now contests needs a decision, not the approval it was shown. */
  @Test
  void aListedPillThatNoLongerQualifiesFails() {
    ContextMemory listed =
        extracted("What is the refund window?", ContextMemoryStatus.UNPROCESSED)
            .withAnswer("30 days");
    ContextMemory secondValue =
        extracted("What is the refund window?", ContextMemoryStatus.UNPROCESSED)
            .withAnswer("45 days");
    ContextMemoryRepository writes = approvingEverything(listed, secondValue);

    ExtractedMemoryApproval result =
        approveWriting(writes, List.of(listed, secondValue), asRead(listed));

    assertEquals(0, result.getApproved());
    assertEquals(1, result.getFailed());
    assertEquals(ids(List.of(listed, secondValue)), refIds(result.getNeedsDecision()));
    verify(writes, never()).patch(any(), any(UUID.class), any(), any(), any(), any(), any());
  }

  @Test
  void aPillListedTwiceIsApprovedOnce() {
    ContextMemory window = extracted("What is the refund window?", ContextMemoryStatus.UNPROCESSED);
    ContextMemoryRepository writes = approvingEverything(window);

    ExtractedMemoryApproval result =
        approveWriting(writes, List.of(window), asRead(window, window));

    assertEquals(1, result.getApproved());
    assertEquals(1, result.getFailed());
    verify(writes).patch(any(), eq(window.getId()), any(), any(), any(), any(), any());
  }

  private static ContextMemoryRepository approvingEverything(ContextMemory... pills) {
    ContextMemoryRepository writes = mock(ContextMemoryRepository.class);
    for (ContextMemory pill : pills) {
      when(writes.patch(isNull(), eq(pill.getId()), any(), any(), any(), any(), any()))
          .thenReturn(new PatchResponse<>(Response.Status.OK, pill, EventType.ENTITY_UPDATED));
    }
    return writes;
  }

  private static List<ComparedMemory> asRead(ContextMemory... pills) {
    return Arrays.stream(pills)
        .map(
            pill ->
                new ComparedMemory()
                    .withId(pill.getId())
                    .withContentUpdatedAt(MemoryConflictDecision.contentTime(pill)))
        .toList();
  }

  private static List<UUID> refIds(List<EntityReference> references) {
    return references.stream().map(EntityReference::getId).toList();
  }

  private static ExtractedMemoryApproval approveWriting(
      ContextMemoryRepository writes, List<ContextMemory> pills, List<ComparedMemory> shown) {
    EntityReference file =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.CONTEXT_FILE);
    ContextMemoryRepository listing = mock(ContextMemoryRepository.class);
    when(listing.listExtractedMemories(file.getId(), Entity.CONTEXT_FILE)).thenReturn(pills);
    try (MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      entities.when(() -> Entity.getEntityRepository(Entity.CONTEXT_MEMORY)).thenReturn(writes);
      return new ExtractedMemoryApprover(listing).approve(file, shown, "alice", false);
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

    ExtractedMemoryApproval preview =
        new ExtractedMemoryApprover(repository).preview(file, "alice", false);

    assertEquals(1, preview.getApproved());
    assertEquals(0, preview.getFailed());
    assertEquals(asRead(window), preview.getApprovable());
    assertEquals(List.of(fifteen.getId(), twenty.getId()), refIds(preview.getNeedsDecision()));
  }

  @Test
  void hiddenMemoriesAreNeitherReturnedNorApprovedButStillHoldConflictingValues() {
    EntityReference file =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.CONTEXT_FILE);
    ContextMemory hidden =
        extracted("Who signs off refunds?", ContextMemoryStatus.UNPROCESSED)
            .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.PRIVATE));
    ContextMemory decided =
        extracted("What is the refund window?", ContextMemoryStatus.APPROVED)
            .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.PRIVATE));
    ContextMemory visible =
        extracted("What is the refund window?", ContextMemoryStatus.UNPROCESSED)
            .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.ENTITY));
    ContextMemoryRepository repository = mock(ContextMemoryRepository.class);
    when(repository.listExtractedMemories(file.getId(), Entity.CONTEXT_FILE))
        .thenReturn(List.of(hidden, decided, visible));
    ExtractedMemoryApprover approver = new ExtractedMemoryApprover(repository);

    ExtractedMemoryApproval preview = approver.preview(file, "alice", false);

    assertEquals(0, preview.getApproved());
    assertEquals(List.of(), preview.getApprovable());
    assertEquals(List.of(visible.getId()), refIds(preview.getNeedsDecision()));
    ExtractedMemoryApproval refused = approver.approve(file, asRead(hidden), "alice", false);
    assertEquals(0, refused.getApproved());
    assertEquals(1, refused.getFailed());
    assertEquals(List.of(visible.getId()), refIds(refused.getNeedsDecision()));
    assertEquals(1, approver.preview(file, "admin", true).getApproved());
  }
}
