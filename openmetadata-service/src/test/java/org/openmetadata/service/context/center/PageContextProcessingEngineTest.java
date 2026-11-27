package org.openmetadata.service.context.center;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.ServiceUnavailableException;
import jakarta.ws.rs.WebApplicationException;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.apache.commons.codec.digest.DigestUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.api.context.ExtractionAvailability;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.data.ExtractionStats;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageProcessingStatus;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
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

  /** A failed article is queued again as its last editor, and its error goes with the failure. */
  @Test
  void aFailedArticleIsQueuedAndScheduledAfterTheQuietPeriod() {
    pageReturns(article(PageProcessingStatus.Failed, "stale-hash").withProcessingError("Boom"));
    long requestedAt = System.currentTimeMillis();

    Page queued = engine(available()).requestExtraction(pageId);

    Page stamped = capturedUpdates(EDITOR).getFirst();
    assertEquals(PageProcessingStatus.Queued, stamped.getProcessingStatus());
    assertNull(stamped.getProcessingError());
    assertEquals(PageProcessingStatus.Queued, queued.getProcessingStatus());
    assertTrue(scheduledRunAt() >= requestedAt + 5_000L, "the stamp restarts the quiet period");
  }

  /** Never queued, or edited while extraction was off: no run has read the current body. */
  @ParameterizedTest
  @NullSource
  @EnumSource(
      value = PageProcessingStatus.class,
      names = {"Processed"})
  void anArticleWhoseBodyWasNeverExtractedIsQueued(PageProcessingStatus status) {
    pageReturns(article(status, "hash-of-an-earlier-body"));

    engine(available()).requestExtraction(pageId);

    assertEquals(
        PageProcessingStatus.Queued, capturedUpdates(EDITOR).getFirst().getProcessingStatus());
    scheduledRunAt();
  }

  @ParameterizedTest
  @EnumSource(
      value = PageProcessingStatus.class,
      names = {"Queued", "Processing"})
  void anArticleAlreadyQueuedOrBeingExtractedIsRefused(PageProcessingStatus status) {
    pageReturns(article(status, "stale-hash"));

    assertRefused(ExtractionRequests.ALREADY_REQUESTED);
  }

  @Test
  void anArticleWhoseBodyWasExtractedIsRefused() {
    pageReturns(article(PageProcessingStatus.Processed, DigestUtils.sha256Hex(BODY)));

    assertRefused(ExtractionRequests.NOT_EXTRACTABLE);
  }

  @Test
  void aQuickLinkHasNoBodyToExtract() {
    pageReturns(page("", null).withPageType(PageType.QUICK_LINK));

    assertRefused(ExtractionRequests.NOT_EXTRACTABLE);
  }

  @ParameterizedTest
  @EnumSource(ExtractionAvailability.Reason.class)
  void aRequestWhileExtractionIsUnavailableWritesNothingAndSaysWhy(
      ExtractionAvailability.Reason reason) {
    PageContextProcessingEngine engine = engine(unavailable(reason));

    WebApplicationException refused =
        assertThrows(WebApplicationException.class, () -> engine.requestExtraction(pageId));

    assertEquals(409, refused.getResponse().getStatus());
    assertEquals("Memory extraction is unavailable: " + reason.value(), refused.getMessage());
    verifyNothingWritten();
  }

  /** Two requests read one Failed article: the stamp lets one through, and the other sees it. */
  @Test
  void aRequestThatLosesTheStampToAnotherIsRefused() {
    Page failed = article(PageProcessingStatus.Failed, "stale-hash");
    Page queuedByTheOther =
        JsonUtils.deepCopy(failed, Page.class).withProcessingStatus(PageProcessingStatus.Queued);
    when(pageRepository.get(isNull(), eq(pageId), any(), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(failed, queuedByTheOther);
    when(pageRepository.updateIfCurrent(isNull(), same(failed), any(), anyString()))
        .thenThrow(new PreconditionFailedException("Concurrent update"));
    PageContextProcessingEngine engine = engine(available());

    WebApplicationException refused =
        assertThrows(WebApplicationException.class, () -> engine.requestExtraction(pageId));

    assertEquals(ExtractionRequests.ALREADY_REQUESTED, refused.getMessage());
    verify(jobDao, never())
        .enqueuePageMemoryJob(
            anyString(), anyString(), anyString(), anyString(), anyLong(), anyLong());
  }

  /** A queue that cannot take the job leaves the article Failed rather than Queued, and 503s. */
  @Test
  void anArticleTheQueueCannotTakeIsLeftFailedToRetry() {
    queueRefusesTheJobOf(article(PageProcessingStatus.Failed, "stale-hash"));

    assertQueueRefused();

    List<Page> stamps = capturedUpdates(EDITOR);
    assertEquals(
        List.of(PageProcessingStatus.Queued, PageProcessingStatus.Failed),
        stamps.stream().map(Page::getProcessingStatus).toList());
    assertEquals(ExtractionRequests.QUEUE_FAILED, stamps.getLast().getProcessingError());
  }

  /** Recording the refusal gets more than one write budget: no job is left to record it later. */
  @Test
  void anArticleWhoseFailureLosesToContentionIsStillLeftFailed() {
    queueRefusesTheJobOf(article(PageProcessingStatus.Failed, "stale-hash"));
    AtomicInteger writes =
        writesThatLoseRaces(2, ContextProcessingEngine.MAX_CONDITIONAL_UPDATE_ATTEMPTS + 1);

    assertQueueRefused();

    assertEquals(ContextProcessingEngine.MAX_CONDITIONAL_UPDATE_ATTEMPTS + 2, writes.get());
    Page recorded = capturedUpdates(EDITOR).getLast();
    assertEquals(PageProcessingStatus.Failed, recorded.getProcessingStatus());
    assertEquals(ExtractionRequests.QUEUE_FAILED, recorded.getProcessingError());
  }

  /** A write's run the queue refuses leaves the article Failed to retry, not Queued with no job. */
  @Test
  void anArticleWhoseWrittenRunTheQueueRefusesIsLeftFailedToRetry() {
    Page queued = article(PageProcessingStatus.Queued, "stale-hash");
    when(pageRepository.get(isNull(), eq(pageId), any(), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(queued);
    refuseEveryJob();

    engine(available()).submit(pageId);

    Page recorded = capturedUpdates(EDITOR).getLast();
    assertEquals(PageProcessingStatus.Failed, recorded.getProcessingStatus());
    assertEquals(ExtractionRequests.QUEUE_FAILED, recorded.getProcessingError());
  }

  @Test
  void anArticleWhoseWrittenRunIsQueuedIsNotWritten() {
    engine(available()).submit(pageId);

    scheduledRunAt();
    verify(pageRepository, never()).updateIfCurrent(any(), any(), any(), anyString());
  }

  /** A failure no budget can record is still answered 503, never 500. */
  @Test
  void anArticleWhoseFailureCannotBeRecordedStillAnswers503() {
    queueRefusesTheJobOf(article(PageProcessingStatus.Failed, "stale-hash"));
    AtomicInteger writes = writesThatLoseRaces(2, Integer.MAX_VALUE);

    assertQueueRefused();

    assertEquals(
        1
            + ExtractionRequests.FAILURE_RECORD_ROUNDS
                * ContextProcessingEngine.MAX_CONDITIONAL_UPDATE_ATTEMPTS,
        writes.get());
  }

  /** The page reads Failed first, then as the request stamped it Queued. */
  private void queueRefusesTheJobOf(Page failed) {
    Page queued =
        JsonUtils.deepCopy(failed, Page.class).withProcessingStatus(PageProcessingStatus.Queued);
    when(pageRepository.get(isNull(), eq(pageId), any(), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(failed, queued);
    refuseEveryJob();
  }

  private void refuseEveryJob() {
    doThrow(new IllegalStateException("queue unavailable"))
        .when(jobDao)
        .enqueuePageMemoryJob(
            anyString(), anyString(), anyString(), anyString(), anyLong(), anyLong());
  }

  /** Counts page writes; those numbered {@code first} to {@code last} lose to a concurrent edit. */
  private AtomicInteger writesThatLoseRaces(int first, int last) {
    AtomicInteger writes = new AtomicInteger();
    when(pageRepository.updateIfCurrent(isNull(), any(), any(), anyString()))
        .thenAnswer(
            invocation -> {
              int write = writes.incrementAndGet();
              if (write >= first && write <= last) {
                throw new PreconditionFailedException("Concurrent edit");
              }
              return null;
            });
    return writes;
  }

  private void assertQueueRefused() {
    PageContextProcessingEngine engine = engine(available());

    ServiceUnavailableException refused =
        assertThrows(ServiceUnavailableException.class, () -> engine.requestExtraction(pageId));

    assertEquals(503, refused.getResponse().getStatus());
    assertEquals(ExtractionRequests.QUEUE_FAILED, refused.getMessage());
  }

  private static final String BODY = "Onboarding runbook body";
  private static final String EDITOR = "tomas";

  private Page article(PageProcessingStatus status, String extractedHash) {
    return page(BODY, extractedHash)
        .withPageType(PageType.ARTICLE)
        .withProcessingStatus(status)
        .withUpdatedBy(EDITOR);
  }

  private PageContextProcessingEngine engine(ExtractionAvailability availability) {
    return new PageContextProcessingEngine(
        pageRepository, extractor, reconciler, jobDao, 5_000L, () -> availability);
  }

  private static ExtractionAvailability available() {
    return new ExtractionAvailability().withAvailable(true);
  }

  private static ExtractionAvailability unavailable(ExtractionAvailability.Reason reason) {
    return new ExtractionAvailability().withAvailable(false).withReason(reason);
  }

  private long scheduledRunAt() {
    ArgumentCaptor<Long> runAt = ArgumentCaptor.forClass(Long.class);
    verify(jobDao)
        .enqueuePageMemoryJob(
            eq(pageId.toString()),
            eq(ContextMemoryExtractionJobHandler.Args.page(pageId).jobKey()),
            anyString(),
            eq(Entity.ADMIN_USER_NAME),
            runAt.capture(),
            anyLong());
    return runAt.getValue();
  }

  private void assertRefused(String message) {
    PageContextProcessingEngine engine = engine(available());

    WebApplicationException refused =
        assertThrows(WebApplicationException.class, () -> engine.requestExtraction(pageId));

    assertEquals(409, refused.getResponse().getStatus());
    assertEquals(message, refused.getMessage());
    verifyNothingWritten();
  }

  private void verifyNothingWritten() {
    verify(pageRepository, never()).updateIfCurrent(any(), any(), any(), anyString());
    verify(jobDao, never())
        .enqueuePageMemoryJob(
            anyString(), anyString(), anyString(), anyString(), anyLong(), anyLong());
  }

  private List<Page> capturedUpdates() {
    return capturedUpdates(Entity.ADMIN_USER_NAME);
  }

  private List<Page> capturedUpdates(String editor) {
    ArgumentCaptor<Page> captor = ArgumentCaptor.forClass(Page.class);
    verify(pageRepository, atLeastOnce())
        .updateIfCurrent(isNull(), any(), captor.capture(), eq(editor));
    return captor.getAllValues();
  }
}
