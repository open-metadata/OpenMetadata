package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import io.dropwizard.db.DataSourceFactory;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;
import java.util.concurrent.Semaphore;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.OpenMetadataApplicationConfigHolder;
import org.openmetadata.service.util.PerRequestContextCleaner;

/**
 * Runs a node's per-entity work over a batch on a small pool, and hands the outcomes back in the
 * batch's order so the calling Flowable job thread can record them. The work must not touch the
 * Flowable execution: process variables are read before and written after, on the job thread.
 *
 * <p>Each distinct entity link is handled once, by one task, so no two tasks ever load or patch
 * the same entity; a link listed twice shares the outcome of its single run.
 *
 * <p>Concurrency is bounded twice. A run uses at most {@link Budget#threads} threads, and every
 * entity's work, on a pool thread or on the calling thread, holds one of {@link Budget#permits},
 * which every run in the server shares. All batch nodes together therefore never run more entities
 * at once, nor hold more OpenMetadata database connections for them, than there are permits,
 * whatever number of workflow jobs Flowable runs at once. Each run starts its own pool, whose
 * threads wait for those permits. The budget is a quarter of the database pool, at most {@link
 * #MAX_THREADS}, which leaves the rest of the pool to API traffic. Outside a running server, where
 * there is no pool to size against, work runs on the calling thread.
 */
@Slf4j
final class BatchParallelism {
  static final int MAX_THREADS = 8;
  static final int DB_POOL_SHARE_DIVISOR = 4;
  static final String THREAD_NAME_PREFIX = "workflow-batch-";

  private static final Budget INLINE = Budget.of(1);

  private static volatile Budget sharedBudget;

  private BatchParallelism() {}

  /** What one entity's work produced: its value, or the exception it failed with. */
  record Outcome<T>(T value, RuntimeException failure) {
    boolean failed() {
      return failure != null;
    }
  }

  /** How many threads a run may use, and the permits every run in the server shares. */
  record Budget(int threads, Semaphore permits) {
    static Budget of(int threads) {
      return new Budget(threads, new Semaphore(threads));
    }
  }

  /** Runs {@code work} for every entity link, returning one outcome per link in input order. */
  static <T> List<Outcome<T>> run(
      String nodeName, List<String> entityLinks, Function<String, T> work) {
    return run(nodeName, entityLinks, work, budget());
  }

  static <T> List<Outcome<T>> run(
      String nodeName, List<String> entityLinks, Function<String, T> work, Budget budget) {
    List<String> distinct = List.copyOf(new LinkedHashSet<>(entityLinks));
    int threads = Math.min(budget.threads(), distinct.size());
    Map<String, Outcome<T>> outcomes =
        threads <= 1
            ? runInline(distinct, work, budget.permits())
            : runOnPool(nodeName, distinct, work, threads, budget.permits());
    return entityLinks.stream().map(outcomes::get).toList();
  }

  /**
   * The server-wide budget, sized from the database pool the first time a batch needs it. Without
   * a server configuration there is no pool to size against, and the work runs on the calling
   * thread.
   */
  static Budget budget() {
    Budget budget = sharedBudget;
    if (budget == null && OpenMetadataApplicationConfigHolder.isInitialized()) {
      synchronized (BatchParallelism.class) {
        if (sharedBudget == null) {
          int databasePoolSize = databasePoolSize();
          sharedBudget = Budget.of(threadsFor(databasePoolSize));
          LOG.info(
              "Batch workflow nodes run on up to {} threads (database pool size {})",
              sharedBudget.threads(),
              databasePoolSize);
        }
        budget = sharedBudget;
      }
    }
    return budget != null ? budget : INLINE;
  }

  static int threadsFor(int databasePoolSize) {
    return Math.clamp(databasePoolSize / DB_POOL_SHARE_DIVISOR, 1, MAX_THREADS);
  }

  private static int databasePoolSize() {
    DataSourceFactory dataSource =
        OpenMetadataApplicationConfigHolder.getInstance().getDataSourceFactory();
    return dataSource != null ? dataSource.getMaxSize() : 0;
  }

