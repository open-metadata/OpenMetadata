package org.openmetadata.service.util;

import java.util.concurrent.ExecutorService;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class AsyncService {
  private static AsyncService instance;
  private ExecutorService executorService;

  private AsyncService() {
    executorService = ExecutorManager.getInstance().getVirtualThreadExecutor("async-service", null);
  }

  public static synchronized AsyncService getInstance() {
    if (instance == null) {
      instance = new AsyncService();
    }
    return instance;
  }

  public ExecutorService getExecutorService() {
    return executorService;
  }

  @Deprecated
  public void shutdown() {
    LOG.warn(
        "AsyncService.shutdown() called - executor shutdown is now managed by ExecutorManager");
  }
}
