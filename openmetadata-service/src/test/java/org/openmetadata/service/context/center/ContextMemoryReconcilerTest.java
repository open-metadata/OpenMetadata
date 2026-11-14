package org.openmetadata.service.context.center;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
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
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.llm.LLMCompletionClient;
import org.openmetadata.service.llm.LLMCompletionException;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.SearchResultListMapper;

@ExtendWith(MockitoExtension.class)
class ContextMemoryReconcilerTest {

  @Mock private ContextMemoryRepository memoryRepository;
  @Mock private SearchRepository searchRepository;
  @Mock private SearchClient searchClient;
  @Mock private LLMCompletionClient judge;

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
              return new DuplicateMatch.None();
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
        new ContextMemoryReconciler(
            memoryRepository, ignored -> new DuplicateMatch.Equivalent(stored));

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
        new ContextMemoryReconciler(
            memoryRepository, ignored -> new DuplicateMatch.Equivalent(retired));

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

  /**
   * Which of two values a person corrected is unknown, so neither is claimed for the correction;
   * either may be the one replaced, so both await review.
   */
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

    ArgumentCaptor<ContextMemory> captor = ArgumentCaptor.forClass(ContextMemory.class);
    verify(memoryRepository, times(2)).create(isNull(), captor.capture());
    assertEquals(
        List.of(ContextMemoryStatus.UNPROCESSED, ContextMemoryStatus.UNPROCESSED),
        captor.getAllValues().stream().map(ContextMemory::getEntityStatus).toList());
  }

  private static final String EMPLOYEES = "How many vacation days do employees get per year?";
  private static final String CONTRACTORS = "How many vacation days do contractors get per year?";

  /** A correction claims the document's value for its own question, never another fact. */
  @Test
  void aCorrectedPillClaimsOnlyTheValueOfItsOwnQuestion() {
    existing(
        pill(
            EMPLOYEES,
            "20 days per year",
            ContextMemorySourceType.MANUAL,
            ContextMemoryStatus.APPROVED));

    reconcile(
        List.of(derived(EMPLOYEES, "15 days per year"), derived(CONTRACTORS, "5 days per year")));

    ArgumentCaptor<ContextMemory> captor = ArgumentCaptor.forClass(ContextMemory.class);
    verify(memoryRepository).create(isNull(), captor.capture());
    assertEquals(CONTRACTORS, captor.getValue().getQuestion());
  }

  /** The model rewords questions between runs; a correction still claims its own value. */
  @Test
  void aCorrectedPillClaimsItsOwnQuestionAskedInOtherWords() {
    existing(
        pill(
            "What is the refund window?",
            "45 days",
            ContextMemorySourceType.MANUAL,
            ContextMemoryStatus.APPROVED));

    reconcile(List.of(derived("What's the refund window?", "30 days")));

    verify(memoryRepository, never()).create(any(), any());
  }

  /** "UK" and "US" are two questions: the US value's change must not vanish into the UK fix. */
  @Test
  void aCorrectionNeverTakesTheValueOfAQuestionDifferingInAShortWord() {
    existing(
        pill(
            "How many vacation days do employees in the UK get?",
            "28 days",
            ContextMemorySourceType.MANUAL,
            ContextMemoryStatus.APPROVED),
        pill(
            "How many vacation days do employees in the US get?",
            "15 days",
            ContextMemorySourceType.PAGE_EXTRACTION,
            ContextMemoryStatus.APPROVED));

    reconcile(List.of(derived("How many vacation days do employees in the US get?", "20 days")));

    ArgumentCaptor<ContextMemory> captor = ArgumentCaptor.forClass(ContextMemory.class);
    verify(memoryRepository).create(isNull(), captor.capture());
    assertEquals("20 days", captor.getValue().getAnswer());
  }

  @Test
  void aCorrectionNeverClaimsAnotherQuestionsEqualValue() {
    existing(
        pill(
            "How many vacation days do employees in the UK get?",
            "20 days",
            ContextMemorySourceType.MANUAL,
            ContextMemoryStatus.APPROVED));
    ContextMemory us = derived("How many vacation days do employees in the US get?", "20 days");

    ContextMemoryReconciler.ReconcileResult result = reconcile(List.of(us));

    assertEquals(1, result.created());
    verify(memoryRepository).create(isNull(), eq(us));
  }

  @Test
  void aCorrectionNeverClaimsTheReverseDirectionsValue() {
    ContextMemory forward =
        pill(
            "What is the exchange rate from USD to EUR?",
            "0.9",
            ContextMemorySourceType.MANUAL,
            ContextMemoryStatus.APPROVED);
    ContextMemory reverse =
        pill(
            "What is the exchange rate from EUR to USD?",
            "1.1",
            ContextMemorySourceType.PAGE_EXTRACTION,
            ContextMemoryStatus.APPROVED);
    existing(forward, reverse);
    ContextMemory changedForward = derived(forward.getQuestion(), "0.8");
    ContextMemory changedReverse = derived(reverse.getQuestion(), "0.9");

    ContextMemoryReconciler.ReconcileResult result =
        reconcile(List.of(changedForward, changedReverse));

    assertEquals(1, result.created());
    verify(memoryRepository, never()).create(isNull(), eq(changedForward));
    verify(memoryRepository).create(isNull(), eq(changedReverse));
  }

  @ParameterizedTest
  @EnumSource(
      value = ContextMemoryStatus.class,
      names = {"DRAFT", "REJECTED", "SUPERSEDED", "DEPRECATED", "ARCHIVED", "INVALIDATED"})
  void aReviewedPillNeverClaimsAnotherQuestionsEqualValue(ContextMemoryStatus reviewedStatus) {
    ContextMemory uk =
        pill(
            "How many vacation days do employees in the UK get?",
            "20 days",
            ContextMemorySourceType.PAGE_EXTRACTION,
            reviewedStatus);
    ContextMemory us =
        pill(
            "How many vacation days do employees in the US get?",
            "15 days",
            ContextMemorySourceType.PAGE_EXTRACTION,
            ContextMemoryStatus.APPROVED);
    existing(uk, us);
    ContextMemory changedUk = derived(uk.getQuestion(), "25 days");
    ContextMemory changedUs = derived(us.getQuestion(), "20 days");

    ContextMemoryReconciler.ReconcileResult result = reconcile(List.of(changedUk, changedUs));

    assertEquals(2, result.created());
    verify(memoryRepository).create(isNull(), eq(changedUk));
    verify(memoryRepository).create(isNull(), eq(changedUs));
    verify(memoryRepository, never()).updateIfCurrent(any(), eq(uk), any(), any());
  }

  private static final String REFUND_WINDOW = "What is the refund window?";
  private static final String WINDOW_FOR_REFUNDS = "What is the window for refunds?";

  private void assertCreatedAwaitingReview(String question) {
    ArgumentCaptor<ContextMemory> captor = ArgumentCaptor.forClass(ContextMemory.class);
    verify(memoryRepository).create(isNull(), captor.capture());
    assertEquals(question, captor.getValue().getQuestion());
    assertEquals(ContextMemoryStatus.UNPROCESSED, captor.getValue().getEntityStatus());
  }

  /** Reworded past what a reviewed pill may claim, its own value must not undo the review. */
  @ParameterizedTest
  @EnumSource(
      value = ContextMemoryStatus.class,
      mode = EnumSource.Mode.EXCLUDE,
      names = {"APPROVED", "UNPROCESSED", "DRAFT"})
  void aReviewedPillsRewordedValueAwaitsReviewBesideIt(ContextMemoryStatus reviewedStatus) {
    existing(
        pill(REFUND_WINDOW, "30 days", ContextMemorySourceType.PAGE_EXTRACTION, reviewedStatus));

    ContextMemoryReconciler.ReconcileResult result =
        reconcile(List.of(derived(WINDOW_FOR_REFUNDS, "30 days")));

    assertEquals(0, result.deleted());
    verify(memoryRepository, never()).releaseExtractedMemory(any(), any());
    verify(memoryRepository, never()).updateIfCurrent(any(), any(), any(), any());
    assertCreatedAwaitingReview(WINDOW_FOR_REFUNDS);
  }

  /** Draft awaits a review, no decision: it leaves with its fact; its rewording awaits review. */
  @Test
  void aDraftLeavesWithItsFactWhileItsRewordingAwaitsReview() {
    ContextMemory draft =
        pill(
            REFUND_WINDOW,
            "30 days",
            ContextMemorySourceType.PAGE_EXTRACTION,
            ContextMemoryStatus.DRAFT);
    existing(draft);

    ContextMemoryReconciler.ReconcileResult result =
        reconcile(List.of(derived(WINDOW_FOR_REFUNDS, "30 days")));

    assertEquals(1, result.deleted());
    verify(memoryRepository).releaseExtractedMemory(draft.getId(), source);
    verify(memoryRepository, never()).updateIfCurrent(any(), any(), any(), any());
    assertCreatedAwaitingReview(WINDOW_FOR_REFUNDS);
  }

  /** A reviewed pill matched word for word still holds a look-alike the same run derives. */
  @Test
  void aReviewedPillMatchedExactlyStillHoldsItsLookalike() {
    existing(
        pill(
            REFUND_WINDOW,
            "30 days",
            ContextMemorySourceType.PAGE_EXTRACTION,
            ContextMemoryStatus.REJECTED));

    reconcile(List.of(derived(REFUND_WINDOW, "30 days"), derived(WINDOW_FOR_REFUNDS, "30 days")));

    verify(memoryRepository, never()).releaseExtractedMemory(any(), any());
    verify(memoryRepository, never()).updateIfCurrent(any(), any(), any(), any());
    assertCreatedAwaitingReview(WINDOW_FOR_REFUNDS);
  }

  /** A reviewed pill claims one rewording of its question; another one it leaves is held too. */
  @Test
  void aSecondRewordingOfAReviewedPillsQuestionAwaitsReview() {
    existing(
        pill(
            REFUND_WINDOW,
            "30 days",
            ContextMemorySourceType.PAGE_EXTRACTION,
            ContextMemoryStatus.REJECTED));

    reconcile(
        List.of(
            derived("What's the refund window?", "30 days"),
            derived(REFUND_WINDOW, "Refunds are accepted within 30 days.")));

    verify(memoryRepository, never()).releaseExtractedMemory(any(), any());
    assertCreatedAwaitingReview(REFUND_WINDOW);
  }

  /** A correction stays as it is; its value under a reworded question comes back for review. */
  @Test
  void aCorrectionsRewordedValueAwaitsReviewBesideIt() {
    existing(
        pill(
            REFUND_WINDOW,
            "45 days",
            ContextMemorySourceType.MANUAL,
            ContextMemoryStatus.APPROVED));

    reconcile(List.of(derived(WINDOW_FOR_REFUNDS, "45 days")));

    verify(memoryRepository, never()).releaseExtractedMemory(any(), any());
    verify(memoryRepository, never()).updateIfCurrent(any(), any(), any(), any());
    assertCreatedAwaitingReview(WINDOW_FOR_REFUNDS);
  }

  /** The document's original value under a reworded question must not return beside a correction. */
  @Test
  void theValueACorrectionReplacedAwaitsReviewWhenItsQuestionIsReworded() {
    existing(
        pill(
            REFUND_WINDOW,
            "45 days",
            ContextMemorySourceType.MANUAL,
            ContextMemoryStatus.APPROVED));

    reconcile(List.of(derived(WINDOW_FOR_REFUNDS, "30 days")));

    verify(memoryRepository, never()).releaseExtractedMemory(any(), any());
    verify(memoryRepository, never()).updateIfCurrent(any(), any(), any(), any());
    assertCreatedAwaitingReview(WINDOW_FOR_REFUNDS);
  }

  /**
   * Number-only answers agree word for word, so only the questions tell another fact apart: a
   * changed number beside a correction is held only when its question asks about the same thing.
   */
  @Test
  void anotherFactsChangedNumberBesideACorrectionKeepsItsDerivedStage() {
    existing(
        pill(
            "What is the VAT rate?",
            "20%",
            ContextMemorySourceType.MANUAL,
            ContextMemoryStatus.APPROVED));

    reconcile(List.of(derived("What is the discount rate?", "15%")));

    ArgumentCaptor<ContextMemory> captor = ArgumentCaptor.forClass(ContextMemory.class);
    verify(memoryRepository).create(isNull(), captor.capture());
    assertEquals(ContextMemoryStatus.APPROVED, captor.getValue().getEntityStatus());
  }

  /**
   * The edit modal stores a correction's text as question and answer alike, so the value it
   * replaced matches it by topic only: the pair scores under the bar, the questions alone do not.
   */
  @Test
  void theValueAnEditedCorrectionReplacedAwaitsReview() {
    existing(
        pill(
            "The refund window is 45 days",
            "The refund window is 45 days",
            ContextMemorySourceType.MANUAL,
            ContextMemoryStatus.APPROVED));

    reconcile(List.of(derived(REFUND_WINDOW, "30 days")));

    verify(memoryRepository, never()).updateIfCurrent(any(), any(), any(), any());
    assertCreatedAwaitingReview(REFUND_WINDOW);
  }

  /** A question naming no topic word the test reads is alike to none: no changed number is held. */
  @ParameterizedTest
  @CsvSource({
    "Какая ставка НДС?, 20%, Какая ставка скидки?, 15%",
    "What is Q3?, $2M, What is Q4?, $3M"
  })
  void aCorrectionWithNoReadableTopicHoldsNoChangedNumber(
      String correctedQuestion, String correctedAnswer, String question, String answer) {
    existing(
        pill(
            correctedQuestion,
            correctedAnswer,
            ContextMemorySourceType.MANUAL,
            ContextMemoryStatus.APPROVED));

    reconcile(List.of(derived(question, answer)));

    ArgumentCaptor<ContextMemory> captor = ArgumentCaptor.forClass(ContextMemory.class);
    verify(memoryRepository).create(isNull(), captor.capture());
    assertEquals(ContextMemoryStatus.APPROVED, captor.getValue().getEntityStatus());
  }

  /**
   * The trade-off of holding look-alikes: "UK" and "US" are two questions, so the Rejected UK rate
   * never claims the US one, but it cannot tell the equal US rate from its own reworded either.
   */
  @Test
  void anotherQuestionsEqualValueBesideAReviewedPillCostsOneReview() {
    existing(
        pill(
            "What is the VAT rate in the UK?",
            "20%",
            ContextMemorySourceType.PAGE_EXTRACTION,
            ContextMemoryStatus.REJECTED));

    ContextMemoryReconciler.ReconcileResult result =
        reconcile(List.of(derived("What is the VAT rate in the US?", "20%")));

    assertEquals(1, result.created());
    verify(memoryRepository, never()).releaseExtractedMemory(any(), any());
    assertCreatedAwaitingReview("What is the VAT rate in the US?");
  }

  /** A look-alike a maintained pill claims later in the run is that pill's, not a new memory. */
  @Test
  void aLookalikeAMaintainedPillClaimsIsNotCreated() {
    ContextMemory rejected =
        pill(
            "What is the VAT rate in the UK?",
            "20%",
            ContextMemorySourceType.PAGE_EXTRACTION,
            ContextMemoryStatus.REJECTED);
    ContextMemory approved =
        pill(
            "What is the VAT rate in the US?",
            "20%",
            ContextMemorySourceType.PAGE_EXTRACTION,
            ContextMemoryStatus.APPROVED);
    existing(rejected, approved);

    reconcile(List.of(derived("What's the VAT rate in the US?", "20%")));

    verify(memoryRepository, never()).create(any(), any());
    verify(memoryRepository, never()).releaseExtractedMemory(any(), any());
    verify(memoryRepository).updateIfCurrent(isNull(), eq(approved), any(), any());
  }

  /** A changed value is a new claim, so it keeps the stage it was derived in. */
  @Test
  void aChangedValueBesideAReviewedPillKeepsItsDerivedStage() {
    existing(
        pill(
            REFUND_WINDOW,
            "30 days",
            ContextMemorySourceType.PAGE_EXTRACTION,
            ContextMemoryStatus.REJECTED));

    reconcile(List.of(derived(WINDOW_FOR_REFUNDS, "45 days")));

    verify(memoryRepository, never()).releaseExtractedMemory(any(), any());
    ArgumentCaptor<ContextMemory> captor = ArgumentCaptor.forClass(ContextMemory.class);
    verify(memoryRepository).create(isNull(), captor.capture());
    assertEquals(ContextMemoryStatus.APPROVED, captor.getValue().getEntityStatus());
  }

  /** A reviewed pill whose fact left the source stays linked to it for its review to decide. */
  @ParameterizedTest
  @EnumSource(
      value = ContextMemoryStatus.class,
      mode = EnumSource.Mode.EXCLUDE,
      names = {"APPROVED", "UNPROCESSED", "DRAFT"})
  void aReviewedPillWhoseFactIsGoneIsNotReleased(ContextMemoryStatus reviewedStatus) {
    existing(pill("gone", "A", ContextMemorySourceType.PAGE_EXTRACTION, reviewedStatus));

    ContextMemoryReconciler.ReconcileResult result = reconcile(List.of());

    assertEquals(0, result.deleted());
    verify(memoryRepository, never()).releaseExtractedMemory(any(), any());
  }

  /** With only another fact's value derived, the correction must not swallow it. */
  @Test
  void aCorrectedPillNeverTakesAnotherQuestionsValue() {
    existing(
        pill(
            EMPLOYEES,
            "20 days per year",
            ContextMemorySourceType.MANUAL,
            ContextMemoryStatus.APPROVED));

    reconcile(List.of(derived(CONTRACTORS, "5 days per year")));

    verify(memoryRepository).create(isNull(), any());
  }

  /** Inserting a section above both values renumbers their citations, not their claims. */
  @Test
  void aRenumberedSectionKeepsASettledConflictSettled() {
    ContextMemory superseded =
        pill(
            "Commission rate?",
            "15% (Sales handbook, section 3)",
            ContextMemorySourceType.PAGE_EXTRACTION,
            ContextMemoryStatus.SUPERSEDED);
    ContextMemory approved =
        pill(
            "Commission rate?",
            "25% (HR policy, section 4)",
            ContextMemorySourceType.PAGE_EXTRACTION,
            ContextMemoryStatus.APPROVED);
    existing(superseded, approved);

    reconcile(
        List.of(
            pill(
                "Commission rate?",
                "15% (Sales handbook, section 4)",
                ContextMemorySourceType.PAGE_EXTRACTION,
                ContextMemoryStatus.UNPROCESSED),
            pill(
                "Commission rate?",
                "25% (HR policy, section 5)",
                ContextMemorySourceType.PAGE_EXTRACTION,
                ContextMemoryStatus.UNPROCESSED)));

    verify(memoryRepository, never()).create(any(), any());
    verify(memoryRepository, never()).releaseExtractedMemory(any(), any());
    ArgumentCaptor<ContextMemory> captor = ArgumentCaptor.forClass(ContextMemory.class);
    verify(memoryRepository).updateIfCurrent(isNull(), eq(approved), captor.capture(), any());
    assertEquals(ContextMemoryStatus.APPROVED, captor.getValue().getEntityStatus());
  }

  /** A pill another source also links is the same claim when only its summary was reworded. */
  @Test
  void aSharedPillWithARewordedSummaryStaysLinked() {
    ContextMemory shared =
        pill(
                "Refund window?",
                "30 days",
                ContextMemorySourceType.PAGE_EXTRACTION,
                ContextMemoryStatus.APPROVED)
            .withSummary("Refunds within a month.");
    existing(shared);
    lenient().when(memoryRepository.hasOtherSources(any(), any())).thenReturn(true);

    reconcile(List.of(derived("Refund window?", "30 days").withSummary("Thirty days to refund.")));

    verify(memoryRepository, never()).releaseExtractedMemory(any(), any());
    verify(memoryRepository).updateIfCurrent(isNull(), eq(shared), any(), any());
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

  /** Unlike a reviewed pill, one the engine maintains or one in Draft leaves with its fact. */
  @ParameterizedTest
  @EnumSource(
      value = ContextMemoryStatus.class,
      names = {"APPROVED", "UNPROCESSED", "DRAFT"})
  void deletesPillNoLongerDerived(ContextMemoryStatus stage) {
    ContextMemory gone = pill("gone", "A", ContextMemorySourceType.PAGE_EXTRACTION, stage);
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
        new ContextMemoryReconciler(
            memoryRepository, ignored -> new DuplicateMatch.Equivalent(equivalent));

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

  private final EntityReference copy =
      new EntityReference()
          .withId(UUID.randomUUID())
          .withName("copy.md")
          .withType(Entity.CONTEXT_FILE);

  private ContextMemory fileFact(
      EntityReference file,
      String question,
      String answer,
      ContextMemorySourceType type,
      ContextMemoryStatus status) {
    return pill(question, answer, type, status).withPrimaryEntity(file).withSourceEntity(file);
  }

  /** Another file's memory, as the duplicate check loads it from the memory index. */
  private ContextMemory otherFilesFact(
      String question, String answer, ContextMemorySourceType type, ContextMemoryStatus status) {
    EntityReference original =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withName("original.md")
            .withType(Entity.CONTEXT_FILE);
    return fileFact(original, question, answer, type, status);
  }

  /** The file engine's duplicate check, over a memory index that ranks {@code indexed}. */
  private ContextMemoryReconciler reconcilerOverIndex(ContextMemory... indexed) throws IOException {
    List<Map<String, Object>> hits =
        Arrays.stream(indexed)
            .map(memory -> Map.<String, Object>of("id", memory.getId().toString()))
            .toList();
    when(searchRepository.getSearchClient()).thenReturn(searchClient);
    when(searchClient.searchSimilarContextMemories(anyString(), anyString(), anyInt()))
        .thenReturn(new SearchResultListMapper(hits, hits.size()));
    lenient().when(memoryRepository.isReadableByEveryone(any())).thenReturn(true);
    for (ContextMemory memory : indexed) {
      lenient()
          .when(
              memoryRepository.get(
                  isNull(), eq(memory.getId()), any(), eq(Include.NON_DELETED), eq(false)))
          .thenReturn(memory);
      lenient().when(memoryRepository.hasOrgWideAnchor(memory)).thenReturn(true);
    }
    when(memoryRepository.listExtractedMemories(copy.getId(), Entity.CONTEXT_FILE))
        .thenReturn(List.of());
    return new ContextMemoryReconciler(
        memoryRepository,
        new SemanticMemoryDuplicateFinder(
            memoryRepository, () -> null, () -> searchRepository, judge));
  }

  /** A person rejected the fact: another file stating it links to that decision, not a copy. */
  @Test
  void aFactEquivalentToARejectedMemoryLinksToItAndStaysRejected() throws IOException {
    ContextMemory rejected =
        otherFilesFact(
            REFUND_WINDOW,
            "30 days",
            ContextMemorySourceType.FILE_EXTRACTION,
            ContextMemoryStatus.REJECTED);

    ContextMemoryReconciler.ReconcileResult result =
        reconcilerOverIndex(rejected)
            .reconcile(
                copy,
                Entity.CONTEXT_FILE,
                List.of(
                    fileFact(
                        copy,
                        REFUND_WINDOW,
                        "30 days",
                        ContextMemorySourceType.FILE_EXTRACTION,
                        ContextMemoryStatus.APPROVED)));

    assertEquals(new ContextMemoryReconciler.ReconcileResult(0, 0, 1, 0), result);
    verify(memoryRepository).linkExtractedMemory(rejected.getId(), copy);
    verify(memoryRepository, never()).create(any(), any());
    verify(memoryRepository, never()).updateIfCurrent(any(), any(), any(), any());
    verify(judge, never()).completeStructured(anyString(), anyString(), any());
  }

  /**
   * OSS derives Approved, but another file's original value beside a person's correction may be
   * the very value they replaced: it waits for review instead of grounding.
   */
  @Test
  void aDifferentValueForADecidedFactIsHeldForReviewInOss() throws IOException {
    ContextMemory corrected =
        otherFilesFact(
            REFUND_WINDOW,
            "The refund window is 45 days",
            ContextMemorySourceType.MANUAL,
            ContextMemoryStatus.APPROVED);

    reconcilerOverIndex(corrected)
        .reconcile(
            copy,
            Entity.CONTEXT_FILE,
            List.of(
                fileFact(
                    copy,
                    REFUND_WINDOW,
                    "30 days",
                    ContextMemorySourceType.FILE_EXTRACTION,
                    ContextMemoryStatus.APPROVED)));

    ArgumentCaptor<ContextMemory> created = ArgumentCaptor.forClass(ContextMemory.class);
    verify(memoryRepository).create(isNull(), created.capture());
    assertEquals(ContextMemoryStatus.UNPROCESSED, created.getValue().getEntityStatus());
    assertEquals("30 days", created.getValue().getAnswer());
    verify(memoryRepository, never()).linkExtractedMemory(any(), any());
    verify(judge, never()).completeStructured(anyString(), anyString(), any());
  }

  /** Another file's new value for a fact a person rejected waits for review, in OSS too. */
  @Test
  void aDifferentValueBesideARejectedFactIsHeldForReviewInOss() throws IOException {
    ContextMemory rejected =
        otherFilesFact(
            "When is the customer billed?",
            "Customers are billed on the 5th of each month.",
            ContextMemorySourceType.FILE_EXTRACTION,
            ContextMemoryStatus.REJECTED);

    reconcilerOverIndex(rejected)
        .reconcile(
            copy,
            Entity.CONTEXT_FILE,
            List.of(
                fileFact(
                    copy,
                    "When is the customer billed?",
                    "Customers are billed on the 10th of each month.",
                    ContextMemorySourceType.FILE_EXTRACTION,
                    ContextMemoryStatus.APPROVED)));

    ArgumentCaptor<ContextMemory> created = ArgumentCaptor.forClass(ContextMemory.class);
    verify(memoryRepository).create(isNull(), created.capture());
    assertEquals(ContextMemoryStatus.UNPROCESSED, created.getValue().getEntityStatus());
    verify(memoryRepository, never()).linkExtractedMemory(any(), any());
    verify(judge, never()).completeStructured(anyString(), anyString(), any());
  }

  /** An identical copy takes every memory of the original, with the decisions people made. */
  @Test
  void identicalReuseCarriesDecisionsAndWaitingMemories() {
    EntityReference original =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withName("original.md")
            .withType(Entity.CONTEXT_FILE);
    List<ContextMemory> memories =
        List.of(
            fileFact(
                original,
                "Q1",
                "A1",
                ContextMemorySourceType.FILE_EXTRACTION,
                ContextMemoryStatus.REJECTED),
            fileFact(
                original,
                "Q2",
                "A2",
                ContextMemorySourceType.FILE_EXTRACTION,
                ContextMemoryStatus.UNPROCESSED),
            fileFact(
                original,
                "Q3",
                "A3",
                ContextMemorySourceType.FILE_EXTRACTION,
                ContextMemoryStatus.APPROVED),
            fileFact(
                original,
                "Q4",
                "A4",
                ContextMemorySourceType.MANUAL,
                ContextMemoryStatus.APPROVED));
    when(memoryRepository.listExtractedMemories(original.getId(), Entity.CONTEXT_FILE))
        .thenReturn(memories);

    ContextMemoryReconciler.ReconcileResult result =
        new ContextMemoryReconciler(memoryRepository).reuseExtractedFrom(copy, original);

    assertEquals(new ContextMemoryReconciler.ReconcileResult(0, 0, 4, 0), result);
    memories.forEach(memory -> verify(memoryRepository).linkExtractedMemory(memory.getId(), copy));
    verify(memoryRepository, never()).create(any(), any());
    verify(memoryRepository, never()).updateIfCurrent(any(), any(), any(), any());
  }
}
