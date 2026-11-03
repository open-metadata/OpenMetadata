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
import java.util.List;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.function.BiConsumer;
import lombok.extern.slf4j.Slf4j;

/**
 * Inherited fields reach a parent's children through an update-by-query the cluster runs in the
 * background, after the request that changed the parent has returned. A task that fails under load,
 * or skips a child on a version conflict, leaves that child stale until the next reindex, and
 * nothing would notice. This waits for each task and queues the parent of one that left children
 * stale; the retry worker then reindexes the parent and its children from the database.
 */
@Slf4j
public final class ChildPropagationWatcher {
  private static final int WATCHER_THREADS = 2;
  private static final int MAX_PENDING_TASKS = 1_000;
  private static final Executor WATCHERS =
      new ThreadPoolExecutor(
          WATCHER_THREADS,
          WATCHER_THREADS,
          0L,
          TimeUnit.MILLISECONDS,
          new ArrayBlockingQueue<>(MAX_PENDING_TASKS),
          Thread.ofPlatform().name("search-child-propagation-watcher-", 0).daemon().factory(),
          (task, executor) ->
              LOG.warn(
                  "{} child propagation tasks are already being watched; not watching another",
                  MAX_PENDING_TASKS));

  private ChildPropagationWatcher() {}

  /** What a background update-by-query did, once the cluster says it finished. */
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

  /** Blocks until the cluster reports the task finished, or its own wait times out. */
  @FunctionalInterface
  public interface TaskAwaiter {
    TaskOutcome await(String taskId) throws IOException;
  }

  /**
   * Watches the task that propagates to the children of {@code parentKey}, the parent id or FQN the
   * propagation matched children on.
   */
  public static void watch(String taskId, String parentKey, TaskAwaiter awaiter) {
    watch(taskId, parentKey, awaiter, WATCHERS, SearchIndexRetryQueue::enqueueParent);
  }

  static void watch(
      String taskId,
      String parentKey,
      TaskAwaiter awaiter,
      Executor executor,
      BiConsumer<String, String> repairParent) {
    if (taskId != null && parentKey != null) {
      executor.execute(() -> repairIfStale(taskId, parentKey, awaiter, repairParent));
    }
  }

  private static void repairIfStale(
      String taskId,
      String parentKey,
      TaskAwaiter awaiter,
      BiConsumer<String, String> repairParent) {
    try {
      TaskOutcome outcome = awaiter.await(taskId);
      if (outcome.leftChildrenStale()) {
        LOG.warn(
            "Child propagation task {} for parent {} left children stale ({}); reindexing them",
            taskId,
            parentKey,
            outcome.describe());
        repairParent.accept(parentKey, "updateChildren: %s".formatted(outcome.describe()));
      }
    } catch (IOException | RuntimeException e) {
      LOG.warn(
          "Could not learn how child propagation task {} for parent {} ended: {}",
          taskId,
          parentKey,
          e.getMessage());
    }
  }
}
