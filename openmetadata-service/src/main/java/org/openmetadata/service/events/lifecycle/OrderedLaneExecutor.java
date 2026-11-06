/*
 *  Copyright 2024 Collate
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
import java.util.List;
import java.util.UUID;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.function.BiConsumer;
import lombok.extern.slf4j.Slf4j;

/**
 * A striped, single-consumer-per-lane async executor that preserves per-entity ordering.
 *
 * <p>The lane for a task is a pure function of the entity id ({@code floorMod(hash, laneCount)}), so
 * every async side-effect for one entity always serializes onto the same single-thread lane in
 * submission order — two operations on the same entity therefore apply in the order they were
 * submitted. Distinct entities hash to (usually) distinct lanes and run in parallel.
 *
 * <p><b>Backpressure — the request thread NEVER blocks on a full lane.</b> Each lane is a
 * single-thread {@link ThreadPoolExecutor} with a <em>bounded</em> queue. On submit we
 * <em>non-blockingly</em> {@code offer()} the task; when the lane queue is full we do <em>not</em>
 * block the request thread (that would defeat the whole point of moving side-effects off the request
 * thread) and we do <em>not</em> run the task inline ahead of the already-queued tasks (that would
 * reorder it and break per-entity FIFO — which is why {@link ThreadPoolExecutor.CallerRunsPolicy} is
 * rejected). Instead we <em>shed</em> the overflowing task to the durable search-index retry outbox
 * via the {@code laneFailureHandler}: an {@link OrderedLaneTask} carries the entity locator, so the
 * retry worker reindexes the entity's <em>current committed</em> state — out-of-order overflow
 * therefore self-corrects and read-your-write of the DB is unaffected. A locator-less task (rare RDF
 * with no usable id) cannot be shed durably, so it runs inline once (a single bounded
 * CallerRuns-style run, never a wait for queue space). The whole queue is bounded, so a write burst
 * can neither OOM nor stall the request thread.
 *
 * <p>Lanes are backed by virtual threads, so an idle lane costs nothing and a slow external round
 * trip parks a virtual thread instead of starving a platform thread.
 *
 * <p>Durability: a task is submitted as an {@link OrderedTask} whose {@code runSafely()} wrapper
 * catches every {@link Throwable} so a lane thread never dies silently and a failing task is routed
 * to the {@code laneFailureHandler} (the durable search-index retry outbox) instead of being lost.
 */
@Slf4j
public final class OrderedLaneExecutor implements AutoCloseable {

  private static final int MIN_LANES = 8;
  private static final int MAX_LANES = 32;
  private static final int DEFAULT_LANE_QUEUE_CAPACITY = 2000;
  private static final long LANE_KEEP_ALIVE_SECONDS = 60L;
  private static final long DEFAULT_SHUTDOWN_TIMEOUT_SECONDS = 30L;
  private static final String SHED_METRIC = "search.ordered_lane.shed";
  private static final int LANE_UNKNOWN = -1;

  /**
   * Sentinel cause handed to the {@code laneFailureHandler} when a task is shed to the durable outbox
   * because its lane queue was full (as opposed to a task that failed while executing). It lets the
   * handler know the work never ran, so a durable retry against current committed state must be
   * enqueued rather than treated as an execution error.
   */
  public static final class LaneOverflowShedException extends RejectedExecutionException {
    LaneOverflowShedException(int lane) {
      super("Ordered lane " + lane + " queue full; shedding to durable retry outbox");
    }
  }

  private final ThreadPoolExecutor[] lanes;
  private final int laneCount;
  private final int laneQueueCapacity;
  private final long shutdownTimeoutSeconds;
  private final BiConsumer<OrderedTask, Throwable> laneFailureHandler;

  public OrderedLaneExecutor(BiConsumer<OrderedTask, Throwable> laneFailureHandler) {
    this(laneFailureHandler, DEFAULT_LANE_QUEUE_CAPACITY, DEFAULT_SHUTDOWN_TIMEOUT_SECONDS);
  }

  /** Test-only constructor for exercising overflow shedding and shutdown draining quickly. */
  OrderedLaneExecutor(
      BiConsumer<OrderedTask, Throwable> laneFailureHandler,
      int laneQueueCapacity,
      long shutdownTimeoutSeconds) {
    this.laneFailureHandler = laneFailureHandler;
    this.laneQueueCapacity = laneQueueCapacity;
    this.shutdownTimeoutSeconds = shutdownTimeoutSeconds;
    this.laneCount = computeLaneCount();
    this.lanes = new ThreadPoolExecutor[laneCount];
    for (int index = 0; index < laneCount; index++) {
      lanes[index] = newLane(index);
    }
    LOG.info("OrderedLaneExecutor initialized with {} single-consumer lanes", laneCount);
  }

  private static int computeLaneCount() {
    int processors = Runtime.getRuntime().availableProcessors();
    return Math.min(MAX_LANES, Math.max(MIN_LANES, processors));
  }

  private ThreadPoolExecutor newLane(int index) {
    ThreadPoolExecutor lane =
        new ThreadPoolExecutor(
            1,
            1,
            LANE_KEEP_ALIVE_SECONDS,
            TimeUnit.SECONDS,
            new LinkedBlockingQueue<>(laneQueueCapacity),
            Thread.ofVirtual().name("om-ordered-lane-" + index + "-", 0).factory(),
            new ThreadPoolExecutor.AbortPolicy());
    lane.allowCoreThreadTimeOut(true);
    return lane;
  }

