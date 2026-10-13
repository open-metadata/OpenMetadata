package org.openmetadata.service.context.center;

import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.jdbi3.KnowledgePageRepository;

/**
 * Process-wide holder of the page processing engine. The repository post-update hook and the
 * background job handler reach the same service through here. Lazily built on first use so it
 * picks up the registered repositories and initialized LLM client.
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
      DocumentMemoryExtractor extractor = AiProviderHolder.get().documentExtractor();
      ContextMemoryReconciler reconciler = new ContextMemoryReconciler(memoryRepository);
      long quietPeriodMillis =
          Long.getLong(
              "page.context.quiet.period.millis",
              PageContextProcessingEngine.DEFAULT_QUIET_PERIOD_MILLIS);
      instance =
          new PageContextProcessingEngine(
              pageRepository, extractor, reconciler, Entity.getJobDAO(), quietPeriodMillis);
    }
    return instance;
  }

  public static void setForTesting(PageContextProcessingEngine engine) {
    instance = engine;
  }
}
