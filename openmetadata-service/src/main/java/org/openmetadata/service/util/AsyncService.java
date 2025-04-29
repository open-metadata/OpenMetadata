package org.openmetadata.service.util;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.atomic.AtomicInteger;

public class AsyncService {
  private static AsyncService instance;
  private final ExecutorService executorService;

  private AsyncService() {
    ThreadFactory threadFactory =
        new ThreadFactory() {
          private final AtomicInteger threadNumber = new AtomicInteger(1);
          private final String namePrefix = "AsyncServicePool-Thread-";

          @Override
          public Thread newThread(Runnable r) {
            Thread t = new Thread(r, namePrefix + threadNumber.getAndIncrement());
            if (t.isDaemon()) t.setDaemon(false);
            if (t.getPriority() != Thread.NORM_PRIORITY) t.setPriority(Thread.NORM_PRIORITY);
            return t;
          }
        };
    executorService = Executors.newFixedThreadPool(20, threadFactory);
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
