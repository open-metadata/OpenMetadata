package org.openmetadata.service.drive;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.codec.digest.DigestUtils;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.data.ExtractionStats;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageProcessingStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.KnowledgePageRepository;

/**
 * {@link ContextProcessingEngine} for Page (Knowledge Center article) sources. A page's markdown
 * body is its text, so there is no text-extraction stage. Because pages autosave every few seconds,
 * extraction is debounced through an in-memory, per-page trailing throttle: each body change
 * (re)schedules a run {@code quietPeriodMillis} after the last edit, so an entire editing session
 * yields a single extraction. The hash gate makes a run a no-op when the body is unchanged, so a
 * throttle entry lost on restart is recovered by the next edit — no sweep, no extra process.
 */
@Slf4j
public class PageContextProcessingEngine extends ContextProcessingEngine {
  static final long DEFAULT_QUIET_PERIOD_MILLIS = TimeUnit.MINUTES.toMillis(5);
  static final int DEFAULT_MAX_PENDING_PAGES = 10_000;

  private final KnowledgePageRepository pageRepository;
  private final long quietPeriodMillis;
  private final int maxPendingPages;
  private final ScheduledExecutorService scheduler;
  private final Map<UUID, ScheduledFuture<?>> pending = new ConcurrentHashMap<>();

  public PageContextProcessingEngine(
      KnowledgePageRepository pageRepository,
      DocumentMemoryExtractor extractor,
      ContextMemoryReconciler reconciler) {
    this(
        pageRepository,
        extractor,
        reconciler,
        DEFAULT_QUIET_PERIOD_MILLIS,
        DEFAULT_MAX_PENDING_PAGES);
  }

  public PageContextProcessingEngine(
      KnowledgePageRepository pageRepository,
      DocumentMemoryExtractor extractor,
      ContextMemoryReconciler reconciler,
      long quietPeriodMillis,
      int maxPendingPages) {
    this(
        pageRepository,
        extractor,
        reconciler,
        quietPeriodMillis,
        maxPendingPages,
        defaultScheduler());
  }

  PageContextProcessingEngine(
      KnowledgePageRepository pageRepository,
      DocumentMemoryExtractor extractor,
      ContextMemoryReconciler reconciler,
      long quietPeriodMillis,
      int maxPendingPages,
      ScheduledExecutorService scheduler) {
    super(extractor, reconciler);
    this.pageRepository = pageRepository;
    this.quietPeriodMillis = quietPeriodMillis;
    this.maxPendingPages = maxPendingPages;
    this.scheduler = scheduler;
  }

  private static ScheduledExecutorService defaultScheduler() {
    return Executors.newSingleThreadScheduledExecutor(
        runnable -> {
          Thread thread = new Thread(runnable, "page-context-extraction");
          thread.setDaemon(true);
          return thread;
        });
  }

  /**
   * (Re)schedules extraction for a page after the quiet period, cancelling any pending run so a
   * burst of autosaves collapses into one. Bounded: when too many pages are already pending, one is
   * dropped with a warning (its next edit re-arms it, and the hash gate keeps the eventual run
   * correct).
   */
  public void schedule(UUID pageId) {
    evictIfFull();
    AtomicReference<ScheduledFuture<?>> holder = new AtomicReference<>();
    holder.set(
        scheduler.schedule(
            () -> runScheduled(pageId, holder.get()), quietPeriodMillis, TimeUnit.MILLISECONDS));
    ScheduledFuture<?> previous = pending.put(pageId, holder.get());
    if (previous != null) {
      previous.cancel(false);
    }
  }

  /** Cancels a pending run, e.g. when the page is deleted. */
  public void cancel(UUID pageId) {
    ScheduledFuture<?> previous = pending.remove(pageId);
    if (previous != null) {
      previous.cancel(false);
    }
  }

  private void evictIfFull() {
    // Best-effort bound: size() and the caller's put() are not atomic, so concurrent schedulers can
    // briefly push pending past maxPendingPages by the number of in-flight callers. The dropped
    // entry is whatever the hash order yields first rather than the least-recent; at the (large)
    // default cap that is acceptable — a dropped page re-arms on its next edit and the hash gate
    // keeps the eventual run correct.
    if (pending.size() >= maxPendingPages) {
      UUID dropped = pending.keySet().stream().findFirst().orElse(null);
      if (dropped != null) {
        cancel(dropped);
        LOG.warn(
            "Page extraction throttle is full ({} pending); dropped page {}. It re-arms on its next edit.",
            maxPendingPages,
            dropped);
      }
    }
  }

  private void runScheduled(UUID pageId, ScheduledFuture<?> firedFuture) {
    // Only clear the entry if it is still the future that just fired. A concurrent schedule() may
    // have already installed a newer future for this page, which must stay tracked so a later
    // cancel() (e.g. on delete) can reach it.
    pending.remove(pageId, firedFuture);
    try {
      ExtractionOutcome outcome = runExtraction(pageId);
      if (outcome.skipped()) {
        stampStatus(pageId, PageProcessingStatus.Processed, null);
      }
    } catch (Exception e) {
      LOG.error("Knowledge pill extraction failed for page {}", pageId, e);
      stampStatus(pageId, PageProcessingStatus.Failed, e.getMessage());
    }
  }

  /**
   * Persists a terminal processing status from the scheduler thread (post-commit, so it never races
   * the body edit that armed the run) for the paths the pipeline does not stamp itself: a skip
   * (content unchanged since the last run) and a failure. The success path stamps {@link
   * PageProcessingStatus#Processed} through {@link #stampStats} alongside the run's stats. A no-op
   * when the page already carries the target status, so an unchanged-content skip does not churn the
   * row.
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

  private Page getPage(UUID pageId) {
    Page result = null;
    try {
      result =
          pageRepository.get(
              null, pageId, pageRepository.getFields(""), Include.NON_DELETED, false);
    } catch (EntityNotFoundException e) {
      result = null;
    }
    return result;
  }
}
