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

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class SingleFlightTest {

  private static final Duration WAIT = Duration.ofSeconds(10);
  private static final int CALLERS = 8;

  private final SingleFlight<String, String> flights = new SingleFlight<>();

  @Test
  void concurrentCallersForOneKeyShareOneRun() throws Exception {
    AtomicInteger runs = new AtomicInteger();
    CountDownLatch release = new CountDownLatch(1);
    ConcurrentLinkedQueue<String> results = new ConcurrentLinkedQueue<>();
    List<Thread> callers = new ArrayList<>();
    for (int i = 0; i < CALLERS; i++) {
      callers.add(
          Thread.ofVirtual()
              .start(
                  () ->
                      results.add(
                          runQuietly(
                              () -> {
                                runs.incrementAndGet();
                                release.await();
                                return "loaded";
                              }))));
    }
    awaitAllParked(callers);
    release.countDown();
    joinAll(callers);

    assertEquals(1, runs.get(), "callers that miss together must share a single load");
    assertEquals(CALLERS, results.size());
    results.forEach(result -> assertEquals("loaded", result));
  }

  @Test
  void aFailedRunSurfacesItsExceptionAndLetsTheNextCallRunAgain() throws Exception {
    IllegalStateException failure = new IllegalStateException("db down");

    ExecutionException thrown =
        assertThrows(
            ExecutionException.class,
            () ->
                flights.run(
                    "key",
                    () -> {
                      throw failure;
                    }));

    assertSame(failure, thrown.getCause(), "callers must see the task's own exception");
    assertEquals("recovered", flights.run("key", () -> "recovered"));
  }

  @Test
  void anErrorStillReleasesTheKey() throws Exception {
    assertThrows(
        AssertionError.class,
        () ->
            flights.run(
                "key",
                () -> {
                  throw new AssertionError("boom");
                }));

    assertEquals("recovered", flights.run("key", () -> "recovered"));
  }

  @Test
  void aRecursiveRunOfTheSameKeyFailsInsteadOfWaitingOnItself() {
    ExecutionException thrown =
        assertThrows(
            ExecutionException.class, () -> flights.run("key", () -> flights.run("key", () -> "")));

    assertEquals(IllegalStateException.class, thrown.getCause().getClass());
  }

  private String runQuietly(Callable<String> task) {
    try {
      return flights.run("key", task);
    } catch (ExecutionException e) {
      throw new IllegalStateException(e);
    }
  }

  // Parked means each caller is either the leader waiting on the release or a follower waiting on
  // the leader's result, so every caller has joined the flight before it is released.
  private static void awaitAllParked(List<Thread> callers) {
    await()
        .atMost(WAIT)
        .until(
            () -> callers.stream().allMatch(caller -> caller.getState() == Thread.State.WAITING));
  }

  private static void joinAll(List<Thread> callers) throws InterruptedException {
    for (Thread caller : callers) {
      caller.join(WAIT);
    }
  }
}
