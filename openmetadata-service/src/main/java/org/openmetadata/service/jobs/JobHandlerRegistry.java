package org.openmetadata.service.jobs;

import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class JobHandlerRegistry {
  private final Map<String, JobHandler> handlers = new HashMap<>();

  public void register(String methodName, JobHandler handler) {
    LOG.info("Registering background job handler for: {}", handler.getClass().getSimpleName());
    handlers.put(methodName, handler);
  }

  public JobHandler getHandler(String methodName) {
    JobHandler handler = handlers.get(methodName);
    if (handler == null) {
      throw new IllegalArgumentException("No handler registered for " + methodName);
    }
    return handler;
  }
}
