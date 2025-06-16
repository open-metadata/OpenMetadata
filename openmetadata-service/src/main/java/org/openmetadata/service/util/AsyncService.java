package org.openmetadata.service.util;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class AsyncService {
  private static AsyncService instance;
  private final ExecutorService executorService;

  private AsyncService() {
    executorService = Executors.newVirtualThreadPerTaskExecutor();
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

  // Optionally, provide a method to shut down the executor service
  public void shutdown() {
    executorService.shutdown();
  }
}
