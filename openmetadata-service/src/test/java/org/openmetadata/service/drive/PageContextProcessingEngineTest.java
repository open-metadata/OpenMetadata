package org.openmetadata.service.drive;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import org.apache.commons.codec.digest.DigestUtils;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.data.ExtractionStats;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageProcessingStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.KnowledgePageRepository;

@ExtendWith(MockitoExtension.class)
class PageContextProcessingEngineTest {

  @Mock private KnowledgePageRepository pageRepository;
  @Mock private ContextMemoryExtractor extractor;
  @Mock private ContextMemoryReconciler reconciler;
  @Mock private ScheduledExecutorService scheduler;

  private final UUID pageId = UUID.randomUUID();

  private PageContextProcessingEngine engine(int maxPending) {
    return new PageContextProcessingEngine(
        pageRepository, extractor, reconciler, 5_000L, maxPending, scheduler);
  }

  private Page page(String body, String extractedHash) {
    Page page = new Page().withId(pageId).withName("runbook").withDescription(body);
    if (extractedHash != null) {
      page.setExtractionStats(new ExtractionStats().withSourceHash(extractedHash));
    }
    return page;
  }

  private void pageReturns(Page page) {
    when(pageRepository.get(isNull(), eq(pageId), any(), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(page);
  }

  @Test
  void skipsExtractionWhenBodyHashUnchanged() {
    String body = "Onboarding runbook body";
    pageReturns(page(body, DigestUtils.sha256Hex(body)));

    ContextProcessingEngine.ExtractionOutcome outcome = engine(10).runExtraction(pageId);

    assertTrue(outcome.skipped());
    verify(extractor, never()).derive(any(), any(), any());
    verify(reconciler, never()).reconcile(any(), any(), any());
  }

  @Test
  void extractsWhenBodyHashChanged() {
    String body = "Onboarding runbook body";
    pageReturns(page(body, "stale-hash"));
    when(extractor.derive(eq(body), any(), eq(ContextMemorySourceType.PAGE_EXTRACTION)))
        .thenReturn(new ContextMemoryExtractor.DeriveResult(List.<ContextMemory>of(), 1, 1));
    when(reconciler.reconcile(any(), eq(Entity.PAGE), any()))
        .thenReturn(new ContextMemoryReconciler.ReconcileResult(1, 2, 3, 0));

    ContextProcessingEngine.ExtractionOutcome outcome = engine(10).runExtraction(pageId);

    assertFalse(outcome.skipped());
    assertEquals(
        1, outcome.stats().getPillsCreated(), "pillsCreated is created-only, not the active total");
    verify(extractor).derive(eq(body), any(), eq(ContextMemorySourceType.PAGE_EXTRACTION));
    verify(reconciler).reconcile(any(), eq(Entity.PAGE), any());
  }

  @Test
  void skipsBlankBodyThatWasNeverExtracted() {
    pageReturns(page("   ", null));

    ContextProcessingEngine.ExtractionOutcome outcome = engine(10).runExtraction(pageId);

    assertTrue(outcome.skipped());
    verify(extractor, never()).derive(any(), any(), any());
  }

  @Test
  void clearedBodyReconcilesToEmptyInsteadOfSkipping() {
    pageReturns(page("", "prior-content-hash"));
    when(extractor.derive(eq(""), any(), eq(ContextMemorySourceType.PAGE_EXTRACTION)))
        .thenReturn(new ContextMemoryExtractor.DeriveResult(List.<ContextMemory>of(), 0, 0));
    when(reconciler.reconcile(any(), eq(Entity.PAGE), any()))
        .thenReturn(new ContextMemoryReconciler.ReconcileResult(0, 0, 0, 2));

    ContextProcessingEngine.ExtractionOutcome outcome = engine(10).runExtraction(pageId);

    assertFalse(outcome.skipped());
    verify(extractor).derive(eq(""), any(), eq(ContextMemorySourceType.PAGE_EXTRACTION));
    verify(reconciler).reconcile(any(), eq(Entity.PAGE), any());
  }

  @Test
  void processedRunStampsProcessedStatus() {
    String body = "Onboarding runbook body";
    pageReturns(page(body, "stale-hash"));
    when(extractor.derive(eq(body), any(), eq(ContextMemorySourceType.PAGE_EXTRACTION)))
        .thenReturn(new ContextMemoryExtractor.DeriveResult(List.<ContextMemory>of(), 1, 1));
    when(reconciler.reconcile(any(), eq(Entity.PAGE), any()))
        .thenReturn(new ContextMemoryReconciler.ReconcileResult(1, 2, 3, 0));

    engine(10).runExtraction(pageId);

    Page stamped = capturedUpdate();
    assertEquals(PageProcessingStatus.Processed, stamped.getProcessingStatus());
    assertNull(stamped.getProcessingError());
  }

  @Test
  void failedRunStampsFailedStatusWithError() {
    String body = "Onboarding runbook body";
    pageReturns(page(body, "stale-hash"));
    when(extractor.derive(eq(body), any(), eq(ContextMemorySourceType.PAGE_EXTRACTION)))
        .thenThrow(new RuntimeException("LLM exploded"));
    ArgumentCaptor<Runnable> task = ArgumentCaptor.forClass(Runnable.class);
    doReturn(mock(ScheduledFuture.class))
        .when(scheduler)
        .schedule(task.capture(), anyLong(), any());
    PageContextProcessingEngine engine = engine(10);

    engine.schedule(pageId);
    task.getValue().run();

    Page stamped = capturedUpdate();
    assertEquals(PageProcessingStatus.Failed, stamped.getProcessingStatus());
    assertEquals("LLM exploded", stamped.getProcessingError());
  }

  @Test
  void skippedRunMarksQueuedPageProcessed() {
    String body = "Onboarding runbook body";
    Page page = page(body, DigestUtils.sha256Hex(body));
    page.setProcessingStatus(PageProcessingStatus.Queued);
    pageReturns(page);
    ArgumentCaptor<Runnable> task = ArgumentCaptor.forClass(Runnable.class);
    doReturn(mock(ScheduledFuture.class))
        .when(scheduler)
        .schedule(task.capture(), anyLong(), any());
    PageContextProcessingEngine engine = engine(10);

    engine.schedule(pageId);
    task.getValue().run();

    assertEquals(PageProcessingStatus.Processed, capturedUpdate().getProcessingStatus());
    verify(extractor, never()).derive(any(), any(), any());
  }

  private Page capturedUpdate() {
    ArgumentCaptor<Page> captor = ArgumentCaptor.forClass(Page.class);
    verify(pageRepository).update(isNull(), any(), captor.capture(), eq(Entity.ADMIN_USER_NAME));
    return captor.getValue();
  }

  @Test
  void rescheduleCancelsThePreviousPendingRun() {
    ScheduledFuture<?> first = mock(ScheduledFuture.class);
    ScheduledFuture<?> second = mock(ScheduledFuture.class);
    doReturn(first, second).when(scheduler).schedule(any(Runnable.class), anyLong(), any());
    PageContextProcessingEngine engine = engine(100);

    engine.schedule(pageId);
    engine.schedule(pageId);

    verify(first).cancel(false);
  }

  @Test
  void evictsAPendingPageWhenThrottleIsFull() {
    ScheduledFuture<?> first = mock(ScheduledFuture.class);
    ScheduledFuture<?> second = mock(ScheduledFuture.class);
    doReturn(first, second).when(scheduler).schedule(any(Runnable.class), anyLong(), any());
    PageContextProcessingEngine engine = engine(1);

    engine.schedule(pageId);
    engine.schedule(UUID.randomUUID());

    verify(first).cancel(false);
  }
}
