package org.openmetadata.service.attachments;

import io.dropwizard.lifecycle.Managed;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.Semaphore;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class ObjectDeleteQueueService implements Managed {
  static final int DEFAULT_WORKER_COUNT =
      Integer.getInteger(
          "collate.object.delete.workers",
          Math.max(2, Math.min(4, Runtime.getRuntime().availableProcessors())));
  static final int DEFAULT_QUEUE_CAPACITY =
      Integer.getInteger("collate.object.delete.queue.capacity", 128);
  static final long DEFAULT_ENQUEUE_TIMEOUT_MILLIS =
      Long.getLong("collate.object.delete.enqueue.timeout.ms", 5000L);
  static final long DEFAULT_KEEP_ALIVE_MILLIS =
      Long.getLong("collate.object.delete.keepalive.ms", 5000L);

  private static final ObjectDeleteQueueService INSTANCE = createInstance();

  private static ObjectDeleteQueueService createInstance() {
    ObjectDeleteQueueService service =
        new ObjectDeleteQueueService(
            DEFAULT_WORKER_COUNT, DEFAULT_QUEUE_CAPACITY, DEFAULT_ENQUEUE_TIMEOUT_MILLIS);
    // Ensure the non-daemon worker threads are drained on JVM exit even when Dropwizard's
    // Managed.stop() wasn't invoked (e.g. when the server is run outside of a full
    // application lifecycle, or if the stop hook is missed). Without this, ungracefully
    // terminated servers can leave orphan threads that prevent the JVM from exiting.
    Runtime.getRuntime()
        .addShutdownHook(
            new Thread(
                () -> {
                  try {
                    service.stop();
                  } catch (Exception e) {
                    // Best-effort shutdown — log at JVM-exit-time is fine here.
                    LOG.warn("Failed to cleanly stop ObjectDeleteQueueService on JVM exit", e);
                  }
                },
                "object-delete-queue-shutdown"));
    return service;
  }

  private final ThreadPoolExecutor executorService;
  private final Semaphore capacitySemaphore;
  private final int workerCount;
  private final int queueCapacity;
  private final long enqueueTimeoutMillis;

  ObjectDeleteQueueService(int workerCount, int queueCapacity, long enqueueTimeoutMillis) {
    if (workerCount <= 0) {
      throw new IllegalArgumentException("workerCount must be > 0");
    }
    if (queueCapacity < 0) {
      throw new IllegalArgumentException("queueCapacity must be >= 0");
    }
    if (enqueueTimeoutMillis < 0) {
      throw new IllegalArgumentException("enqueueTimeoutMillis must be >= 0");
    }

    this.workerCount = workerCount;
    this.queueCapacity = queueCapacity;
    this.enqueueTimeoutMillis = enqueueTimeoutMillis;
    this.capacitySemaphore = new Semaphore(workerCount + queueCapacity, true);
    // queueCapacity == 0 means "reject when all workers are busy, no buffering".
    // SynchronousQueue preserves that semantic; ArrayBlockingQueue(1) would silently
    // buffer one task past the semaphore's accounting.
    BlockingQueue<Runnable> workQueue =
        queueCapacity == 0 ? new SynchronousQueue<>() : new ArrayBlockingQueue<>(queueCapacity);
    this.executorService =
        new ThreadPoolExecutor(
            workerCount,
            workerCount,
            DEFAULT_KEEP_ALIVE_MILLIS,
            TimeUnit.MILLISECONDS,
            workQueue,
            new DeleteThreadFactory(),
            new ThreadPoolExecutor.AbortPolicy());
    this.executorService.allowCoreThreadTimeOut(true);
  }

  public static ObjectDeleteQueueService getInstance() {
    return INSTANCE;
  }

  public CompletableFuture<Void> submit(String jobLabel, Runnable task) {
    try {
      if (!capacitySemaphore.tryAcquire(enqueueTimeoutMillis, TimeUnit.MILLISECONDS)) {
        throw buildQueueSaturatedException(jobLabel);
      }
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new RejectedExecutionException(
          "Interrupted while waiting for delete queue capacity", e);
    }

    CompletableFuture<Void> result = new CompletableFuture<>();
    try {
      executorService.execute(
          () -> {
            try {
              task.run();
              result.complete(null);
            } catch (Throwable t) {
              result.completeExceptionally(t);
            } finally {
              capacitySemaphore.release();
            }
          });
    } catch (RejectedExecutionException e) {
      capacitySemaphore.release();
      if (executorService.isShutdown()) {
        throw new RejectedExecutionException(
            "Delete queue is shutting down, cannot accept job: " + jobLabel);
      }
      throw buildQueueSaturatedException(jobLabel);
    }

    return result;
  }

  public int getWorkerCount() {
    return workerCount;
  }

  public int getQueueCapacity() {
    return queueCapacity;
  }

  public long getEnqueueTimeoutMillis() {
    return enqueueTimeoutMillis;
  }

  public int getActiveCount() {
    return executorService.getActiveCount();
  }

  public int getQueueDepth() {
    return executorService.getQueue().size();
  }

  public int getTotalCapacity() {
    return workerCount + queueCapacity;
  }

  @Override
  public void start() {
    // Executor is initialized eagerly.
  }

  @Override
  public void stop() {
    executorService.shutdown();
    try {
      if (!executorService.awaitTermination(30, TimeUnit.SECONDS)) {
        LOG.warn("Delete queue did not terminate within 30s, forcing shutdown");
        executorService.shutdownNow();
      }
    } catch (InterruptedException e) {
      executorService.shutdownNow();
      Thread.currentThread().interrupt();
    }
  }

  private RejectedExecutionException buildQueueSaturatedException(String jobLabel) {
    LOG.warn(
        "Object delete queue is full for job {}. active={}, queued={}, capacity={}",
        jobLabel,
        getActiveCount(),
        getQueueDepth(),
        getTotalCapacity());
    return new RejectedExecutionException(
        String.format(
            "Object delete queue is full. active=%d queued=%d capacity=%d",
            getActiveCount(), getQueueDepth(), getTotalCapacity()));
  }

  private static final class DeleteThreadFactory implements ThreadFactory {
    private final AtomicInteger counter = new AtomicInteger(1);

    @Override
    public Thread newThread(Runnable runnable) {
      Thread thread = new Thread(runnable, "object-delete-worker-" + counter.getAndIncrement());
      thread.setDaemon(false);
      return thread;
    }
  }
}
