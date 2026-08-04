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

package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

class SparqlQueryExecutionGuardTest {

  @Test
  void rejectsQueriesAboveTheActiveCapacity() throws Exception {
    try (ExecutorService queryExecutor = Executors.newVirtualThreadPerTaskExecutor();
        ExecutorService callerExecutor = Executors.newVirtualThreadPerTaskExecutor()) {
      SparqlQueryExecutionGuard guard =
          new SparqlQueryExecutionGuard(1, 1, 1, 1_000, queryExecutor);
      CountDownLatch started = new CountDownLatch(1);
      CountDownLatch release = new CountDownLatch(1);
      CompletableFuture<String> active =
          CompletableFuture.supplyAsync(
              () -> guard.execute("principal", () -> awaitRelease(started, release)),
              callerExecutor);

      assertTrue(started.await(1, TimeUnit.SECONDS));
      assertThrows(
          SparqlQueryExecutionGuard.QueryCapacityException.class,
          () -> guard.execute("principal", () -> "second"));
      release.countDown();
      assertEquals("finished", active.get(1, TimeUnit.SECONDS));
    }
  }

  @Test
  void interruptsQueriesAtTheRuntimeDeadline() {
    try (ExecutorService queryExecutor = Executors.newVirtualThreadPerTaskExecutor()) {
      SparqlQueryExecutionGuard guard = new SparqlQueryExecutionGuard(1, 1, 1, 25, queryExecutor);
      CountDownLatch release = new CountDownLatch(1);

      assertThrows(
          SparqlQueryExecutionGuard.QueryTimeoutException.class,
          () -> guard.execute("principal", () -> awaitRelease(new CountDownLatch(0), release)));
    }
  }

  @Test
  void releasesCapacityWhenTheExecutorRejectsSubmission() {
    try (ExecutorService queryExecutor = Executors.newSingleThreadExecutor()) {
      queryExecutor.shutdown();
      SparqlQueryExecutionGuard guard =
          new SparqlQueryExecutionGuard(1, 1, 1, 1_000, queryExecutor);

      assertThrows(
          RejectedExecutionException.class, () -> guard.execute("principal", () -> "first"));
      assertThrows(
          RejectedExecutionException.class, () -> guard.execute("principal", () -> "second"));
    }
  }

  private static String awaitRelease(final CountDownLatch started, final CountDownLatch release) {
    started.countDown();
    try {
      release.await();
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
    }
    return "finished";
  }
}
