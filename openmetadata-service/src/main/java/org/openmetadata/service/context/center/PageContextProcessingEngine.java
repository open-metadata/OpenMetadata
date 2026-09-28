package org.openmetadata.service.context.center;

import java.util.UUID;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.codec.digest.DigestUtils;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.data.ExtractionStats;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageProcessingStatus;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.KnowledgePageRepository;
import org.openmetadata.service.jobs.JobDAO;

/**
 * {@link ContextProcessingEngine} for Page (Knowledge Center article) sources. A page's markdown
 * body is its text, so there is no text-extraction stage. Delayed jobs in {@code background_jobs}
 * coalesce autosaves and survive server restarts. The source hash still prevents redundant LLM
 * calls when an already-processed page is queued twice.
 */
@Slf4j
public class PageContextProcessingEngine extends ContextProcessingEngine {
  static final long DEFAULT_QUIET_PERIOD_MILLIS = TimeUnit.MINUTES.toMillis(5);

  private final KnowledgePageRepository pageRepository;
  private final JobDAO jobDao;
  private final long quietPeriodMillis;

  public PageContextProcessingEngine(
      KnowledgePageRepository pageRepository,
      DocumentMemoryExtractor extractor,
      ContextMemoryReconciler reconciler,
      JobDAO jobDao) {
    this(pageRepository, extractor, reconciler, jobDao, DEFAULT_QUIET_PERIOD_MILLIS);
  }

  public PageContextProcessingEngine(
      KnowledgePageRepository pageRepository,
      DocumentMemoryExtractor extractor,
      ContextMemoryReconciler reconciler,
      JobDAO jobDao,
      long quietPeriodMillis) {
    super(extractor, reconciler);
    this.pageRepository = pageRepository;
    this.jobDao = jobDao;
    this.quietPeriodMillis = quietPeriodMillis;
  }

  /**
   * Coalesces pending page jobs in the database. A body edit while a job is RUNNING inserts another
   * PENDING job, so the later content cannot be lost when the first run stamps its old source hash.
   */
  public void schedule(UUID pageId) {
    scheduleAt(pageId, System.currentTimeMillis() + quietPeriodMillis);
  }

  private void scheduleAt(UUID pageId, long runAt) {
    long now = System.currentTimeMillis();
    ContextMemoryExtractionJobHandler.Args jobArgs =
        ContextMemoryExtractionJobHandler.Args.page(pageId);
    jobDao.enqueuePageMemoryJob(
        pageId.toString(),
        jobArgs.jobKey(),
        JsonUtils.pojoToJson(jobArgs),
        Entity.ADMIN_USER_NAME,
        runAt,
        now);
  }

  /** Cancels work whose source has been deleted. A claimed job will skip the missing page. */
  public void cancel(UUID pageId) {
    jobDao.cancelPendingPageMemoryJobs(
        BackgroundJob.JobType.CONTEXT_MEMORY_EXTRACTION.name(),
        ContextMemoryExtractionJobHandler.class.getSimpleName(),
        ContextMemoryExtractionJobHandler.Args.page(pageId).jobKey(),
        System.currentTimeMillis());
  }

  /** Called by the persistent background worker once a delayed job is due. */
  public void runQueued(UUID pageId) {
    try {
      Page page = getPage(pageId);
      if (page == null) {
        return;
      }
      long quietUntil = page.getUpdatedAt() == null ? 0L : page.getUpdatedAt() + quietPeriodMillis;
      if (System.currentTimeMillis() < quietUntil) {
        scheduleAt(pageId, quietUntil);
        return;
      }
      ExtractionOutcome outcome = runExtraction(pageId);
      if (outcome.skipped()) {
        stampStatus(pageId, PageProcessingStatus.Processed, null);
      }
    } catch (RuntimeException e) {
      LOG.error("Knowledge pill extraction failed for page {}", pageId, e);
      stampStatus(pageId, PageProcessingStatus.Failed, e.getMessage());
      throw e;
    }
  }

  /**
   * Persists a processing status from the worker thread (post-commit, so it never races the body
   * edit that armed the run) for the paths the pipeline does not stamp itself: the start of a run
   * ({@link PageProcessingStatus#Processing}), a skip (content unchanged since the last run) and a
   * failure. The success path stamps {@link PageProcessingStatus#Processed} through {@link
   * #stampStats} alongside the run's stats. A no-op when the page already carries the target status,
   * so an unchanged-content skip does not churn the row.
   */
  private void stampStatus(UUID pageId, PageProcessingStatus status, String error) {
    Page current = getPage(pageId);
    if (current != null && current.getProcessingStatus() != status) {
      Page updated = JsonUtils.deepCopy(current, Page.class);
      updated.setProcessingStatus(status);
      updated.setProcessingError(error);
      pageRepository.update(null, current, updated, Entity.ADMIN_USER_NAME);
    }
  }

  /**
   * An article's status is shown in the UI, and the job's quiet period means it would otherwise
   * read {@link PageProcessingStatus#Queued} for minutes and then jump straight to Processed — with
   * no way to tell a run in flight from one still waiting. Stamped only once the hash gate has
   * decided there is work to do, so it costs one extra write per real run and none per skip.
   */
  @Override
  protected void markProcessing(UUID pageId) {
    stampStatus(pageId, PageProcessingStatus.Processing, null);
  }

  @Override
  protected Source loadSource(UUID pageId) {
    Source source = null;
    Page page = getPage(pageId);
    if (page != null) {
      // Return a source even for an empty body so a cleared article reconciles to an empty pill
      // set (archiving its stale pills); null is reserved for a page that no longer exists.
      String body = page.getDescription() == null ? "" : page.getDescription();
      source = new Source(body, DigestUtils.sha256Hex(body), page.getEntityReference());
    }
    return source;
  }

  @Override
  protected ExtractionStats loadStats(UUID pageId) {
    Page page = getPage(pageId);
    return page == null ? null : page.getExtractionStats();
  }

  @Override
  protected void stampStats(UUID pageId, ExtractionStats stats) {
    Page current = getPage(pageId);
    if (current != null) {
      Page updated = JsonUtils.deepCopy(current, Page.class);
      updated.setExtractionStats(stats);
      updated.setProcessingStatus(PageProcessingStatus.Processed);
      updated.setProcessingError(null);
      pageRepository.update(null, current, updated, Entity.ADMIN_USER_NAME);
    }
  }

  @Override
  protected String entityType() {
    return Entity.PAGE;
  }

  @Override
  protected ContextMemorySourceType sourceType() {
    return ContextMemorySourceType.PAGE_EXTRACTION;
  }

  /**
   * Loads the page with the fields its own updater manages. Fetching with {@code getFields("")}
   * leaves the relationship-backed fields (relatedEntities, parent, children) null, and the updater
   * reads a null managed field as a removal — so every stamp below silently deleted the article's
   * related data assets and bumped its version. Loading them here makes the stamp a true read-
   * modify-write.
   */
  private Page getPage(UUID pageId) {
    Page result = null;
    try {
      result =
          pageRepository.get(
              null, pageId, pageRepository.getPutFields(), Include.NON_DELETED, false);
    } catch (EntityNotFoundException e) {
      result = null;
    }
    return result;
  }
}