  private static <T> Map<String, Outcome<T>> runInline(
      List<String> entityLinks, Function<String, T> work, Semaphore permits) {
    Map<String, Outcome<T>> outcomes = new ConcurrentHashMap<>();
    try {
      for (String entityLink : entityLinks) {
        outcomes.put(entityLink, attemptWithPermit(entityLink, work, permits));
      }
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Interrupted while running a batch node", e);
    }
    return outcomes;
  }

  private static <T> Map<String, Outcome<T>> runOnPool(
      String nodeName,
      List<String> entityLinks,
      Function<String, T> work,
      int threads,
      Semaphore permits) {
    Map<String, Outcome<T>> outcomes = new ConcurrentHashMap<>();
    Worker<T> worker = new Worker<>(entityLinks, work, permits, outcomes);
    try (ExecutorService executor = pool(nodeName, threads)) {
      List<Future<?>> workers = new ArrayList<>();
      for (int i = 0; i < threads; i++) {
        workers.add(executor.submit(worker::drain));
      }
      workers.forEach(future -> await(future, executor));
    }
    return outcomes;
  }

  /**
   * Exactly {@code threads} workers are submitted, each draining the shared batch, so the queue
   * never holds more than {@code threads} entries.
   */
  private static ExecutorService pool(String nodeName, int threads) {
    return new ThreadPoolExecutor(
        threads,
        threads,
        0L,
        TimeUnit.MILLISECONDS,
        new ArrayBlockingQueue<>(threads),
        threadFactory(nodeName));
  }

  private static ThreadFactory threadFactory(String nodeName) {
    AtomicInteger number = new AtomicInteger();
    return runnable -> {
      Thread thread =
          new Thread(
              runnable,
              "%s%s-%d".formatted(THREAD_NAME_PREFIX, nodeName, number.incrementAndGet()));
      thread.setDaemon(true);
      return thread;
    };
  }

  private static void await(Future<?> worker, ExecutorService executor) {
    try {
      worker.get();
    } catch (InterruptedException e) {
      executor.shutdownNow();
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Interrupted while running a batch node", e);
    } catch (ExecutionException e) {
      executor.shutdownNow();
      // A worker records every RuntimeException as its entity's outcome; what escapes it is an
      // Error, which the serial loop let propagate too.
      if (e.getCause() instanceof Error error) {
        throw error;
      }
      throw new IllegalStateException("A batch node worker failed", e.getCause());
    }
  }

  private static <T> Outcome<T> attemptWithPermit(
      String entityLink, Function<String, T> work, Semaphore permits) throws InterruptedException {
    permits.acquire();
    try {
      return attempt(entityLink, work);
    } finally {
      permits.release();
    }
  }

  private static <T> Outcome<T> attempt(String entityLink, Function<String, T> work) {
    Outcome<T> outcome;
    try {
      outcome = new Outcome<>(work.apply(entityLink), null);
    } catch (RuntimeException exception) {
      outcome = new Outcome<>(null, exception);
    }
    return outcome;
  }

  /** Takes the next unclaimed entity of the batch until none is left or the run is aborted. */
  private record Worker<T>(
      List<String> entityLinks,
      Function<String, T> work,
      Semaphore permits,
      Map<String, Outcome<T>> outcomes,
      AtomicInteger next,
      AtomicBoolean aborted) {

    Worker(
        List<String> entityLinks,
        Function<String, T> work,
        Semaphore permits,
        Map<String, Outcome<T>> outcomes) {
      this(entityLinks, work, permits, outcomes, new AtomicInteger(), new AtomicBoolean());
    }

    Void drain() throws InterruptedException {
      try {
        for (int i = next.getAndIncrement();
            i < entityLinks.size() && !aborted.get();
            i = next.getAndIncrement()) {
          String entityLink = entityLinks.get(i);
          outcomes.put(entityLink, attemptOnPoolThread(entityLink));
        }
      } catch (InterruptedException | Error e) {
        aborted.set(true);
        throw e;
      }
      return null;
    }

    private Outcome<T> attemptOnPoolThread(String entityLink) throws InterruptedException {
      try {
        return attemptWithPermit(entityLink, work, permits);
      } finally {
        // Pool threads carry no request scope; drop what one entity's work cached on the thread.
        PerRequestContextCleaner.clear();
      }
    }
  }
}
