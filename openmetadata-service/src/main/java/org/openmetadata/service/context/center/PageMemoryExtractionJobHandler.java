package org.openmetadata.service.context.center;

import java.util.UUID;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jobs.BackgroundJobException;
import org.openmetadata.service.jobs.JobHandler;
import org.openmetadata.service.util.RequestEntityCache;

/** Runs delayed page memory extraction from the persistent background job queue. */
public class PageMemoryExtractionJobHandler implements JobHandler {
  public record Args(UUID pageId) {}

  @Override
  public void runJob(BackgroundJob job) throws BackgroundJobException {
    try {
      Args args = JsonUtils.convertValue(job.getJobArgs(), Args.class);
      if (args == null || args.pageId() == null) {
        throw new IllegalArgumentException("pageId is required");
      }
      RequestEntityCache.clear();
      PageContextProcessingEngineHolder.get().runQueued(args.pageId());
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
