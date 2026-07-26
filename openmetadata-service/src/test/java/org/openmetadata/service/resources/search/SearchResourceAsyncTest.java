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
package org.openmetadata.service.resources.search;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.FutureTask;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.junit.jupiter.api.Test;

class SearchResourceAsyncTest {

  @Test
  void reindexTimeoutStartsAfterWorkerExecutionBegins() throws Exception {
    CountDownLatch executionStarted = new CountDownLatch(1);
    CountDownLatch releaseWorker = new CountDownLatch(1);
    FutureTask<Void> reindexTask =
        new FutureTask<>(
            () -> {
              executionStarted.countDown();
              try {
                releaseWorker.await();
              } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
              }
              return null;
            });
    ExecutorService watchdogExecutor = Executors.newVirtualThreadPerTaskExecutor();
    CountDownLatch watchdogStarted = new CountDownLatch(1);

    try {
      Future<?> watchdog =
          watchdogExecutor.submit(
              () -> {
                watchdogStarted.countDown();
                SearchResource.awaitExecutionStartOrCompletion(executionStarted, reindexTask);
                reindexTask.get(100, TimeUnit.MILLISECONDS);
                return null;
              });
      assertTrue(watchdogStarted.await(5, TimeUnit.SECONDS));

      assertThrows(TimeoutException.class, () -> watchdog.get(250, TimeUnit.MILLISECONDS));
      assertFalse(watchdog.isDone());

      Thread worker = Thread.startVirtualThread(reindexTask);
      ExecutionException exception =
          assertThrows(ExecutionException.class, () -> watchdog.get(5, TimeUnit.SECONDS));
      assertInstanceOf(TimeoutException.class, exception.getCause());

      reindexTask.cancel(true);
      releaseWorker.countDown();
      worker.join(5000);
      assertFalse(worker.isAlive());
    } finally {
      releaseWorker.countDown();
      reindexTask.cancel(true);
      watchdogExecutor.shutdownNow();
    }
  }

  @Test
  void cancellationBeforeExecutionReleasesWaitingWatchdog() throws Exception {
    CountDownLatch executionStarted = new CountDownLatch(1);
    FutureTask<Void> reindexTask = new FutureTask<>(() -> null);
    ExecutorService watchdogExecutor = Executors.newVirtualThreadPerTaskExecutor();

    try {
      Future<?> watchdog =
          watchdogExecutor.submit(
              () -> {
                SearchResource.awaitExecutionStartOrCompletion(executionStarted, reindexTask);
                return null;
              });

      reindexTask.cancel(false);

      watchdog.get(5, TimeUnit.SECONDS);
      assertTrue(reindexTask.isCancelled());
    } finally {
      watchdogExecutor.shutdownNow();
    }
  }
}
