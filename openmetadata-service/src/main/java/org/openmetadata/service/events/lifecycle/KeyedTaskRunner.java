/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.events.lifecycle;

import io.micrometer.core.instrument.Metrics;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BiConsumer;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.events.lifecycle.OrderedLaneExecutor.LaneOverflowShedException;
import org.openmetadata.service.events.lifecycle.OrderedLaneExecutor.OrderedTask;

/**
 * Runs each key's tasks one at a time, in the order they were submitted, and different keys' tasks
 * at the same time, up to a limit. Unlike lanes shared by hash, a slow task holds up only the tasks
 * of its own key queued behind it. A task that cannot be queued, because the runner is full or
 * closed, goes to the failure handler, which makes a located task durable.
 */
@Slf4j
public final class KeyedTaskRunner implements AutoCloseable {
  private static final String SHED_METRIC = "search.keyed_task.shed";
  private static final int MIN_CONCURRENCY = 32;
  private static final int MAX_CONCURRENCY = 128;
  private static final int DEFAULT_CAPACITY = 16_000;
  private static final long DEFAULT_SHUTDOWN_TIMEOUT_SECONDS = 30L;
  private static final int UNKNOWN_LANE = -1;

  /** A queued task, or a marker that only signals that the tasks queued before it have run. */
  private record Entry(OrderedTask task, Runnable marker) {}

  private final Map<UUID, ArrayDeque<Entry>> queues = new ConcurrentHashMap<>();
  private final ExecutorService threads =
      Executors.newThreadPerTaskExecutor(Thread.ofVirtual().name("om-keyed-task-", 0).factory());
  private final Semaphore running;
  private final AtomicInteger queued = new AtomicInteger();
  private final int capacity;
  private final long shutdownTimeoutSeconds;
  private final BiConsumer<OrderedTask, Throwable> failureHandler;
  private final ThreadLocal<Boolean> runningTask = new ThreadLocal<>();
  private volatile boolean closed;

  KeyedTaskRunner(
      final BiConsumer<OrderedTask, Throwable> failureHandler,
      final int concurrency,
      final int capacity,
      final long shutdownTimeoutSeconds) {
    this.failureHandler = failureHandler;
    this.running = new Semaphore(concurrency, true);
    this.capacity = capacity;
    this.shutdownTimeoutSeconds = shutdownTimeoutSeconds;
  }

  /**
   * For tasks that spend most of their time waiting on another system, such as search tasks by
   * query: four running per processor, between 32 and 128.
   */
  public static KeyedTaskRunner forWaitingTasks(
      final BiConsumer<OrderedTask, Throwable> failureHandler) {
    final int processors = Runtime.getRuntime().availableProcessors();
    return new KeyedTaskRunner(
        failureHandler,
        Math.min(MAX_CONCURRENCY, Math.max(MIN_CONCURRENCY, 4 * processors)),
        DEFAULT_CAPACITY,
        DEFAULT_SHUTDOWN_TIMEOUT_SECONDS);
  }

  /** Queues {@code task} behind {@code key}'s earlier tasks; never blocks the caller. */
  public void submit(final UUID key, final OrderedTask task) {
    if (key == null) {
      runTask(task);
    } else if (closed) {
      shed(task);
    } else if (queued.incrementAndGet() > capacity) {
      queued.decrementAndGet();
      shed(task);
    } else {
      enqueue(key, new Entry(task, null));
    }
  }

  /** Whether the calling thread is running one of this runner's tasks. */
  public boolean isRunningTask() {
    return Boolean.TRUE.equals(runningTask.get());
  }

  /**
   * Waits until every task submitted before this call has run. For draining and tests; never call
   * it on a request thread.
   *
   * @return {@code false} if {@code timeout} passed first
   */
  public boolean awaitQueuedTasks(final Duration timeout) throws InterruptedException {
    final List<UUID> keys = List.copyOf(queues.keySet());
    final CountDownLatch markers = new CountDownLatch(keys.size());
    for (final UUID key : keys) {
      if (!appendMarker(key, markers::countDown)) {
        markers.countDown();
      }
    }
    return markers.await(timeout.toMillis(), TimeUnit.MILLISECONDS);
  }

  /** Runs what is queued within the shutdown timeout, then hands what is left to the handler. */
  @Override
  public void close() {
    closed = true;
    try {
      if (!awaitQueuedTasks(Duration.ofSeconds(shutdownTimeoutSeconds))) {
        shedQueued();
      }
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      shedQueued();
    }
    threads.shutdown();
  }

  /** A key's queue exists exactly while a thread is draining it. */
  private void enqueue(final UUID key, final Entry entry) {
    final boolean[] firstEntry = new boolean[1];
    queues.compute(
        key,
        (ignored, queue) -> {
          final ArrayDeque<Entry> tasks = queue == null ? new ArrayDeque<>() : queue;
          firstEntry[0] = queue == null;
          tasks.add(entry);
          return tasks;
        });
    if (firstEntry[0]) {
      startDraining(key);
    }
  }

  private void startDraining(final UUID key) {
    try {
      threads.execute(() -> drain(key));
    } catch (RejectedExecutionException stopped) {
      shedQueue(queues.remove(key));
    }
  }

  private void drain(final UUID key) {
    Entry next = poll(key);
    while (next != null) {
      run(next);
      next = poll(key);
    }
  }

  private Entry poll(final UUID key) {
    final Entry[] next = new Entry[1];
    queues.computeIfPresent(
        key,
        (ignored, tasks) -> {
          next[0] = tasks.poll();
          return next[0] == null ? null : tasks;
        });
    return next[0];
  }

  private boolean appendMarker(final UUID key, final Runnable marker) {
    final boolean[] appended = new boolean[1];
    queues.computeIfPresent(
        key,
        (ignored, tasks) -> {
          tasks.add(new Entry(null, marker));
          appended[0] = true;
          return tasks;
        });
    return appended[0];
  }

  private void run(final Entry entry) {
    if (entry.marker() != null) {
      entry.marker().run();
      return;
    }
    try {
      running.acquire();
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      queued.decrementAndGet();
      shed(entry.task());
      return;
    }
    runningTask.set(Boolean.TRUE);
    try {
      runTask(entry.task());
    } finally {
      runningTask.remove();
      running.release();
      queued.decrementAndGet();
    }
  }

  private void runTask(final OrderedTask task) {
    try {
      task.run();
    } catch (Throwable failure) {
      handleFailure(task, failure);
    }
  }

  private void shedQueued() {
    for (final UUID key : List.copyOf(queues.keySet())) {
      shedQueue(queues.remove(key));
    }
  }

  private void shedQueue(final ArrayDeque<Entry> entries) {
    if (entries != null) {
      for (final Entry entry : entries) {
        if (entry.marker() != null) {
          entry.marker().run();
        } else {
          queued.decrementAndGet();
          shed(entry.task());
        }
      }
    }
  }

  /** A located task goes to the durable retry queue; one without a locator runs once, inline. */
  private void shed(final OrderedTask task) {
    if (task instanceof OrderedLaneTask) {
      Metrics.counter(SHED_METRIC).increment();
      LOG.warn("Keyed task runner full or closed; handing a task to the durable retry queue");
      handleFailure(task, new LaneOverflowShedException(UNKNOWN_LANE));
    } else {
      runTask(task);
    }
  }

  private void handleFailure(final OrderedTask task, final Throwable failure) {
    try {
      failureHandler.accept(task, failure);
    } catch (Throwable handlerFailure) {
      LOG.error("Keyed task failure handler threw; the failed task is lost", handlerFailure);
    }
  }
}
