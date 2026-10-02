package org.openmetadata.service.context.center;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryScope;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;

@ExtendWith(MockitoExtension.class)
class ContextMemoryReconcilerTest {

  @Mock private ContextMemoryRepository memoryRepository;

  private final EntityReference source =
      new EntityReference().withId(UUID.randomUUID()).withName("page").withType(Entity.PAGE);

  private ContextMemory pill(
      String question, String answer, ContextMemorySourceType type, EntityStatus status) {
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
    return pill(question, answer, ContextMemorySourceType.PAGE_EXTRACTION, EntityStatus.APPROVED);
  }

  private void existing(ContextMemory... pills) {
    when(memoryRepository.listExtractedMemories(source.getId(), Entity.PAGE))
        .thenReturn(List.of(pills));
  }

  private ContextMemoryReconciler.ReconcileResult reconcile(List<ContextMemory> derived) {
    return new ContextMemoryReconciler(memoryRepository).reconcile(source, Entity.PAGE, derived);
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
            EntityStatus.APPROVED);
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
    verify(memoryRepository).update(isNull(), any(), captor.capture(), any());
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
            EntityStatus.APPROVED);
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
    existing(pill("Q1", "A1", ContextMemorySourceType.PAGE_EXTRACTION, EntityStatus.APPROVED));

    ContextMemoryReconciler.ReconcileResult result = reconcile(List.of(derived("Q1", "A1")));

    assertEquals(1, result.kept());
    assertEquals(0, result.created());
    verify(memoryRepository, never()).create(any(), any());
    verify(memoryRepository, never()).update(any(), any(), any(), any());
  }

  @Test
  void keepsUnchangedLegacyPillWithoutRewritingIt() {
    existing(pill("Q1", "A1", ContextMemorySourceType.PAGE_EXTRACTION, null));

    ContextMemoryReconciler.ReconcileResult result = reconcile(List.of(derived("Q1", "A1")));

    assertEquals(1, result.kept());
    verify(memoryRepository, never()).update(any(), any(), any(), any());
  }

  @Test
  void updatesPillInPlaceWhenAnswerChanges() {
    ContextMemory original =
        pill("Q1", "old", ContextMemorySourceType.PAGE_EXTRACTION, EntityStatus.APPROVED);
    existing(original);

    ContextMemoryReconciler.ReconcileResult result = reconcile(List.of(derived("Q1", "new")));

    assertEquals(1, result.updated());
    ArgumentCaptor<ContextMemory> captor = ArgumentCaptor.forClass(ContextMemory.class);
    verify(memoryRepository)
        .update(isNull(), eq(original), captor.capture(), eq(Entity.ADMIN_USER_NAME));
    assertEquals("new", captor.getValue().getAnswer());
    assertEquals(original.getId(), captor.getValue().getId(), "identity must be preserved");
  }

  @Test
  void deletesPillNoLongerDerived() {
    ContextMemory gone =
        pill("gone", "A", ContextMemorySourceType.PAGE_EXTRACTION, EntityStatus.APPROVED);
    existing(gone);

    ContextMemoryReconciler.ReconcileResult result = reconcile(List.of(derived("fresh", "A")));

    assertEquals(1, result.deleted());
    assertEquals(1, result.created());
    verify(memoryRepository).releaseExtractedMemory(gone.getId(), source);
    verify(memoryRepository, never()).update(any(), any(), any(), any());
  }

  @Test
  void neverTouchesManuallyEditedPillAndDoesNotDuplicateIt() {
    existing(pill("Q1", "human", ContextMemorySourceType.MANUAL, EntityStatus.APPROVED));

    ContextMemoryReconciler.ReconcileResult result =
        reconcile(List.of(derived("Q1", "llm answer"), derived("Q2", "A2")));

    verify(memoryRepository, never()).update(any(), any(), any(), any());
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
            EntityStatus.APPROVED);
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
        .update(isNull(), eq(original), captor.capture(), eq(Entity.ADMIN_USER_NAME));
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
            EntityStatus.APPROVED);
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
            EntityStatus.APPROVED);
    existing(shared);
    when(memoryRepository.hasOtherSources(shared.getId(), source)).thenReturn(true);

    ContextMemoryReconciler.ReconcileResult result =
        reconcile(
            List.of(derived("How long are events retained?", "Events are retained for 30 days.")));

    assertEquals(1, result.created());
    verify(memoryRepository).releaseExtractedMemory(shared.getId(), source);
    verify(memoryRepository, never()).update(any(), any(), any(), any());
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
            EntityStatus.APPROVED);
    when(memoryRepository.listExtractedMemories(original.getId(), Entity.CONTEXT_FILE))
        .thenReturn(List.of(memory));

    ContextMemoryReconciler.ReconcileResult result =
        new ContextMemoryReconciler(memoryRepository).reuseExtractedFrom(copy, original);

    assertEquals(1, result.kept());
    verify(memoryRepository).linkExtractedMemory(memory.getId(), copy);
    verify(memoryRepository, never()).create(any(), any());
  }

  @Test
  void identicalSourceReusesLegacyMemoryWithoutStoredStatus() {
    EntityReference original =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.CONTEXT_FILE);
    EntityReference copy =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.CONTEXT_FILE);
    ContextMemory legacy =
        pill(
            "What is the retention window?",
            "Events are retained for 90 days.",
            ContextMemorySourceType.FILE_EXTRACTION,
            null);
    when(memoryRepository.listExtractedMemories(original.getId(), Entity.CONTEXT_FILE))
        .thenReturn(List.of(legacy));

    ContextMemoryReconciler.ReconcileResult result =
        new ContextMemoryReconciler(memoryRepository).reuseExtractedFrom(copy, original);

    assertEquals(1, result.kept());
    verify(memoryRepository).linkExtractedMemory(legacy.getId(), copy);
  }

  @Test
  void rederivationRepairsLegacyPillVisibilityAndScope() {
    ContextMemory legacy =
        pill("Q", "A", ContextMemorySourceType.PAGE_EXTRACTION, EntityStatus.APPROVED);
    legacy.setMemoryScope(null);
    legacy.setPrimaryEntity(null);
    legacy.setShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.SHARED));
    existing(legacy);

    ContextMemoryReconciler.ReconcileResult result = reconcile(List.of(derived("Q", "A")));

    assertEquals(1, result.updated());
    ArgumentCaptor<ContextMemory> captor = ArgumentCaptor.forClass(ContextMemory.class);
    verify(memoryRepository)
        .update(isNull(), eq(legacy), captor.capture(), eq(Entity.ADMIN_USER_NAME));
    ContextMemory repaired = captor.getValue();
    assertEquals(ContextMemoryScope.ENTITY_SCOPED, repaired.getMemoryScope());
    assertEquals(source.getId(), repaired.getPrimaryEntity().getId());
    assertEquals(MemoryVisibility.ENTITY, repaired.getShareConfig().getVisibility());
  }
}
