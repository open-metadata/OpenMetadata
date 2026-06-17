package org.openmetadata.service.drive;

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
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;

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
        .withSourceType(type)
        .withStatus(status);
  }

  private ContextMemory derived(String question, String answer) {
    return pill(
        question, answer, ContextMemorySourceType.PAGE_EXTRACTION, ContextMemoryStatus.ACTIVE);
  }

  private void existing(ContextMemory... pills) {
    when(memoryRepository.listExtractedMemories(source.getId(), Entity.PAGE))
        .thenReturn(List.of(pills));
  }

  private ContextMemoryReconciler.ReconcileResult reconcile(List<ContextMemory> derived) {
    return new ContextMemoryReconciler(memoryRepository).reconcile(source, Entity.PAGE, derived);
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
    existing(pill("Q1", "A1", ContextMemorySourceType.PAGE_EXTRACTION, ContextMemoryStatus.ACTIVE));

    ContextMemoryReconciler.ReconcileResult result = reconcile(List.of(derived("Q1", "A1")));

    assertEquals(1, result.kept());
    assertEquals(0, result.created());
    verify(memoryRepository, never()).create(any(), any());
    verify(memoryRepository, never()).update(any(), any(), any(), any());
  }

  @Test
  void updatesPillInPlaceWhenAnswerChanges() {
    ContextMemory original =
        pill("Q1", "old", ContextMemorySourceType.PAGE_EXTRACTION, ContextMemoryStatus.ACTIVE);
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
  void archivesPillNoLongerDerived() {
    ContextMemory gone =
        pill("gone", "A", ContextMemorySourceType.PAGE_EXTRACTION, ContextMemoryStatus.ACTIVE);
    existing(gone);

    ContextMemoryReconciler.ReconcileResult result = reconcile(List.of(derived("fresh", "A")));

    assertEquals(1, result.archived());
    assertEquals(1, result.created());
    ArgumentCaptor<ContextMemory> captor = ArgumentCaptor.forClass(ContextMemory.class);
    verify(memoryRepository)
        .update(isNull(), eq(gone), captor.capture(), eq(Entity.ADMIN_USER_NAME));
    assertEquals(ContextMemoryStatus.ARCHIVED, captor.getValue().getStatus());
  }

  @Test
  void neverTouchesManuallyEditedPillAndDoesNotDuplicateIt() {
    existing(pill("Q1", "human", ContextMemorySourceType.MANUAL, ContextMemoryStatus.ACTIVE));

    ContextMemoryReconciler.ReconcileResult result =
        reconcile(List.of(derived("Q1", "llm answer"), derived("Q2", "A2")));

    verify(memoryRepository, never()).update(any(), any(), any(), any());
    ArgumentCaptor<ContextMemory> captor = ArgumentCaptor.forClass(ContextMemory.class);
    verify(memoryRepository, times(1)).create(isNull(), captor.capture());
    assertEquals("Q2", captor.getValue().getQuestion(), "Q1 is owned by the manual pill");
    assertEquals(1, result.created());
  }
}
