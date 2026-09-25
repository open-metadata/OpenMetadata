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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.monitoring.RequestLatencyContext;

class LineageSceneTasksTest {
  @Test
  void timeoutInterruptsRunningTaskAndRetainsCompletedResults() {
    CountDownLatch interrupted = new CountDownLatch(1);
    CountDownLatch blocked = new CountDownLatch(1);
    assertTimeoutPreemptively(
        Duration.ofSeconds(5),
        () -> {
          List<String> results =
              LineageSceneTasks.runBounded(
                  List.of(
                      () -> "completed",
                      () -> {
                        try {
                          blocked.await();
                        } catch (InterruptedException exception) {
                          interrupted.countDown();
                          Thread.currentThread().interrupt();
                        }
                        return "cancelled";
                      }),
                  2,
                  Duration.ofMillis(200));

          assertEquals(List.of("completed"), results);
          assertTrue(interrupted.await(1, TimeUnit.SECONDS));
        });
  }

  @Test
  void timeoutDoesNotWaitForUninterruptibleSearchClient() {
    CountDownLatch release = new CountDownLatch(1);
    CountDownLatch finished = new CountDownLatch(1);
    try {
      assertTimeoutPreemptively(
          Duration.ofSeconds(5),
          () ->
              assertTrue(
                  LineageSceneTasks.runBounded(
                          List.of(
                              () -> {
                                boolean released = false;
                                while (!released) {
                                  try {
                                    release.await();
                                    released = true;
                                  } catch (InterruptedException ignored) {
                                    // Simulates an HTTP client that cannot interrupt a pending
                                    // request.
                                  }
                                }
                                finished.countDown();
                                return "late";
                              }),
                          1,
                          Duration.ofMillis(200))
                      .isEmpty()));
    } finally {
      release.countDown();
    }
    assertTimeoutPreemptively(Duration.ofSeconds(2), () -> finished.await());
  }

  @Test
  void callerInterruptionIsPreserved() {
    assertTimeoutPreemptively(
        Duration.ofSeconds(5),
        () -> {
          Thread.currentThread().interrupt();
          try {
            assertThrows(
                IOException.class, () -> LineageSceneTasks.runBounded(List.of(() -> "unused"), 1));
            assertTrue(Thread.currentThread().isInterrupted());
          } finally {
            Thread.interrupted();
          }
        });
  }

  @Test
  void requiredTaskFailurePropagatesItsIoCause() {
    IOException failure = new IOException("search unavailable");
    assertSame(
        failure,
        assertThrows(
            IOException.class,
            () ->
                LineageSceneTasks.runBounded(
                    List.of(
                        () -> {
                          throw failure;
                        }),
                    1)));
  }

  @Test
  void boundedWorkersPreserveSubmissionOrderAndRequestContext() throws IOException {
    RequestLatencyContext.startRequest("lineage-scene", "GET");
    try {
      var context = RequestLatencyContext.getContext();
      assertEquals(
          List.of("first", "second"),
          LineageSceneTasks.runBounded(
              List.of(
                  () -> {
                    assertSame(context, RequestLatencyContext.getContext());
                    return "first";
                  },
                  () -> {
                    assertSame(context, RequestLatencyContext.getContext());
                    return "second";
                  }),
              1));
      assertSame(context, RequestLatencyContext.getContext());
    } finally {
      RequestLatencyContext.clearContext();
    }
  }
}
