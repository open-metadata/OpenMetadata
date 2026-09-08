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

package org.openmetadata.service.lineage;

import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.monitoring.RequestLatencyContext;
import org.openmetadata.service.monitoring.RequestLatencyContext.RequestContext;

@Slf4j
final class LineageSceneTasks {
  private LineageSceneTasks() {}

  private static final Duration LOOKUP_TIMEOUT = Duration.ofSeconds(15);

  static <T> IOTask<T> bestEffortTask(String description, IOTask<T> task) {
    return () -> {
      try {
        return task.call();
      } catch (IOException exception) {
        LOG.warn("Failed to load {}; skipping result: {}", description, exception.getMessage());
        return null;
      }
    };
  }

  static <T> List<T> runBounded(List<IOTask<T>> tasks, int parallelism) throws IOException {
    return runBounded(tasks, parallelism, LOOKUP_TIMEOUT);
  }

  static <T> List<T> runBounded(List<IOTask<T>> tasks, int parallelism, Duration timeout)
      throws IOException {
    if (tasks.isEmpty()) {
      return List.of();
    }
    ExecutorService executor =
        Executors.newFixedThreadPool(Math.max(1, parallelism), Thread.ofVirtual().factory());
    try {
      List<Callable<T>> contextualTasks =
          tasks.stream().map(LineageSceneTasks::withContext).toList();
      return completedResults(
          executor.invokeAll(contextualTasks, timeout.toNanos(), TimeUnit.NANOSECONDS));
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
      throw new IOException("Interrupted while building a lineage scene", exception);
    } finally {
      // close() waits for every worker, including search clients that ignore interruption.
      executor.shutdownNow();
    }
  }

  private static <T> Callable<T> withContext(IOTask<T> task) {
    RequestContext context = RequestLatencyContext.getContext();
    return () -> {
      RequestLatencyContext.setContext(context);
      try {
        return task.call();
      } finally {
        RequestLatencyContext.clearContext();
      }
    };
  }

  private static <T> List<T> completedResults(List<Future<T>> futures)
      throws IOException, InterruptedException {
    List<T> results = new ArrayList<>();
    for (Future<T> future : futures) {
      if (future.isCancelled()) {
        LOG.warn("Timed out while building a lineage scene; skipping result");
        continue;
      }
      T result = completedResult(future);
      if (result != null) {
        results.add(result);
      }
    }
    return results;
  }

  private static <T> T completedResult(Future<T> future) throws IOException, InterruptedException {
    try {
      return future.get();
    } catch (ExecutionException exception) {
      if (exception.getCause() instanceof IOException ioException) {
        throw ioException;
      }
      throw new IOException("Failed to build a lineage scene", exception.getCause());
    }
  }

  @FunctionalInterface
  interface IOTask<T> {
    T call() throws IOException;
  }
}
