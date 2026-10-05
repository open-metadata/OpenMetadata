/*
 *  Copyright 2025 Collate.
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
package org.openmetadata.service.security.auth;

import static org.awaitility.Awaitility.await;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class TestLoginSessionSweeperTest {
  private static final Duration FAST = Duration.ofMillis(20);

  @Test
  void aFailedSweepDoesNotStopTheOnesAfterIt() {
    AtomicInteger sweeps = new AtomicInteger();
    TestLoginSessionSweeper sweeper =
        new TestLoginSessionSweeper(
            () -> {
              if (sweeps.incrementAndGet() == 1) {
                throw new IllegalStateException("database unavailable");
              }
            },
            FAST);

    sweeper.start();
    try {
      await().atMost(Duration.ofSeconds(10)).until(() -> sweeps.get() >= 3);
    } finally {
      sweeper.stop();
    }
  }

  @Test
  void stoppingASweeperThatNeverStartedIsHarmless() {
    new TestLoginSessionSweeper(() -> {}, FAST).stop();
  }
}
