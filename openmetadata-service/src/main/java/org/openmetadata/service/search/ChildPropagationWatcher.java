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

package org.openmetadata.service.search;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.BiConsumer;
import lombok.extern.slf4j.Slf4j;

/**
 * Inherited fields reach a parent's children through an update-by-query the cluster runs in the
 * background, after the request that changed the parent has returned. A task that fails under load,
 * or skips a child on a version conflict, leaves that child stale until the next reindex, and
 * nothing would notice. This polls each task until it finishes and queues the parent of one that
 * left children stale; the retry worker then reindexes the parent and its children from the
 * database (ADR:2026-11-03-a-failed-child-propagation-reindexes-its-parent).
 *
 * <p>Each poll is a short status read, so no search connection is held while a task runs.
 */
@Slf4j
public final class ChildPropagationWatcher {
  static final Duration POLL_INTERVAL = Duration.ofSeconds(5);
  static final int MAX_WATCHED_TASKS = 1_000;
  static final int MAX_POLLS =
      (int)
          (SearchPropagationLimits.CHILD_PROPAGATION_WAIT.toSeconds() / POLL_INTERVAL.toSeconds());
  private static final ScheduledExecutorService POLLER =
      Executors.newSingleThreadScheduledExecutor(
          Thread.ofPlatform().name("search-child-propagation-watcher").daemon().factory());
  private static final ChildPropagationWatcher WATCHER =
      new ChildPropagationWatcher(
          (poll, delay) -> POLLER.schedule(poll, delay.toMillis(), TimeUnit.MILLISECONDS),
          SearchIndexRetryQueue::enqueueParent);

  private final Scheduler scheduler;
  private final BiConsumer<String, String> repairParent;
  private final AtomicInteger watched = new AtomicInteger();
  private final AtomicLong unwatched = new AtomicLong();

  ChildPropagationWatcher(Scheduler scheduler, BiConsumer<String, String> repairParent) {
    this.scheduler = scheduler;
    this.repairParent = repairParent;
  }

  /** What a background update-by-query did; {@code finished} is false while it still runs. */
  public record TaskOutcome(boolean finished, List<String> failureReasons, long versionConflicts) {
    public static TaskOutcome unfinished() {
      return new TaskOutcome(false, List.of(), 0);
    }

    boolean leftChildrenStale() {
      return finished && (!failureReasons.isEmpty() || versionConflicts > 0);
    }

    String describe() {
      return failureReasons.isEmpty()
          ? "%d child document(s) skipped on version conflicts".formatted(versionConflicts)
          : String.join("; ", failureReasons);
    }
  }

  /** Reads a task's status once, without waiting for it to finish. */
  @FunctionalInterface
  public interface TaskPoller {
    TaskOutcome poll(String taskId) throws IOException;
  }

  @FunctionalInterface
  interface Scheduler {
    void schedule(Runnable poll, Duration delay);
  }

  private record Watch(String taskId, String parentKey, TaskPoller poller) {}

  /**
   * Watches the task that propagates to the children of {@code parentKey}, the parent id or FQN the
   * propagation matched children on.
   */
  public static void watch(String taskId, String parentKey, TaskPoller poller) {
    WATCHER.watchTask(taskId, parentKey, poller);
  }

  void watchTask(String taskId, String parentKey, TaskPoller poller) {
    if (taskId != null && parentKey != null) {
      if (watched.incrementAndGet() > MAX_WATCHED_TASKS) {
        watched.decrementAndGet();
        reportUnwatched();
      } else {
        schedulePoll(new Watch(taskId, parentKey, poller), 1);
      }
    }
  }

  private void schedulePoll(Watch watch, int attempt) {
    scheduler.schedule(() -> poll(watch, attempt), POLL_INTERVAL);
  }

  private void poll(Watch watch, int attempt) {
    TaskOutcome outcome = readOutcome(watch);
    if (outcome.finished()) {
      watched.decrementAndGet();
      repairIfStale(watch, outcome);
    } else if (attempt >= MAX_POLLS) {
      watched.decrementAndGet();
      LOG.warn(
          "Child propagation task {} for parent {} did not finish within {}; its outcome is unknown",
          watch.taskId(),
          watch.parentKey(),
          SearchPropagationLimits.CHILD_PROPAGATION_WAIT);
    } else {
      schedulePoll(watch, attempt + 1);
    }
  }

  // The cluster this watches for is often the one under load, so a status read that fails is
  // tried again on the next poll rather than taken as the task's outcome.
  private TaskOutcome readOutcome(Watch watch) {
    TaskOutcome outcome;
    try {
      outcome = watch.poller().poll(watch.taskId());
    } catch (IOException | RuntimeException e) {
      LOG.debug(
          "Could not read child propagation task {} for parent {}: {}",
          watch.taskId(),
          watch.parentKey(),
          e.getMessage());
      outcome = TaskOutcome.unfinished();
    }
    return outcome;
  }

  private void repairIfStale(Watch watch, TaskOutcome outcome) {
    if (outcome.leftChildrenStale()) {
      LOG.warn(
          "Child propagation task {} for parent {} left children stale ({}); reindexing them",
          watch.taskId(),
          watch.parentKey(),
          outcome.describe());
      repairParent.accept(watch.parentKey(), "updateChildren: %s".formatted(outcome.describe()));
    }
  }

  // Logged on the first and every thousandth miss, so a burst of propagations cannot flood the log.
  private void reportUnwatched() {
    long misses = unwatched.incrementAndGet();
    if (misses == 1 || misses % MAX_WATCHED_TASKS == 0) {
      LOG.warn(
          "{} child propagation task(s) went unwatched: {} were already being watched",
          misses,
          MAX_WATCHED_TASKS);
    }
  }
}