  int laneFor(UUID entityId) {
    long mixed = entityId.getMostSignificantBits() ^ entityId.getLeastSignificantBits();
    return Math.floorMod(Long.hashCode(mixed), laneCount);
  }

  int getLaneCount() {
    return laneCount;
  }

  /**
   * Submit {@code task} onto the lane for {@code entityId}. A {@code null} key (which should not
   * happen on entity-scoped dispatch) runs the task inline so it is never silently dropped. The
   * submit path never blocks the request thread: a full lane sheds the task (Section
   * "Backpressure"), it does not wait for queue space.
   */
  public void submit(UUID entityId, OrderedTask task) {
    if (entityId == null) {
      runSafely(task);
    } else {
      submitToLane(laneFor(entityId), task);
    }
  }

  /**
   * Non-blocking enqueue: try to {@code execute} (which {@code offer()}s onto the bounded queue),
   * and on {@link RejectedExecutionException} (queue full or lane shutting down) shed the task to the
   * durable outbox instead of blocking or running it inline ahead of queued work.
   */
  private void submitToLane(int lane, OrderedTask task) {
    try {
      lanes[lane].execute(new LaneRunnable(task));
    } catch (RejectedExecutionException rejected) {
      shedToOutbox(lane, task);
    }
  }

  /**
   * The {@link Runnable} actually queued on a lane. It keeps a reference to the original {@link
   * OrderedTask} so that a task still queued at hard-stop ({@code shutdownNow()}) can be shed to the
   * durable outbox by its entity locator (Section "Backpressure"), rather than re-executed against a
   * possibly-already-torn-down search/DAO client during shutdown.
   */
  private final class LaneRunnable implements Runnable {
    private final OrderedTask task;

    private LaneRunnable(OrderedTask task) {
      this.task = task;
    }

    @Override
    public void run() {
      runSafely(task);
    }
  }

  /**
   * The lane queue is full (or the lane is shutting down). The request thread must not block, so we
   * route the task to the durable outbox via the failure handler with a {@link
   * LaneOverflowShedException} cause. For an {@link OrderedLaneTask} the handler enqueues the entity
   * locator and the retry worker reindexes current committed state — overflow self-corrects in order.
   * A locator-less task cannot be made durable, so it runs inline once (CallerRuns-style, a single
   * bounded run, never a wait) rather than being lost.
   */
  private void shedToOutbox(int lane, OrderedTask task) {
    if (task instanceof OrderedLaneTask) {
      Metrics.counter(SHED_METRIC).increment();
      LOG.warn("Ordered lane {} full; shedding task to durable retry outbox", lane);
      handleLaneFailure(task, new LaneOverflowShedException(lane));
    } else {
      LOG.warn("Ordered lane {} full and task has no locator; running inline once", lane);
      runSafely(task);
    }
  }

  private void runSafely(OrderedTask task) {
    try {
      task.run();
    } catch (Throwable failure) {
      handleLaneFailure(task, failure);
    }
  }

  private void handleLaneFailure(OrderedTask task, Throwable failure) {
    try {
      laneFailureHandler.accept(task, failure);
    } catch (Throwable handlerFailure) {
      LOG.error("Ordered-lane failure handler threw; the failed task is lost", handlerFailure);
    }
  }

  @Override
  public void close() {
    for (ThreadPoolExecutor lane : lanes) {
      lane.shutdown();
    }
    for (ThreadPoolExecutor lane : lanes) {
      awaitLaneTermination(lane);
    }
  }

  private void awaitLaneTermination(ThreadPoolExecutor lane) {
    try {
      if (!lane.awaitTermination(shutdownTimeoutSeconds, TimeUnit.SECONDS)) {
        flushDroppedToOutbox(lane.shutdownNow());
      }
    } catch (InterruptedException e) {
      flushDroppedToOutbox(lane.shutdownNow());
      Thread.currentThread().interrupt();
    }
  }

  private void flushDroppedToOutbox(List<Runnable> dropped) {
    if (!dropped.isEmpty()) {
      LOG.warn(
          "Ordered-lane shutdown dropped {} queued task(s); flushing to outbox", dropped.size());
      for (Runnable runnable : dropped) {
        flushDroppedRunnable(runnable);
      }
    }
  }

  /**
   * Route a task still queued at hard-stop to the durable outbox by its locator instead of
   * re-executing it (the search/DAO client may already be torn down at shutdown). A locator-carrying
   * {@link OrderedLaneTask} is enqueued via the failure handler; a locator-less task is best-effort
   * re-run since it cannot be made durable.
   */
  private void flushDroppedRunnable(Runnable runnable) {
    if (runnable instanceof LaneRunnable laneRunnable) {
      shedDroppedTask(laneRunnable.task);
    }
  }

  private void shedDroppedTask(OrderedTask task) {
    if (task instanceof OrderedLaneTask) {
      handleLaneFailure(task, new LaneOverflowShedException(LANE_UNKNOWN));
    } else {
      runDroppedInline(task);
    }
  }

  private void runDroppedInline(OrderedTask task) {
    try {
      task.run();
    } catch (Throwable failure) {
      LOG.warn("Failed to flush a dropped locator-less ordered-lane task during shutdown", failure);
    }
  }

  /**
   * A unit of ordered async work. Implementations carry the entity locator needed to enqueue a
   * durable retry when the work fails (see {@code OrderedLaneTask}).
   */
  @FunctionalInterface
  public interface OrderedTask {
    void run() throws Exception;
  }
}
