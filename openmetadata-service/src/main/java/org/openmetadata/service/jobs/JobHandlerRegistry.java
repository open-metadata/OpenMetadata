package org.openmetadata.service.jobs;

import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.jobs.BackgroundJob;

@Slf4j
public class JobHandlerRegistry {
  private static final JobHandlerRegistry INSTANCE = new JobHandlerRegistry();
  private final Map<String, BackgroundJobHandler> handlers = new HashMap<>();

  public static JobHandlerRegistry getInstance() {
    return INSTANCE;
  }

  public void register(String methodName, BackgroundJobHandler handler) {
    LOG.info("Registering background job handler for: {}", handler.getClass().getSimpleName());
    handlers.put(methodName, handler);
  }

  public BackgroundJobHandler getHandler(BackgroundJob job) {
    String methodName = job.getMethodName();
    Long jobId = job.getId();
    BackgroundJobHandler handler = handlers.get(methodName);
    if (handler == null) {
      throw new BackgroundJobException(jobId, "No handler registered for " + methodName);
    }
    return handler;
  }

  public BackgroundJobHandler getHandler(String handlerName) {
    BackgroundJobHandler handler = handlers.get(handlerName);
    if (handler == null) {
      throw new IllegalArgumentException("Handler not found for " + handlerName);
    }
    return handler;
  }
}
