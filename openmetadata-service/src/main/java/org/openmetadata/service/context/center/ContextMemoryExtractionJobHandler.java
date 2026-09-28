package org.openmetadata.service.context.center;

import java.util.UUID;
import java.util.function.Supplier;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContextFileRepository;
import org.openmetadata.service.jobs.BackgroundJobException;
import org.openmetadata.service.jobs.JobHandler;
import org.openmetadata.service.util.RequestEntityCache;

/** Runs article and uploaded-file memory extraction from the same persistent job queue. */
public class ContextMemoryExtractionJobHandler implements JobHandler {
  public record Args(String entityType, UUID sourceId, UUID contentId, String jobKey) {
    public static Args page(UUID pageId) {
      return new Args(Entity.PAGE, pageId, null, Entity.PAGE + ":" + pageId);
    }

    public static Args file(UUID fileId, UUID contentId) {
      return new Args(
          Entity.CONTEXT_FILE,
          fileId,
          contentId,
          Entity.CONTEXT_FILE + ":" + fileId + ":" + contentId);
    }
  }

  private final Supplier<PageContextProcessingEngine> pageEngineSupplier;
  private final Supplier<ContextFileProcessingService> fileServiceSupplier;

  public ContextMemoryExtractionJobHandler() {
    this(
        PageContextProcessingEngineHolder::get,
        () ->
            new ContextFileProcessingService(
                (ContextFileRepository) Entity.getEntityRepository(Entity.CONTEXT_FILE)));
  }

  ContextMemoryExtractionJobHandler(
      Supplier<PageContextProcessingEngine> pageEngineSupplier,
      Supplier<ContextFileProcessingService> fileServiceSupplier) {
    this.pageEngineSupplier = pageEngineSupplier;
    this.fileServiceSupplier = fileServiceSupplier;
  }

  @Override
  public void runJob(BackgroundJob job) throws BackgroundJobException {
    try {
      Args args = JsonUtils.convertValue(job.getJobArgs(), Args.class);
      if (args == null || args.sourceId() == null) {
        throw new IllegalArgumentException("sourceId is required");
      }
      RequestEntityCache.clear();
      if (Entity.PAGE.equals(args.entityType())) {
        pageEngineSupplier.get().runQueued(args.sourceId());
      } else if (Entity.CONTEXT_FILE.equals(args.entityType()) && args.contentId() != null) {
        fileServiceSupplier.get().runMemoryExtraction(args.sourceId(), args.contentId());
      } else {
        throw new IllegalArgumentException("Unsupported memory source or missing contentId");
      }
    } catch (RuntimeException e) {
      throw new BackgroundJobException(
          job.getId(), "Page memory extraction failed: " + e.getMessage(), e);
    } finally {
      RequestEntityCache.clear();
    }
  }

  @Override
  public boolean sendStatusToWebSocket() {
    return false;
  }
}
