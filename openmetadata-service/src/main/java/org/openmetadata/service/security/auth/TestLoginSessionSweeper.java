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

import io.dropwizard.lifecycle.Managed;
import java.time.Duration;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;

/**
 * Clears expired Test Login state on a schedule. A pending test holds the candidate's secrets, and a
 * test that is abandoned — its popup closed, its credentials never entered — gets no further
 * request that could clear them. Every server runs one sweep; its statements are idempotent.
 */
@Slf4j
public final class TestLoginSessionSweeper implements Managed {
  private static final Duration SWEEP_INTERVAL = Duration.ofMinutes(1);

  private final Runnable sweep;
  private final Duration interval;
  private ScheduledExecutorService scheduler;

  public TestLoginSessionSweeper() {
    this(() -> JdbiTestLoginSessionStore.fromCollectionDao().removeExpired(), SWEEP_INTERVAL);
  }

  TestLoginSessionSweeper(Runnable sweep, Duration interval) {
    this.sweep = sweep;
    this.interval = interval;
  }

  @Override
  public void start() {
    scheduler =
        Executors.newSingleThreadScheduledExecutor(
            runnable -> {
              Thread thread = new Thread(runnable, "om-test-login-sweeper");
              thread.setDaemon(true);
              return thread;
            });
    long intervalMillis = interval.toMillis();
    scheduler.scheduleWithFixedDelay(
        this::sweepSafely, intervalMillis, intervalMillis, TimeUnit.MILLISECONDS);
  }

  @Override
  public void stop() {
    if (scheduler != null) {
      scheduler.shutdownNow();
    }
  }

  private void sweepSafely() {
    try {
      sweep.run();
    } catch (RuntimeException e) {
      // An exception escaping a scheduled task cancels every later run; the next tick retries.
      LOG.warn("Could not clear expired test logins", e);
    }
  }
}
