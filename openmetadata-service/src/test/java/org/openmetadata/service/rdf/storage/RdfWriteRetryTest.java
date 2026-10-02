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
package org.openmetadata.service.rdf.storage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.net.ConnectException;
import java.net.http.HttpConnectTimeoutException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import org.apache.jena.atlas.web.HttpException;
import org.junit.jupiter.api.Test;

class RdfWriteRetryTest {
  private static final RdfWriteRetry.Policy POLICY = new RdfWriteRetry.Policy(2, 250, 2000, 60_000);
  private static final RdfWriteRetry.Circuit CIRCUIT =
      new RdfWriteRetry.Circuit(() -> {}, () -> {}, () -> {}, () -> false);

  @Test
  void aPreConnectionFailureCanBeRetriedWithBoundedBackoff() {
    for (Exception failure :
        List.of(new ConnectException("refused"), new HttpConnectTimeoutException("connect"))) {
      final AtomicInteger attempts = new AtomicInteger();
      final AtomicLong delay = new AtomicLong();
      RdfWriteRetry.run(
          remainingMillis -> {
            if (attempts.incrementAndGet() < 3) {
              throw new IllegalStateException(failure);
            }
          },
          "write",
          POLICY,
          CIRCUIT,
          delay::addAndGet);
      assertEquals(3, attempts.get());
      assertEquals(750, delay.get());
    }
  }

  @Test
  void aTimeoutOrGatewayFailureIsNeverReplayed() {
    for (Exception failure :
        List.of(
            new TimeoutException(),
            new HttpException(502, "gateway"),
            new HttpException(500, "server"))) {
      final AtomicInteger attempts = new AtomicInteger();
      final AtomicLong delay = new AtomicLong();
      assertThrows(
          RdfWriteOutcomeUnknownException.class,
          () ->
              RdfWriteRetry.run(
                  remainingMillis -> {
                    attempts.incrementAndGet();
                    throw new IllegalStateException(failure);
                  },
                  "write",
                  POLICY,
                  CIRCUIT,
                  delay::addAndGet));
      assertEquals(1, attempts.get());
      assertEquals(0, delay.get());
    }
  }

  @Test
  void nonTransientValidationFailuresRemainUnchanged() {
    final IllegalArgumentException failure = new IllegalArgumentException("invalid RDF");
    assertSame(
        failure,
        assertThrows(
            IllegalArgumentException.class,
            () ->
                RdfWriteRetry.run(
                    remainingMillis -> {
                      throw failure;
                    },
                    "write",
                    POLICY,
                    CIRCUIT,
                    ignored -> {})));
  }

  @Test
  void retryDelayCannotConsumeTheRemainingOperationBudget() {
    final AtomicInteger attempts = new AtomicInteger();
    final AtomicLong delay = new AtomicLong();
    assertThrows(
        IllegalStateException.class,
        () ->
            RdfWriteRetry.run(
                remainingMillis -> {
                  attempts.incrementAndGet();
                  throw new IllegalStateException(new ConnectException("refused"));
                },
                "write",
                new RdfWriteRetry.Policy(5, 1000, 2000, 1),
                CIRCUIT,
                delay::addAndGet));
    assertEquals(1, attempts.get());
    assertEquals(0, delay.get());
  }

  @Test
  void openCircuitStopsTheRetryCascade() {
    final AtomicInteger failures = new AtomicInteger();
    final RdfWriteRetry.Circuit circuit =
        new RdfWriteRetry.Circuit(
            () -> {}, () -> {}, failures::incrementAndGet, () -> failures.get() > 0);
    assertThrows(
        RdfStorageCircuitOpenException.class,
        () ->
            RdfWriteRetry.run(
                remainingMillis -> {
                  throw new IllegalStateException(new ConnectException("refused"));
                },
                "write",
                POLICY,
                circuit,
                ignored -> {}));
    assertEquals(1, failures.get());
    assertEquals(2000, new RdfWriteRetry.Policy(50, Long.MAX_VALUE, 2000, 10000).backoff(30));
  }

  @Test
  void laterAttemptsReceiveOnlyTheRemainingBudget() {
    final AtomicLong elapsed = new AtomicLong();
    final List<Long> budgets = new ArrayList<>();
    RdfWriteRetry.run(
        remainingMillis -> {
          budgets.add(remainingMillis);
          if (budgets.size() == 1) {
            elapsed.addAndGet(TimeUnit.SECONDS.toNanos(10));
            throw new IllegalStateException(new ConnectException("refused"));
          }
        },
        "write",
        POLICY,
        CIRCUIT,
        millis -> elapsed.addAndGet(TimeUnit.MILLISECONDS.toNanos(millis)),
        elapsed::get);
    assertEquals(List.of(60_000L, 49_750L), budgets);
  }
}
