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
import static org.junit.jupiter.api.Assertions.assertThrows;
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

import jakarta.ws.rs.ServiceUnavailableException;
import jakarta.ws.rs.core.Response;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Predicate;
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
  /** No memory a person decided, in another document, holds any pending pill. */
  private static final Predicate<ContextMemory> NO_DECISION = pending -> false;

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

  /** Different values of one question need a person to choose. */
  @Test
  void twoPendingValuesOfOneQuestionBothNeedADecision() {
    ContextMemory fifteen =
        extracted("Commission rate?", ContextMemoryStatus.UNPROCESSED).withAnswer("15%");
    ContextMemory twenty =
        extracted("  commission RATE? ", ContextMemoryStatus.UNPROCESSED).withAnswer("20%");

    ExtractedMemoryApprover.Plan plan = ExtractedMemoryApprover.plan(List.of(fifteen, twenty));

    assertEquals(List.of(), plan.approvable());
    assertEquals(ids(List.of(fifteen, twenty)), ids(plan.needsDecision()));
  }

  /** First extraction can keep question variants even when their answers agree. */
  @ParameterizedTest
  @EnumSource(
      value = ContextMemoryStatus.class,
      names = {"UNPROCESSED", "APPROVED"})
  void theSameExtractedAnswerToAQuestionVariantDoesNotNeedADecision(ContextMemoryStatus stated) {
    ContextMemory pending =
        extracted("What's the refund window?", ContextMemoryStatus.UNPROCESSED)
            .withAnswer("30 days");
    ContextMemory equivalent =
        extracted("What is the refund window?", stated).withAnswer(" 30 DAYS ");
    List<ContextMemory> approvable =
        stated == ContextMemoryStatus.UNPROCESSED ? List.of(pending, equivalent) : List.of(pending);

    ExtractedMemoryApprover.Plan plan = ExtractedMemoryApprover.plan(List.of(pending, equivalent));

    assertEquals(ids(approvable), ids(plan.approvable()));
    assertEquals(List.of(), plan.needsDecision());
  }

  @Test
  void anUnansweredClaimStillHoldsADifferentAnswer() {
    ContextMemory unanswered =
        extracted("What's the refund window?", ContextMemoryStatus.UNPROCESSED).withAnswer(null);
    ContextMemory answered =
        extracted("What is the refund window?", ContextMemoryStatus.UNPROCESSED)
            .withAnswer("30 days");

    ExtractedMemoryApprover.Plan plan = ExtractedMemoryApprover.plan(List.of(unanswered, answered));

    assertEquals(List.of(), plan.approvable());
    assertEquals(ids(List.of(unanswered, answered)), ids(plan.needsDecision()));
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
      return new ExtractedMemoryApprover(listing, NO_DECISION).approve(file, shown, "alice", false);
    }
  }

  /**
   * One memory, one review: a memory two documents share is approved from either, but a second
   * value the other document gives its question leaves it for an admin in both.
   */
  @Test
  void aHoldInOneDocumentBlocksApprovalFromAnother() {
    EntityReference original =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.CONTEXT_FILE);
    EntityReference copy =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.CONTEXT_FILE);
    ContextMemory shared =
        extracted("Commission rate?", ContextMemoryStatus.UNPROCESSED).withAnswer("15%");
    ContextMemory secondValue =
        extracted("Commission rate?", ContextMemoryStatus.UNPROCESSED).withAnswer("20%");
    ContextMemoryRepository repository = mock(ContextMemoryRepository.class);
    when(repository.listExtractedMemories(copy.getId(), Entity.CONTEXT_FILE))
        .thenReturn(List.of(shared));
    when(repository.listExtractedMemories(original.getId(), Entity.CONTEXT_FILE))
        .thenReturn(List.of(shared, secondValue));
    when(repository.listExtractedSources(List.of(shared.getId())))
        .thenReturn(Map.of(shared.getId(), List.of(original, copy)));
    ExtractedMemoryApprover approver = new ExtractedMemoryApprover(repository, NO_DECISION);

    ExtractedMemoryApproval preview = approver.preview(copy, "alice", false);

    assertEquals(List.of(), preview.getApprovable());
    assertEquals(List.of(shared.getId()), refIds(preview.getNeedsDecision()));
    ExtractedMemoryApproval result = approver.approve(copy, asRead(shared), "alice", false);
    assertEquals(0, result.getApproved());
    assertEquals(1, result.getFailed());
    assertEquals(List.of(shared.getId()), refIds(result.getNeedsDecision()));
  }

  /** A value a decision in another document holds needs an admin, as a hold in its own does. */
  @Test
  void aValueADecisionElsewhereHoldsNeedsAnAdmin() {
    EntityReference file =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.CONTEXT_FILE);
    ContextMemory held =
        extracted("When is the customer billed?", ContextMemoryStatus.UNPROCESSED)
            .withAnswer("Customers are billed on the 10th.");
    ContextMemory free = extracted("What is the refund fee?", ContextMemoryStatus.UNPROCESSED);
    ContextMemoryRepository repository = mock(ContextMemoryRepository.class);
    when(repository.listExtractedMemories(file.getId(), Entity.CONTEXT_FILE))
        .thenReturn(List.of(held, free));
    ExtractedMemoryApprover approver =
        new ExtractedMemoryApprover(repository, pending -> held.getId().equals(pending.getId()));

    ExtractedMemoryApproval preview = approver.preview(file, "alice", false);

    assertEquals(asRead(free), preview.getApprovable());
    assertEquals(List.of(held.getId()), refIds(preview.getNeedsDecision()));
    ExtractedMemoryApproval refused = approver.approve(file, asRead(held), "alice", false);
    assertEquals(0, refused.getApproved());
    assertEquals(1, refused.getFailed());
    assertEquals(List.of(held.getId()), refIds(refused.getNeedsDecision()));
  }

  /** A decision check that cannot run fails the request; it never reads as "nothing holds it". */
  @Test
  void anUnreadableDecisionCheckFailsTheRequestAndApprovesNothing() {
    EntityReference file =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.CONTEXT_FILE);
    ContextMemory pending =
        extracted("When is the customer billed?", ContextMemoryStatus.UNPROCESSED)
            .withAnswer("Customers are billed on the 10th.");
    ContextMemoryRepository repository = mock(ContextMemoryRepository.class);
    when(repository.listExtractedMemories(file.getId(), Entity.CONTEXT_FILE))
        .thenReturn(List.of(pending));
    ExtractedMemoryApprover approver =
        new ExtractedMemoryApprover(
            repository,
            unchecked -> {
              throw new ServiceUnavailableException("Memory search index is unavailable");
            });

    assertThrows(ServiceUnavailableException.class, () -> approver.preview(file, "alice", false));
    assertThrows(
        ServiceUnavailableException.class,
        () -> approver.approve(file, asRead(pending), "alice", false));
  }

  @Test
  void aPreviewCountsWhatApprovalWouldDoAndNamesWhatItLeaves() {
    EntityReference file =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.CONTEXT_FILE);
    ContextMemory window = extracted("What is the refund window?", ContextMemoryStatus.UNPROCESSED);
    ContextMemory fifteen =
        extracted("Commission rate?", ContextMemoryStatus.UNPROCESSED).withAnswer("15%");
    ContextMemory twenty =
        extracted("Commission rate?", ContextMemoryStatus.UNPROCESSED).withAnswer("20%");
    ContextMemoryRepository repository = mock(ContextMemoryRepository.class);
    when(repository.listExtractedMemories(file.getId(), Entity.CONTEXT_FILE))
        .thenReturn(List.of(window, fifteen, twenty));

    ExtractedMemoryApproval preview =
        new ExtractedMemoryApprover(repository, NO_DECISION).preview(file, "alice", false);

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
            .withAnswer("30 days")
            .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.PRIVATE));
    ContextMemory visible =
        extracted("What is the refund window?", ContextMemoryStatus.UNPROCESSED)
            .withAnswer("45 days")
            .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.ENTITY));
    ContextMemoryRepository repository = mock(ContextMemoryRepository.class);
    when(repository.listExtractedMemories(file.getId(), Entity.CONTEXT_FILE))
        .thenReturn(List.of(hidden, decided, visible));
    ExtractedMemoryApprover approver = new ExtractedMemoryApprover(repository, NO_DECISION);

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
