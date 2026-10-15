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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.events.lifecycle.OrderedLaneExecutor.LaneOverflowShedException;
import org.openmetadata.service.events.lifecycle.OrderedLaneExecutor.OrderedTask;

class KeyedTaskRunnerTest {
  private static final UUID FIRST = UUID.randomUUID();
  private static final UUID SECOND = UUID.randomUUID();

  private final List<Throwable> failures = new CopyOnWriteArrayList<>();
  private final CountDownLatch release = new CountDownLatch(1);
  private KeyedTaskRunner runner =
      new KeyedTaskRunner((task, failure) -> failures.add(failure), 4, 100, 5);

  @AfterEach
  void releaseAndClose() {
    release.countDown();
    runner.close();
  }

  @Test
  void aKeysTasksRunInTheOrderTheyWereSubmitted() throws InterruptedException {
    final List<Integer> ran = new CopyOnWriteArrayList<>();
    for (int index = 0; index < 50; index++) {
      final int position = index;
      runner.submit(FIRST, () -> ran.add(position));
    }

    assertTrue(runner.awaitQueuedTasks(Duration.ofSeconds(10)));
    assertEquals(java.util.stream.IntStream.range(0, 50).boxed().toList(), ran);
  }

  @Test
  void aSlowTaskHoldsUpOnlyItsOwnKey() throws InterruptedException {
    final CountDownLatch started = new CountDownLatch(1);
    final CountDownLatch otherKeyRan = new CountDownLatch(1);
    final List<String> ran = new CopyOnWriteArrayList<>();
    runner.submit(FIRST, blockingTask(started));
    runner.submit(FIRST, () -> ran.add("behind the slow task"));
    assertTrue(started.await(10, TimeUnit.SECONDS));

    runner.submit(SECOND, otherKeyRan::countDown);

    assertTrue(otherKeyRan.await(10, TimeUnit.SECONDS), "another key's task does not wait");
    assertEquals(List.of(), ran, "the slow key's later task still waits its turn");
    release.countDown();
    assertTrue(runner.awaitQueuedTasks(Duration.ofSeconds(10)));
    assertEquals(List.of("behind the slow task"), ran);
  }

  @Test
  void waitingForQueuedTasksIncludesOnesStillRunning() throws InterruptedException {
    final CountDownLatch started = new CountDownLatch(1);
    runner.submit(FIRST, blockingTask(started));
    assertTrue(started.await(10, TimeUnit.SECONDS));

    assertFalse(runner.awaitQueuedTasks(Duration.ofMillis(200)));
    release.countDown();
    assertTrue(runner.awaitQueuedTasks(Duration.ofSeconds(10)));
  }

  @Test
  void aTaskKnowsItIsRunningOnTheRunner() throws InterruptedException {
    final List<Boolean> inside = new CopyOnWriteArrayList<>();
    runner.submit(FIRST, () -> inside.add(runner.isRunningTask()));

    assertTrue(runner.awaitQueuedTasks(Duration.ofSeconds(10)));
    assertEquals(List.of(true), inside);
    assertFalse(runner.isRunningTask());
  }

  @Test
  void aFullRunnerShedsLocatedTasksToTheFailureHandler() throws InterruptedException {
    runner.close();
    runner = new KeyedTaskRunner((task, failure) -> failures.add(failure), 4, 1, 5);
    final CountDownLatch started = new CountDownLatch(1);
    runner.submit(FIRST, blockingTask(started));
    assertTrue(started.await(10, TimeUnit.SECONDS));

    runner.submit(SECOND, locatedTask());

    assertEquals(1, failures.size());
    assertInstanceOf(LaneOverflowShedException.class, failures.getFirst());
  }

  @Test
  void closingHandsTasksThatDidNotRunToTheFailureHandler() throws InterruptedException {
    runner.close();
    runner = new KeyedTaskRunner((task, failure) -> failures.add(failure), 4, 100, 0);
    final CountDownLatch started = new CountDownLatch(1);
    runner.submit(FIRST, blockingTask(started));
    runner.submit(FIRST, locatedTask());
    assertTrue(started.await(10, TimeUnit.SECONDS));

    runner.close();

    assertEquals(1, failures.size());
    assertInstanceOf(LaneOverflowShedException.class, failures.getFirst());
  }

  @Test
  void aFailingTaskGoesToTheFailureHandlerAndTheKeyCarriesOn() throws InterruptedException {
    final IllegalStateException failure = new IllegalStateException("search is down");
    final List<String> ran = new CopyOnWriteArrayList<>();
    runner.submit(
        FIRST,
        () -> {
          throw failure;
        });
    runner.submit(FIRST, () -> ran.add("next"));

    assertTrue(runner.awaitQueuedTasks(Duration.ofSeconds(10)));
    assertEquals(List.of(failure), failures);
    assertEquals(List.of("next"), ran);
  }

  private OrderedTask blockingTask(final CountDownLatch started) {
    return () -> {
      started.countDown();
      release.await();
    };
  }

  private static OrderedLaneTask locatedTask() {
    return new OrderedLaneTask(
        () -> {}, "updateChildren", UUID.randomUUID().toString(), "fqn", "table");
  }
}
