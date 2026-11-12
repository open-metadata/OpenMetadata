package org.openmetadata.service.context.center;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doThrow;
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
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.KnowledgePageRepository;
import org.openmetadata.service.jobs.BackgroundJobTypes;
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
            eq(BackgroundJobTypes.CONTEXT_MEMORY_EXTRACTION),
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
  void failedDeferralProcessesTheCurrentPage() {
    String body = "Current body";
    pageReturns(page(body, DigestUtils.sha256Hex(body)).withUpdatedAt(System.currentTimeMillis()));
    doThrow(new IllegalStateException("queue unavailable"))
        .when(jobDao)
        .enqueuePageMemoryJob(
            anyString(), anyString(), anyString(), anyString(), anyLong(), anyLong());

    engine().runQueued(pageId);

    assertEquals(PageProcessingStatus.Processed, capturedUpdates().getLast().getProcessingStatus());
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

  @Test
  void anInterruptedArticleExtractionIsNotStampedFailed() {
    pageReturns(page("body", "stale-hash"));
    when(extractor.derive(eq("body"), any(), eq(ContextMemorySourceType.PAGE_EXTRACTION)))
        .thenAnswer(
            ignored -> {
              throw interruptedLlmCall();
            });

    try {
      assertThrows(LLMCompletionException.class, () -> engine().runQueued(pageId));
    } finally {
      Thread.interrupted();
    }

    assertEquals(
        List.of(PageProcessingStatus.Processing),
        capturedUpdates().stream().map(Page::getProcessingStatus).toList());
  }

  /** Fails as the LLM clients do when a stop interrupts them: flag re-set, interrupt as cause. */
  private static LLMCompletionException interruptedLlmCall() {
    Thread.currentThread().interrupt();
    return new LLMCompletionException(
        "Knowledge pill extraction failed for 1 of 1 chunks",
        new LLMCompletionException(
            "OpenAI completion was interrupted", new InterruptedException()));
  }

  /** Extraction bookkeeping must not make the article look last edited by admin. */
  @Test
  void extractionKeepsTheArticlesLastEditor() {
    pageReturns(page("body", "stale-hash").withUpdatedBy("tomas"));
    when(extractor.derive(eq("body"), any(), eq(ContextMemorySourceType.PAGE_EXTRACTION)))
        .thenThrow(new LLMCompletionException("LLM exploded"));

    assertThrows(LLMCompletionException.class, () -> engine().runQueued(pageId));

    verify(pageRepository, atLeastOnce()).updateIfCurrent(isNull(), any(), any(), eq("tomas"));
    verify(pageRepository, never())
        .updateIfCurrent(any(), any(), any(), eq(Entity.ADMIN_USER_NAME));
  }

  /** A finished extraction stamps its stats as bookkeeping too, keeping the article's editor. */
  @Test
  void aFinishedExtractionKeepsTheArticlesLastEditor() {
    String body = "Onboarding runbook body";
    pageReturns(page(body, "stale-hash").withUpdatedBy("tomas"));
    when(extractor.derive(eq(body), any(), eq(ContextMemorySourceType.PAGE_EXTRACTION)))
        .thenReturn(new DocumentMemoryExtractor.DeriveResult(List.<ContextMemory>of(), 1, 1));
    when(reconciler.reconcile(any(), eq(Entity.PAGE), any()))
        .thenReturn(new ContextMemoryReconciler.ReconcileResult(1, 0, 0, 0));

    engine().runQueued(pageId);

    ArgumentCaptor<Page> captor = ArgumentCaptor.forClass(Page.class);
    verify(pageRepository, atLeastOnce())
        .updateIfCurrent(isNull(), any(), captor.capture(), eq("tomas"));
    assertTrue(captor.getAllValues().stream().anyMatch(page -> page.getExtractionStats() != null));
    verify(pageRepository, never())
        .updateIfCurrent(any(), any(), any(), eq(Entity.ADMIN_USER_NAME));
  }

  @Test
  void statsContentionQueuesAnotherJobWithoutRepeatingDerivation() {
    pageReturns(page("body", "stale-hash"));
    when(extractor.derive(eq("body"), any(), eq(ContextMemorySourceType.PAGE_EXTRACTION)))
        .thenReturn(new DocumentMemoryExtractor.DeriveResult(List.of(), 1, 1));
    when(reconciler.reconcile(any(), eq(Entity.PAGE), any()))
        .thenReturn(new ContextMemoryReconciler.ReconcileResult(0, 0, 0, 0));
    when(pageRepository.updateIfCurrent(isNull(), any(), any(), anyString()))
        .thenAnswer(
            invocation -> {
              Page updated = invocation.getArgument(2);
              if (updated.getProcessingStatus() == PageProcessingStatus.Processed) {
                throw new PreconditionFailedException("Concurrent edit");
              }
              return null;
            });

    engine().runQueued(pageId);

    verify(jobDao)
        .enqueuePageMemoryJob(
            eq(pageId.toString()),
            eq(ContextMemoryExtractionJobHandler.Args.page(pageId).jobKey()),
            anyString(),
            eq(Entity.ADMIN_USER_NAME),
            anyLong(),
            anyLong());
    verify(extractor).derive(eq("body"), any(), eq(ContextMemorySourceType.PAGE_EXTRACTION));
    assertEquals(
        ContextProcessingEngine.MAX_CONDITIONAL_UPDATE_ATTEMPTS + 1, capturedUpdates().size());
  }

  @Test
  void failureStatusContentionQueuesAnotherJobAndKeepsTheOriginalFailure() {
    pageReturns(page("body", "stale-hash"));
    LLMCompletionException failure = new LLMCompletionException("Model unavailable");
    when(extractor.derive(eq("body"), any(), eq(ContextMemorySourceType.PAGE_EXTRACTION)))
        .thenThrow(failure);
    when(pageRepository.updateIfCurrent(isNull(), any(), any(), anyString()))
        .thenAnswer(
            invocation -> {
              Page updated = invocation.getArgument(2);
              if (updated.getProcessingStatus() == PageProcessingStatus.Failed) {
                throw new PreconditionFailedException("Concurrent edit");
              }
              return null;
            });

    assertSame(
        failure, assertThrows(LLMCompletionException.class, () -> engine().runQueued(pageId)));

    verify(jobDao)
        .enqueuePageMemoryJob(
            eq(pageId.toString()),
            eq(ContextMemoryExtractionJobHandler.Args.page(pageId).jobKey()),
            anyString(),
            eq(Entity.ADMIN_USER_NAME),
            anyLong(),
            anyLong());
    assertEquals(
        ContextProcessingEngine.MAX_CONDITIONAL_UPDATE_ATTEMPTS + 1, capturedUpdates().size());
  }

  private List<Page> capturedUpdates() {
    ArgumentCaptor<Page> captor = ArgumentCaptor.forClass(Page.class);
    verify(pageRepository, atLeastOnce())
        .updateIfCurrent(isNull(), any(), captor.capture(), eq(Entity.ADMIN_USER_NAME));
    return captor.getAllValues();
  }
}
