package org.openmetadata.service.jobs;

import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.jobs.BackgroundJob;

@Slf4j
public class JobHandlerRegistry {
  private final Map<String, JobHandler> handlers = new HashMap<>();

  public void register(String methodName, JobHandler handler) {
    LOG.info(
        "Registering background job handler for: {} -> {}",
        handler.getClass().getSimpleName(),
        handler.getClass().getCanonicalName());
    handlers.put(methodName, handler);
  }

  public void register(JobHandler handler) {
    register(handler.getClass().getSimpleName(), handler);
  }

  public JobHandler getHandler(BackgroundJob job) {
    String methodName = job.getMethodName();
    Long jobId = job.getId();
    JobHandler handler = handlers.get(methodName);
    if (handler == null) {
      throw new BackgroundJobException(jobId, "No handler registered for " + methodName);
    }
    return handler;
  }
}
