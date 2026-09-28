package org.openmetadata.service.context.center;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.apache.commons.codec.digest.DigestUtils;
import org.junit.jupiter.api.BeforeEach;
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
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.KnowledgePageRepository;
import org.openmetadata.service.jobs.JobDAO;
import org.openmetadata.service.llm.LLMCompletionException;
import org.openmetadata.service.util.EntityUtil;

@ExtendWith(MockitoExtension.class)
class PageContextProcessingEngineTest {
  @Mock private KnowledgePageRepository pageRepository;
  @Mock private ContextMemoryExtractor extractor;
  @Mock private ContextMemoryReconciler reconciler;
  @Mock private JobDAO jobDao;

  private final UUID pageId = UUID.randomUUID();
  private final EntityUtil.Fields putFields =
      new EntityUtil.Fields(Set.of("relatedEntities"), "relatedEntities");

  private PageContextProcessingEngine engine() {
    return new PageContextProcessingEngine(pageRepository, extractor, reconciler, jobDao, 5_000L);
  }

  private Page page(String body, String extractedHash) {
    Page page =
        new Page()
            .withId(pageId)
            .withName("runbook")
            .withDescription(body)
            .withUpdatedAt(System.currentTimeMillis() - 10_000L);
    if (extractedHash != null) {
      page.setExtractionStats(new ExtractionStats().withSourceHash(extractedHash));
    }
    return page;
  }

  private void pageReturns(Page page) {
    when(pageRepository.get(isNull(), eq(pageId), any(), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(page);
  }

  @BeforeEach
  void stubPutFields() {
    org.mockito.Mockito.lenient().when(pageRepository.getPutFields()).thenReturn(putFields);
  }

  @Test
  void schedulesAPersistentDelayedJob() {
    engine().schedule(pageId);

    verify(jobDao)
        .enqueuePageMemoryJob(
            eq(pageId.toString()),
            eq(ContextMemoryExtractionJobHandler.Args.page(pageId).jobKey()),
            anyString(),
            eq(Entity.ADMIN_USER_NAME),
            anyLong(),
            anyLong());
  }

  @Test
  void deletionCancelsThePendingPageJob() {
    engine().cancel(pageId);

    verify(jobDao)
        .cancelPendingPageMemoryJobs(
            eq(BackgroundJob.JobType.CONTEXT_MEMORY_EXTRACTION.name()),
            eq(ContextMemoryExtractionJobHandler.class.getSimpleName()),
            eq(ContextMemoryExtractionJobHandler.Args.page(pageId).jobKey()),
            anyLong());
  }

  @Test
  void jobClaimedDuringAnEditWaitsForTheNewQuietPeriod() {
    pageReturns(page("new body", null).withUpdatedAt(System.currentTimeMillis()));

    engine().runQueued(pageId);

    verify(extractor, never()).derive(any(), any(), any());
    verify(jobDao)
        .enqueuePageMemoryJob(
            eq(pageId.toString()),
            eq(ContextMemoryExtractionJobHandler.Args.page(pageId).jobKey()),
            anyString(),
            eq(Entity.ADMIN_USER_NAME),
            anyLong(),
            anyLong());
  }

  @Test
  void skipsExtractionWhenBodyHashUnchanged() {
    String body = "Onboarding runbook body";
    pageReturns(page(body, DigestUtils.sha256Hex(body)));

    assertTrue(engine().runExtraction(pageId).skipped());
    verify(extractor, never()).derive(any(), any(), any());
  }

  @Test
  void extractsWhenBodyHashChanged() {
    String body = "Onboarding runbook body";
    pageReturns(page(body, "stale-hash"));
    when(extractor.derive(eq(body), any(), eq(ContextMemorySourceType.PAGE_EXTRACTION)))
        .thenReturn(new DocumentMemoryExtractor.DeriveResult(List.<ContextMemory>of(), 1, 1));
    when(reconciler.reconcile(any(), eq(Entity.PAGE), any()))
        .thenReturn(new ContextMemoryReconciler.ReconcileResult(1, 2, 3, 0));

    ContextProcessingEngine.ExtractionOutcome outcome = engine().runExtraction(pageId);

    assertFalse(outcome.skipped());
    assertEquals(1, outcome.stats().getPillsCreated());
    verify(reconciler).reconcile(any(), eq(Entity.PAGE), any());
  }

  @Test
  void incompleteDerivationDoesNotReconcileOrStampSuccess() {
    pageReturns(page("body", "stale-hash"));
    when(extractor.derive(eq("body"), any(), eq(ContextMemorySourceType.PAGE_EXTRACTION)))
        .thenReturn(new DocumentMemoryExtractor.DeriveResult(List.of(), 2, 1));

    assertThrows(LLMCompletionException.class, () -> engine().runExtraction(pageId));

    verify(reconciler, never()).reconcile(any(), any(), any());
    assertEquals(
        PageProcessingStatus.Processing, capturedUpdates().getLast().getProcessingStatus());
  }

  @Test
  void clearedBodyReconcilesToEmpty() {
    pageReturns(page("", "prior-content-hash"));
    when(extractor.derive(eq(""), any(), eq(ContextMemorySourceType.PAGE_EXTRACTION)))
        .thenReturn(new DocumentMemoryExtractor.DeriveResult(List.of(), 0, 0));
    when(reconciler.reconcile(any(), eq(Entity.PAGE), any()))
        .thenReturn(new ContextMemoryReconciler.ReconcileResult(0, 0, 0, 2));

    assertFalse(engine().runExtraction(pageId).skipped());
  }

  @Test
  void queuedFailureStampsFailedStatus() {
    pageReturns(page("body", "stale-hash"));
    when(extractor.derive(eq("body"), any(), eq(ContextMemorySourceType.PAGE_EXTRACTION)))
        .thenThrow(new LLMCompletionException("LLM exploded"));

    assertThrows(LLMCompletionException.class, () -> engine().runQueued(pageId));

    Page stamped = capturedUpdates().getLast();
    assertEquals(PageProcessingStatus.Failed, stamped.getProcessingStatus());
    assertEquals("LLM exploded", stamped.getProcessingError());
  }

  private List<Page> capturedUpdates() {
    ArgumentCaptor<Page> captor = ArgumentCaptor.forClass(Page.class);
    verify(pageRepository, atLeastOnce())
        .update(isNull(), any(), captor.capture(), eq(Entity.ADMIN_USER_NAME));
    return captor.getAllValues();
  }
}
