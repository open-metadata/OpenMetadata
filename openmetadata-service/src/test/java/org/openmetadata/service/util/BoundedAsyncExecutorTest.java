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
package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;

class BoundedAsyncExecutorTest {
  private static final Duration TEST_TIMEOUT = Duration.ofSeconds(10);

  @Test
  void capsConcurrencyAndQueuesExcessTasks() throws InterruptedException {
    ExecutorService delegate = Executors.newVirtualThreadPerTaskExecutor();
    BoundedAsyncExecutor executor = new BoundedAsyncExecutor(delegate, 2);
    CountDownLatch release = new CountDownLatch(1);
    CountDownLatch completed = new CountDownLatch(3);
    AtomicInteger started = new AtomicInteger();

    try {
      for (int index = 0; index < 3; index++) {
        executor.execute(blockingTask(started, release, completed));
      }

      Awaitility.await()
          .atMost(TEST_TIMEOUT)
          .until(() -> executor.getActiveCount() == 2 && executor.getQueuedCount() == 1);
      assertEquals(2, started.get());

      release.countDown();
      assertTrue(completed.await(TEST_TIMEOUT.toSeconds(), TimeUnit.SECONDS));
      awaitEmpty(executor);
    } finally {
      release.countDown();
      executor.shutdownNow();
    }
  }

  @Test
  void releasesPermitWhenTaskThrows() throws Exception {
    ExecutorService delegate = Executors.newVirtualThreadPerTaskExecutor();
    BoundedAsyncExecutor executor = new BoundedAsyncExecutor(delegate, 1);
    CountDownLatch followUpRan = new CountDownLatch(1);

    try {
      Future<?> failedTask =
          executor.submit(
              () -> {
                throw new IllegalStateException("boom");
              });
      assertThrows(
          ExecutionException.class,
          () -> failedTask.get(TEST_TIMEOUT.toSeconds(), TimeUnit.SECONDS));

      executor.execute(followUpRan::countDown);
      assertTrue(followUpRan.await(TEST_TIMEOUT.toSeconds(), TimeUnit.SECONDS));
      awaitEmpty(executor);
    } finally {
      executor.shutdownNow();
    }
  }

  @Test
  void interruptedPermitWaitCancelsSubmittedFuture() throws InterruptedException {
    ConcurrentLinkedQueue<Thread> delegateThreads = new ConcurrentLinkedQueue<>();
    ExecutorService delegate =
        Executors.newThreadPerTaskExecutor(
            runnable -> {
              Thread thread = Thread.ofVirtual().unstarted(runnable);
              delegateThreads.add(thread);
              return thread;
            });
    BoundedAsyncExecutor executor = new BoundedAsyncExecutor(delegate, 1);
    CountDownLatch firstStarted = new CountDownLatch(1);
    CountDownLatch releaseFirst = new CountDownLatch(1);
    AtomicInteger queuedTaskRuns = new AtomicInteger();

    try {
      executor.submit(
          () -> {
            firstStarted.countDown();
            awaitLatch(releaseFirst);
          });
      assertTrue(firstStarted.await(TEST_TIMEOUT.toSeconds(), TimeUnit.SECONDS));

      Future<?> queuedTask = executor.submit(queuedTaskRuns::incrementAndGet);
      Awaitility.await().atMost(TEST_TIMEOUT).until(() -> executor.getQueuedCount() == 1);

      List<Thread> threads = new ArrayList<>(delegateThreads);
      threads.get(1).interrupt();

      Awaitility.await().atMost(TEST_TIMEOUT).until(queuedTask::isCancelled);
      assertThrows(CancellationException.class, queuedTask::get);
      assertEquals(0, queuedTaskRuns.get());
    } finally {
      releaseFirst.countDown();
      executor.shutdownNow();
    }
  }

  @Test
  void shutdownNowCancelsAndReturnsTasksThatNeverStarted() throws InterruptedException {
    ExecutorService delegate = Executors.newSingleThreadExecutor(Thread.ofVirtual().factory());
    BoundedAsyncExecutor executor = new BoundedAsyncExecutor(delegate, 1);
    CountDownLatch firstStarted = new CountDownLatch(1);
    CountDownLatch releaseFirst = new CountDownLatch(1);

    try {
      executor.submit(
          () -> {
            firstStarted.countDown();
            awaitLatch(releaseFirst);
          });
      assertTrue(firstStarted.await(TEST_TIMEOUT.toSeconds(), TimeUnit.SECONDS));

      Future<?> queuedTask = executor.submit(() -> {});
      List<Runnable> pendingTasks = executor.shutdownNow();

      assertTrue(queuedTask.isCancelled());
      assertEquals(1, pendingTasks.size());
      assertSame(queuedTask, pendingTasks.getFirst());
    } finally {
      releaseFirst.countDown();
      executor.shutdownNow();
    }
  }

  @Test
  void fairSemaphoreRunsQueuedTasksInOrder() throws InterruptedException {
    ExecutorService delegate = Executors.newVirtualThreadPerTaskExecutor();
    BoundedAsyncExecutor executor = new BoundedAsyncExecutor(delegate, 1);
    ConcurrentLinkedQueue<Integer> completionOrder = new ConcurrentLinkedQueue<>();
    CountDownLatch releaseFirst = new CountDownLatch(1);
    CountDownLatch completed = new CountDownLatch(3);

    try {
      executor.execute(orderedTask(1, releaseFirst, completionOrder, completed));
      Awaitility.await().atMost(TEST_TIMEOUT).until(() -> executor.getActiveCount() == 1);
      executor.execute(orderedTask(2, null, completionOrder, completed));
      Awaitility.await().atMost(TEST_TIMEOUT).until(() -> executor.getQueuedCount() == 1);
      executor.execute(orderedTask(3, null, completionOrder, completed));
      Awaitility.await().atMost(TEST_TIMEOUT).until(() -> executor.getQueuedCount() == 2);

      releaseFirst.countDown();
      assertTrue(completed.await(TEST_TIMEOUT.toSeconds(), TimeUnit.SECONDS));
      assertEquals(List.of(1, 2, 3), new ArrayList<>(completionOrder));
    } finally {
      releaseFirst.countDown();
      executor.shutdownNow();
    }
  }

  private static Runnable blockingTask(
      AtomicInteger started, CountDownLatch release, CountDownLatch completed) {
    return () -> {
      started.incrementAndGet();
      try {
        awaitLatch(release);
      } finally {
        completed.countDown();
      }
    };
  }

  private static Runnable orderedTask(
      int value,
      CountDownLatch release,
      ConcurrentLinkedQueue<Integer> completionOrder,
      CountDownLatch completed) {
    return () -> {
      if (release != null) {
        awaitLatch(release);
      }
      completionOrder.add(value);
      completed.countDown();
    };
  }

  private static void awaitEmpty(BoundedAsyncExecutor executor) {
    Awaitility.await()
        .atMost(TEST_TIMEOUT)
        .until(() -> executor.getActiveCount() == 0 && executor.getQueuedCount() == 0);
  }

  private static void awaitLatch(CountDownLatch latch) {
    try {
      latch.await();
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new RuntimeException(e);
    }
  }
}
