package org.openmetadata.service.drive;

import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.jdbi3.KnowledgePageRepository;
import org.openmetadata.service.llm.LLMClientHolder;

/**
 * Process-wide holder of the single {@link PageContextProcessingEngine}. The engine owns an
 * in-memory throttle (a scheduler + per-page timers), so it must be a singleton — the repository
 * post-update hook reaches it through here. Lazily built on first use so it picks up the registered
 * repositories and the initialized LLM client; {@link #setForTesting} is the test seam.
 */
public final class PageContextProcessingEngineHolder {
  private static volatile PageContextProcessingEngine instance;

  private PageContextProcessingEngineHolder() {}

  public static PageContextProcessingEngine get() {
    PageContextProcessingEngine engine = instance;
    if (engine == null) {
      engine = build();
    }
    return engine;
  }

  private static synchronized PageContextProcessingEngine build() {
    if (instance == null) {
      ContextMemoryRepository memoryRepository =
          (ContextMemoryRepository) Entity.getEntityRepository(Entity.CONTEXT_MEMORY);
      KnowledgePageRepository pageRepository =
          (KnowledgePageRepository) Entity.getEntityRepository(Entity.PAGE);
      ContextMemoryExtractor extractor = new ContextMemoryExtractor(LLMClientHolder.get());
      ContextMemoryReconciler reconciler = new ContextMemoryReconciler(memoryRepository);
      long quietPeriodMillis =
          Long.getLong(
              "page.context.quiet.period.millis",
              PageContextProcessingEngine.DEFAULT_QUIET_PERIOD_MILLIS);
      int maxPendingPages =
          Integer.getInteger(
              "page.context.max.pending.pages",
              PageContextProcessingEngine.DEFAULT_MAX_PENDING_PAGES);
      instance =
          new PageContextProcessingEngine(
              pageRepository, extractor, reconciler, quietPeriodMillis, maxPendingPages);
    }
    return instance;
  }

  public static void setForTesting(PageContextProcessingEngine engine) {
    instance = engine;
  }
}
