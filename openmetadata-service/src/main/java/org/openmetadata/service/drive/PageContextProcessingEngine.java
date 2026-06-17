package org.openmetadata.service.drive;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.codec.digest.DigestUtils;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.data.ExtractionStats;
import org.openmetadata.schema.entity.data.Page;
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
      ContextMemoryExtractor extractor,
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
      ContextMemoryExtractor extractor,
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
      ContextMemoryExtractor extractor,
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
    ScheduledFuture<?> previous =
        pending.put(
            pageId,
            scheduler.schedule(
                () -> runScheduled(pageId), quietPeriodMillis, TimeUnit.MILLISECONDS));
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

  private void runScheduled(UUID pageId) {
    pending.remove(pageId);
    try {
      runExtraction(pageId);
    } catch (Exception e) {
      LOG.error("Knowledge pill extraction failed for page {}", pageId, e);
    }
  }

  @Override
  protected Source loadSource(UUID pageId) {
    Source source = null;
    Page page = getPage(pageId);
    if (page != null && page.getDescription() != null && !page.getDescription().isBlank()) {
      String body = page.getDescription();
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
