package org.openmetadata.service.context.center;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryScope;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.llm.LLMCompletionException;

@ExtendWith(MockitoExtension.class)
class ContextMemoryReconcilerTest {

  @Mock private ContextMemoryRepository memoryRepository;

  private final EntityReference source =
      new EntityReference().withId(UUID.randomUUID()).withName("page").withType(Entity.PAGE);

  private ContextMemory pill(
      String question, String answer, ContextMemorySourceType type, ContextMemoryStatus status) {
    return new ContextMemory()
        .withId(UUID.randomUUID())
        .withName(question)
        .withQuestion(question)
        .withAnswer(answer)
        .withMemoryScope(ContextMemoryScope.ENTITY_SCOPED)
        .withPrimaryEntity(source)
        .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.ENTITY))
        .withSourceType(type)
        .withEntityStatus(status);
  }

  private ContextMemory derived(String question, String answer) {
    return pill(
        question, answer, ContextMemorySourceType.PAGE_EXTRACTION, ContextMemoryStatus.APPROVED);
  }

  private void existing(ContextMemory... pills) {
    when(memoryRepository.listExtractedMemories(source.getId(), Entity.PAGE))
        .thenReturn(List.of(pills));
  }

  private ContextMemoryReconciler.ReconcileResult reconcile(List<ContextMemory> derived) {
    return new ContextMemoryReconciler(memoryRepository).reconcile(source, Entity.PAGE, derived);
  }

  @Test
  void failedDuplicateCheckLeavesNoPartiallyCreatedPills() {
    existing();
    List<ContextMemory> saved = new ArrayList<>();
    lenient()
        .when(memoryRepository.create(isNull(), any()))
        .thenAnswer(
            invocation -> {
              ContextMemory memory = invocation.getArgument(1);
              saved.add(memory);
              return memory;
            });
    ContextMemory first = derived("What is GDPR?", "A data protection regulation.");
    ContextMemory second = derived("What is consent?", "Freely given agreement.");
    ContextMemoryReconciler reconciler =
        new ContextMemoryReconciler(
            memoryRepository,
            memory -> {
              if (memory == second) {
                throw new LLMCompletionException("Failed to parse LLM JSON array response");
              }
              return null;
            });

    assertThrows(
        LLMCompletionException.class,
        () -> reconciler.reconcile(source, Entity.PAGE, List.of(first, second)));
    assertEquals(List.of(), saved);
  }

  @Test
  void failedDuplicateCheckPreservesExistingPillsAndSourceLinks() {
    ContextMemory changed = derived("What is GDPR?", "Original definition.");
    ContextMemory retired = derived("Who owns the process?", "The compliance team.");
    ContextMemory shared = derived("What is consent?", "Original consent definition.");
    existing(changed, retired, shared);
    when(memoryRepository.hasOtherSources(any(), eq(source)))
        .thenAnswer(invocation -> shared.getId().equals(invocation.getArgument(0)));
    ContextMemoryReconciler reconciler =
        new ContextMemoryReconciler(
            memoryRepository,
            memory -> {
              throw new LLMCompletionException("Failed to parse LLM JSON array response");
            });

    assertThrows(
        LLMCompletionException.class,
        () ->
            reconciler.reconcile(
                source,
                Entity.PAGE,
                List.of(
                    derived("What is GDPR?", "Revised definition."),
                    derived("What is consent?", "Revised consent definition."),
                    derived("What is personal data?", "Information identifying a person."))));
    verify(memoryRepository, never()).updateIfCurrent(any(), any(), any(), any());
    verify(memoryRepository, never()).releaseExtractedMemory(any(), any());
    verify(memoryRepository, never()).linkExtractedMemory(any(), any());
    verify(memoryRepository, never()).create(any(), any());
  }

  @Test
  void doesNotReuseTheOldContentOfAMemoryScheduledForUpdate() {
    ContextMemory stored = derived("What is GDPR?", "Original definition.");
    ContextMemory fresh = derived("What is personal data?", "Information identifying a person.");
    existing(stored);
    ContextMemoryReconciler reconciler =
        new ContextMemoryReconciler(memoryRepository, ignored -> stored);

    ContextMemoryReconciler.ReconcileResult result =
        reconciler.reconcile(
            source, Entity.PAGE, List.of(derived("What is GDPR?", "Revised definition."), fresh));

    assertEquals(1, result.updated());
    assertEquals(1, result.created());
    verify(memoryRepository).create(isNull(), eq(fresh));
    verify(memoryRepository, never()).linkExtractedMemory(any(), any());
  }

  @Test
  void doesNotReuseAMemoryScheduledForRetirement() {
    ContextMemory retired = derived("Who owns the process?", "The compliance team.");
    ContextMemory fresh = derived("What is personal data?", "Information identifying a person.");
    existing(retired);
    ContextMemoryReconciler reconciler =
        new ContextMemoryReconciler(memoryRepository, ignored -> retired);

    ContextMemoryReconciler.ReconcileResult result =
        reconciler.reconcile(source, Entity.PAGE, List.of(fresh));

    assertEquals(1, result.deleted());
    assertEquals(1, result.created());
    verify(memoryRepository).create(isNull(), eq(fresh));
    verify(memoryRepository, never()).linkExtractedMemory(any(), any());
  }

  @Test
  void rephrasedQuestionKeepsThePillInsteadOfChurningIt() {
    // Real pair from a re-extraction where only an unrelated paragraph changed. Scores 0.680 on
    // the weighted gate: above the identity bar, so the existing pill retains its identity.
    ContextMemory stored =
        pill(
            "Who is paged when checkout breaks and how does it escalate?",
            "The Payments Platform team owns the checkout on-call rotation and escalates to the"
                + " Commerce Director after 30 minutes without acknowledgement.",
            ContextMemorySourceType.PAGE_EXTRACTION,
            ContextMemoryStatus.APPROVED);
    stored.setUsageCount(42);
    existing(stored);

    ContextMemoryReconciler.ReconcileResult result =
        reconcile(
            List.of(
                derived(
                    "How does checkout on-call escalation work?",
                    "The Payments Platform team owns the checkout on-call rotation and escalates to"
                        + " the Commerce Director after 30 minutes without acknowledgement.")));

    assertEquals(1, result.updated(), "the rephrased fact should inherit the stored pill");
    assertEquals(0, result.created());
    assertEquals(0, result.deleted());
    verify(memoryRepository, never()).create(isNull(), any());

    ArgumentCaptor<ContextMemory> captor = ArgumentCaptor.forClass(ContextMemory.class);
    verify(memoryRepository).updateIfCurrent(isNull(), any(), captor.capture(), any());
    assertEquals(stored.getId(), captor.getValue().getId(), "identity is the point of the match");
    assertEquals(42, captor.getValue().getUsageCount(), "retrieval telemetry rides the identity");
  }

  @Test
  void unrelatedFactDoesNotClaimAnExistingPill() {
    // Scores 0.175 on the same gate: the stored fact really is gone from the source, so it must be
    // retired rather than overwritten by whatever is closest.
    ContextMemory stored =
        pill(
            "How are incidents announced to the business?",
            "Paging happens through Opsgenie, never through Slack alone.",
            ContextMemorySourceType.PAGE_EXTRACTION,
            ContextMemoryStatus.APPROVED);
    existing(stored);

    ContextMemoryReconciler.ReconcileResult result =
        reconcile(
            List.of(
                derived(
                    "What is the maximum acceptable payment queue depth?",
                    "Above 2000 messages the team declares a Sev-1 and disables guest checkout.")));

    assertEquals(1, result.created());
    assertEquals(1, result.deleted());
    assertEquals(0, result.updated());
  }

  @Test
  void createsAllWhenNoExistingPills() {
    existing();

    ContextMemoryReconciler.ReconcileResult result =
        reconcile(List.of(derived("Q1", "A1"), derived("Q2", "A2")));

    assertEquals(2, result.created());
    verify(memoryRepository, times(2)).create(isNull(), any());
  }

  @Test
  void keepsUnchangedPillWithoutUpdateOrReembed() {
    existing(
        pill("Q1", "A1", ContextMemorySourceType.PAGE_EXTRACTION, ContextMemoryStatus.APPROVED));

    ContextMemoryReconciler.ReconcileResult result = reconcile(List.of(derived("Q1", "A1")));

    assertEquals(1, result.kept());
    assertEquals(0, result.created());
    verify(memoryRepository, never()).create(any(), any());
    verify(memoryRepository, never()).updateIfCurrent(any(), any(), any(), any());
  }

  @ParameterizedTest
  @EnumSource(
      value = ContextMemoryStatus.class,
      names = {"DRAFT", "ARCHIVED", "DEPRECATED", "REJECTED"})
  void reExtractionLeavesAPillOutsideApprovedAsIs(ContextMemoryStatus retired) {
    existing(
        pill("Q1", "A1", ContextMemorySourceType.PAGE_EXTRACTION, retired),
        pill("Q2", "A2", ContextMemorySourceType.PAGE_EXTRACTION, retired));

    ContextMemoryReconciler.ReconcileResult result =
        reconcile(List.of(derived("Q1", "A1"), derived("Q2", "A2 revised")));

    assertEquals(0, result.updated());
    assertEquals(0, result.created(), "a retired pill still claims its fact");
    verify(memoryRepository, never()).updateIfCurrent(any(), any(), any(), any());
  }

  @Test
  void keepsASecondAnswerTheDocumentGivesToAnExistingQuestion() {
    ContextMemory kept =
        pill("Q1", "15%", ContextMemorySourceType.PAGE_EXTRACTION, ContextMemoryStatus.APPROVED);
    existing(kept);
    ContextMemory conflicting = derived("Q1", "25%");

    ContextMemoryReconciler.ReconcileResult result =
        reconcile(List.of(derived("Q1", "15%"), conflicting));

    assertEquals(1, result.kept());
    assertEquals(1, result.created());
    verify(memoryRepository).create(isNull(), eq(conflicting));
    verify(memoryRepository, never()).updateIfCurrent(any(), any(), any(), any());
  }

  @Test
  void reExtractionStillMaintainsAPillAwaitingReview() {
    ContextMemory pending =
        pill("Q1", "old", ContextMemorySourceType.PAGE_EXTRACTION, ContextMemoryStatus.UNPROCESSED);
    existing(pending);

    ContextMemoryReconciler.ReconcileResult result = reconcile(List.of(derived("Q1", "new")));

    assertEquals(1, result.updated());
    ArgumentCaptor<ContextMemory> captor = ArgumentCaptor.forClass(ContextMemory.class);
    verify(memoryRepository).updateIfCurrent(isNull(), eq(pending), captor.capture(), any());
    assertEquals("new", captor.getValue().getAnswer());
    assertEquals(pending.getId(), captor.getValue().getId());
    // OSS derives Approved: a changed fact takes the stage it was derived in.
    assertEquals(ContextMemoryStatus.APPROVED, captor.getValue().getEntityStatus());
  }

  /** P1 15% -> "25% (HR policy)", P2 25% -> 20%: the HR value keeps P2; P1's value is gone. */
  @Test
  void aChangedNumberIsANewClaimNeverASiblingReworded() {
    ContextMemory fifteen =
        pill(
            "Discount?",
            "15%",
            ContextMemorySourceType.PAGE_EXTRACTION,
            ContextMemoryStatus.APPROVED);
    ContextMemory twentyFive =
        pill(
            "Discount?",
            "25%",
            ContextMemorySourceType.PAGE_EXTRACTION,
            ContextMemoryStatus.APPROVED);
    existing(fifteen, twentyFive);
    ContextMemory twenty = derived("Discount?", "20%");

    reconcile(List.of(derived("Discount?", "25% (HR policy)"), twenty));

    ArgumentCaptor<ContextMemory> captor = ArgumentCaptor.forClass(ContextMemory.class);
    verify(memoryRepository).updateIfCurrent(isNull(), eq(twentyFive), captor.capture(), any());
    assertEquals("25% (HR policy)", captor.getValue().getAnswer());
    verify(memoryRepository, never()).updateIfCurrent(isNull(), eq(fifteen), any(), any());
    verify(memoryRepository).releaseExtractedMemory(fifteen.getId(), source);
    verify(memoryRepository).create(isNull(), eq(twenty));
  }

  /** A reviewer superseded 15%; rephrasing both answers must not hand 15% to the Approved 25%. */
  @Test
  void aReviewersDecisionSurvivesRephrasedSiblings() {
    ContextMemory superseded =
        pill(
            "Discount?",
            "15%",
            ContextMemorySourceType.PAGE_EXTRACTION,
            ContextMemoryStatus.SUPERSEDED);
    ContextMemory approved =
        pill(
            "Discount?",
            "25%",
            ContextMemorySourceType.PAGE_EXTRACTION,
            ContextMemoryStatus.APPROVED);
    existing(superseded, approved);

    reconcile(
        List.of(
            derived("Discount?", "15% per the Sales handbook"),
            derived("Discount?", "25% (HR policy)")));

    ArgumentCaptor<ContextMemory> captor = ArgumentCaptor.forClass(ContextMemory.class);
    verify(memoryRepository).updateIfCurrent(isNull(), eq(approved), captor.capture(), any());
    assertEquals("25% (HR policy)", captor.getValue().getAnswer());
    verify(memoryRepository, never()).updateIfCurrent(isNull(), eq(superseded), any(), any());
    verify(memoryRepository, never()).create(any(), any());
  }

  /** A section or edition number added to both values rewords them; the settled review stands. */
  @Test
  void aSettledConflictRewordedWithSectionNumbersStaysSettled() {
    ContextMemory superseded =
        pill(
            "Discount?",
            "15%",
            ContextMemorySourceType.PAGE_EXTRACTION,
            ContextMemoryStatus.SUPERSEDED);
    ContextMemory approved =
        pill(
            "Discount?",
            "25%",
            ContextMemorySourceType.PAGE_EXTRACTION,
            ContextMemoryStatus.APPROVED);
    existing(superseded, approved);

    reconcile(
        List.of(
            derived("Discount?", "15% (Sales handbook, section 3)"),
            derived("Discount?", "25% (HR policy, 2026 edition)")));

    ArgumentCaptor<ContextMemory> captor = ArgumentCaptor.forClass(ContextMemory.class);
    verify(memoryRepository).updateIfCurrent(isNull(), eq(approved), captor.capture(), any());
    assertEquals("25% (HR policy, 2026 edition)", captor.getValue().getAnswer());
    verify(memoryRepository, never()).releaseExtractedMemory(any(), any());
    verify(memoryRepository, never()).create(any(), any());
  }

  /** Dropping an incidental year keeps the pill and its telemetry. */
  @Test
  void anUnchangedFactWithoutItsYearKeepsItsPill() {
    ContextMemory dated =
        pill(
            "Refund window?",
            "As of 2025, refunds are accepted within 30 days.",
            ContextMemorySourceType.PAGE_EXTRACTION,
            ContextMemoryStatus.APPROVED);
    existing(dated);

    reconcile(List.of(derived("Refund window?", "Refunds are accepted within 30 days.")));

    verify(memoryRepository).updateIfCurrent(isNull(), eq(dated), any(), any());
    verify(memoryRepository, never()).releaseExtractedMemory(any(), any());
    verify(memoryRepository, never()).create(any(), any());
  }

  /** A person corrected 30 to 45 days: the document's 30 days must not come back beside it. */
  @Test
  void aHumanCorrectionKeepsClaimingTheDocumentsValue() {
    ContextMemory corrected =
        pill(
            "Refund window?",
            "45 days",
            ContextMemorySourceType.MANUAL,
            ContextMemoryStatus.APPROVED);
    existing(corrected);

    reconcile(List.of(derived("Refund window?", "30 days")));

    verify(memoryRepository, never()).create(any(), any());
    verify(memoryRepository, never()).updateIfCurrent(any(), any(), any(), any());
  }

  /**
   * Listed first, the corrected pill would take the HR policy's 25%: the extracted pills claim
   * their rewordings first, and the correction takes the document's value that is left.
   */
  @Test
  void aCorrectedPillTakesOnlyTheValueTheExtractedPillsLeave() {
    ContextMemory corrected =
        pill(
            "Commission rate?",
            "20% per HR policy update",
            ContextMemorySourceType.MANUAL,
            ContextMemoryStatus.APPROVED);
    ContextMemory hrValue =
        pill(
            "Commission rate?",
            "25% (HR policy)",
            ContextMemorySourceType.PAGE_EXTRACTION,
            ContextMemoryStatus.APPROVED);
    existing(corrected, hrValue);

    reconcile(
        List.of(
            derived("Commission rate?", "15% per the Sales handbook"),
            derived("Commission rate?", "25% per the HR policy")));

    verify(memoryRepository, never()).create(any(), any());
    verify(memoryRepository, never()).releaseExtractedMemory(any(), any());
    ArgumentCaptor<ContextMemory> captor = ArgumentCaptor.forClass(ContextMemory.class);
    verify(memoryRepository).updateIfCurrent(isNull(), eq(hrValue), captor.capture(), any());
    assertEquals("25% per the HR policy", captor.getValue().getAnswer());
  }

  /** Which of two values a person corrected is unknown, so neither is claimed for the correction. */
  @Test
  void aCorrectedPillClaimsNoValueWhenTwoAreLeft() {
    existing(
        pill(
            "Commission rate?",
            "20% per HR policy update",
            ContextMemorySourceType.MANUAL,
            ContextMemoryStatus.APPROVED));

    reconcile(
        List.of(
            derived("Commission rate?", "15% per the Sales handbook"),
            derived("Commission rate?", "25% per the HR policy")));

    verify(memoryRepository, times(2)).create(isNull(), any());
  }

  /** The model rewrites summaries on every run; that alone must not send a reviewed fact back. */
  @Test
  void aRewordedSummaryKeepsTheStageItWasReviewedIn() {
    ContextMemory approved =
        pill(
                "Refund window?",
                "30 days",
                ContextMemorySourceType.PAGE_EXTRACTION,
                ContextMemoryStatus.APPROVED)
            .withSummary("Refunds within a month.");
    existing(approved);
    ContextMemory rederived =
        pill(
                "Refund window?",
                "30 days",
                ContextMemorySourceType.PAGE_EXTRACTION,
                ContextMemoryStatus.UNPROCESSED)
            .withSummary("Customers have 30 days to ask for a refund.");

    reconcile(List.of(rederived));

    ArgumentCaptor<ContextMemory> captor = ArgumentCaptor.forClass(ContextMemory.class);
    verify(memoryRepository).updateIfCurrent(isNull(), eq(approved), captor.capture(), any());
    assertEquals(ContextMemoryStatus.APPROVED, captor.getValue().getEntityStatus());
    assertEquals("Customers have 30 days to ask for a refund.", captor.getValue().getSummary());
  }

  /** A run reading past this write's time must find it, however long the duplicate checks took. */
  @Test
  void aCreatedPillIsStampedWhenItIsWritten() {
    existing();
    ContextMemory fresh = derived("Q1", "A1").withUpdatedAt(1L);
    long before = System.currentTimeMillis();

    reconcile(List.of(fresh));

    ArgumentCaptor<ContextMemory> captor = ArgumentCaptor.forClass(ContextMemory.class);
    verify(memoryRepository).create(isNull(), captor.capture());
    assertTrue(captor.getValue().getUpdatedAt() >= before);
  }

  /** A review decided while the source was being re-extracted wins over the plan's snapshot. */
  @Test
  void aPillChangedDuringReExtractionIsLeftAsIs() {
    ContextMemory original =
        pill("Q1", "old", ContextMemorySourceType.PAGE_EXTRACTION, ContextMemoryStatus.APPROVED);
    existing(original);
    when(memoryRepository.updateIfCurrent(isNull(), eq(original), any(), any()))
        .thenThrow(new PreconditionFailedException("stale"));

    assertEquals(1, reconcile(List.of(derived("Q1", "new"))).updated());
  }

  /** A reviewing provider derives Unprocessed pills, so a changed fact goes back to review. */
  @Test
  void aChangedFactTakesTheStatusItWasDerivedIn() {
    ContextMemory approved =
        pill("Q1", "old", ContextMemorySourceType.PAGE_EXTRACTION, ContextMemoryStatus.APPROVED);
    existing(approved);
    ContextMemory changed =
        pill("Q1", "new", ContextMemorySourceType.PAGE_EXTRACTION, ContextMemoryStatus.UNPROCESSED);

    reconcile(List.of(changed));

    ArgumentCaptor<ContextMemory> captor = ArgumentCaptor.forClass(ContextMemory.class);
    verify(memoryRepository).updateIfCurrent(isNull(), eq(approved), captor.capture(), any());
    assertEquals(ContextMemoryStatus.UNPROCESSED, captor.getValue().getEntityStatus());
  }

  @Test
  void updatesPillInPlaceWhenAnswerChanges() {
    ContextMemory original =
        pill("Q1", "old", ContextMemorySourceType.PAGE_EXTRACTION, ContextMemoryStatus.APPROVED);
    existing(original);

    ContextMemoryReconciler.ReconcileResult result = reconcile(List.of(derived("Q1", "new")));

    assertEquals(1, result.updated());
    ArgumentCaptor<ContextMemory> captor = ArgumentCaptor.forClass(ContextMemory.class);
    verify(memoryRepository)
        .updateIfCurrent(isNull(), eq(original), captor.capture(), eq(Entity.ADMIN_USER_NAME));
    assertEquals("new", captor.getValue().getAnswer());
    assertEquals(original.getId(), captor.getValue().getId(), "identity must be preserved");
  }

  @Test
  void deletesPillNoLongerDerived() {
    ContextMemory gone =
        pill("gone", "A", ContextMemorySourceType.PAGE_EXTRACTION, ContextMemoryStatus.APPROVED);
    existing(gone);

    ContextMemoryReconciler.ReconcileResult result = reconcile(List.of(derived("fresh", "A")));

    assertEquals(1, result.deleted());
    assertEquals(1, result.created());
    verify(memoryRepository).releaseExtractedMemory(gone.getId(), source);
    verify(memoryRepository, never()).updateIfCurrent(any(), any(), any(), any());
  }

  @Test
  void neverTouchesManuallyEditedPillAndDoesNotDuplicateIt() {
    existing(pill("Q1", "human", ContextMemorySourceType.MANUAL, ContextMemoryStatus.APPROVED));

    ContextMemoryReconciler.ReconcileResult result =
        reconcile(List.of(derived("Q1", "llm answer"), derived("Q2", "A2")));

    verify(memoryRepository, never()).updateIfCurrent(any(), any(), any(), any());
    ArgumentCaptor<ContextMemory> captor = ArgumentCaptor.forClass(ContextMemory.class);
    verify(memoryRepository, times(1)).create(isNull(), captor.capture());
    assertEquals("Q2", captor.getValue().getQuestion(), "Q1 is owned by the manual pill");
    assertEquals(1, result.created());
  }

  @Test
  void keepsPillIdentityWhenTheQuestionIsRephrased() {
    // Same fact, reworded question: the pill must be updated in place, not retired and recreated,
    // so usageCount/lastUsedAt and the embedding survive a re-extraction.
    ContextMemory original =
        pill(
            "How should billing totals handle refunds?",
            "Filter to amount > 0 to exclude refunds from totals.",
            ContextMemorySourceType.PAGE_EXTRACTION,
            ContextMemoryStatus.APPROVED);
    existing(original);

    ContextMemoryReconciler.ReconcileResult result =
        reconcile(
            List.of(
                derived(
                    "How should billing totals handle the refunds?",
                    "Filter to amount > 0 to exclude refunds from totals.")));

    assertEquals(0, result.created(), "a rephrase must not create a second pill");
    assertEquals(0, result.deleted(), "a rephrase must not retire the original");
    assertEquals(1, result.updated());
    ArgumentCaptor<ContextMemory> captor = ArgumentCaptor.forClass(ContextMemory.class);
    verify(memoryRepository)
        .updateIfCurrent(isNull(), eq(original), captor.capture(), eq(Entity.ADMIN_USER_NAME));
    assertEquals(original.getId(), captor.getValue().getId(), "identity must be preserved");
    assertEquals(
        "How should billing totals handle the refunds?",
        captor.getValue().getQuestion(),
        "the rephrased question must be adopted");
  }

  @Test
  void keepsASourceOwnedCopyWhenAnotherSourceStatesTheSameFact() {
    existing();

    ContextMemoryReconciler.ReconcileResult result =
        reconcile(
            List.of(
                derived(
                    "What is the data retention window?", "Raw events are retained for 90 days.")));

    assertEquals(1, result.created());
    verify(memoryRepository).create(isNull(), any());
  }

  @Test
  void reusesEquivalentMemoryForAnotherFile() {
    EntityReference file =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withName("report")
            .withType(Entity.CONTEXT_FILE);
    when(memoryRepository.listExtractedMemories(file.getId(), Entity.CONTEXT_FILE))
        .thenReturn(List.of());
    ContextMemory equivalent =
        pill(
            "What is the retention window?",
            "Events are retained for 90 days.",
            ContextMemorySourceType.FILE_EXTRACTION,
            ContextMemoryStatus.APPROVED);
    ContextMemoryReconciler reconciler =
        new ContextMemoryReconciler(memoryRepository, ignored -> equivalent);

    ContextMemoryReconciler.ReconcileResult result =
        reconciler.reconcile(
            file,
            Entity.CONTEXT_FILE,
            List.of(derived("What is the retention window?", "Events are retained for 90 days.")));

    assertEquals(0, result.created());
    assertEquals(1, result.kept());
    verify(memoryRepository).linkExtractedMemory(equivalent.getId(), file);
    verify(memoryRepository, never()).create(any(), any());
  }

  @Test
  void changedSharedFactLeavesOtherSourceMemoryIntact() {
    ContextMemory shared =
        pill(
            "How long are events retained?",
            "Events are retained for 90 days.",
            ContextMemorySourceType.PAGE_EXTRACTION,
            ContextMemoryStatus.APPROVED);
    existing(shared);

    // A changed number never pairs with the old pill: it is released from this source only, and
    // releaseExtractedMemory keeps it while another source still states it.
    ContextMemoryReconciler.ReconcileResult result =
        reconcile(
            List.of(derived("How long are events retained?", "Events are retained for 30 days.")));

    assertEquals(1, result.created());
    verify(memoryRepository).releaseExtractedMemory(shared.getId(), source);
    verify(memoryRepository, never()).updateIfCurrent(any(), any(), any(), any());
  }

  @Test
  void identicalSourceLinksAllExistingMemories() {
    EntityReference original =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withName("original.md")
            .withType(Entity.CONTEXT_FILE);
    EntityReference copy =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withName("copy.md")
            .withType(Entity.CONTEXT_FILE);
    ContextMemory memory =
        pill(
            "What is the retention window?",
            "Events are retained for 90 days.",
            ContextMemorySourceType.FILE_EXTRACTION,
            ContextMemoryStatus.APPROVED);
    when(memoryRepository.listExtractedMemories(original.getId(), Entity.CONTEXT_FILE))
        .thenReturn(List.of(memory));

    ContextMemoryReconciler.ReconcileResult result =
        new ContextMemoryReconciler(memoryRepository).reuseExtractedFrom(copy, original);

    assertEquals(1, result.kept());
    verify(memoryRepository).linkExtractedMemory(memory.getId(), copy);
    verify(memoryRepository, never()).create(any(), any());
  }

  @Test
  void rederivationRepairsLegacyPillVisibilityAndScope() {
    ContextMemory legacy =
        pill("Q", "A", ContextMemorySourceType.PAGE_EXTRACTION, ContextMemoryStatus.APPROVED);
    legacy.setMemoryScope(null);
    legacy.setPrimaryEntity(null);
    legacy.setShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.SHARED));
    existing(legacy);

    ContextMemoryReconciler.ReconcileResult result = reconcile(List.of(derived("Q", "A")));

    assertEquals(1, result.updated());
    ArgumentCaptor<ContextMemory> captor = ArgumentCaptor.forClass(ContextMemory.class);
    verify(memoryRepository)
        .updateIfCurrent(isNull(), eq(legacy), captor.capture(), eq(Entity.ADMIN_USER_NAME));
    ContextMemory repaired = captor.getValue();
    assertEquals(ContextMemoryScope.ENTITY_SCOPED, repaired.getMemoryScope());
    assertEquals(source.getId(), repaired.getPrimaryEntity().getId());
    assertEquals(MemoryVisibility.ENTITY, repaired.getShareConfig().getVisibility());
  }
}
