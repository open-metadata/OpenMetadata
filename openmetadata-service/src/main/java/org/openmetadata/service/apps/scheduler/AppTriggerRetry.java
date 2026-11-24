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

package org.openmetadata.service.apps.scheduler;

import java.util.function.LongConsumer;
import lombok.extern.slf4j.Slf4j;

/**
 * Triggers an app for a caller that needs the run to happen, retrying with exponential backoff
 * while a run of it is still in progress. Any other failure is not retried.
 */
@Slf4j
public final class AppTriggerRetry {
  private static final int MAX_ATTEMPTS = 5;
  private static final long INITIAL_BACKOFF_MILLIS = 10_000;
  private static final long MAX_BACKOFF_MILLIS = 60_000;

  private AppTriggerRetry() {}

  /** Returns false if the app is still running after the last attempt. */
  public static boolean trigger(String appName, Runnable trigger) {
    return trigger(appName, trigger, AppTriggerRetry::pause);
  }

  static boolean trigger(String appName, Runnable trigger, LongConsumer pause) {
    boolean triggered = tryTrigger(trigger);
    int attempt = 1;
    while (!triggered && attempt < MAX_ATTEMPTS) {
      long backoffMillis =
          Math.min(INITIAL_BACKOFF_MILLIS * (1L << (attempt - 1)), MAX_BACKOFF_MILLIS);
      LOG.warn(
          "App {} is already running. Retrying in {} ms (attempt {}/{})",
          appName,
          backoffMillis,
          attempt,
          MAX_ATTEMPTS);
      pause.accept(backoffMillis);
      triggered = tryTrigger(trigger);
      attempt++;
    }
    if (!triggered) {
      LOG.error("Failed to run app {} after {} attempts: still running", appName, attempt);
    }
    return triggered;
  }

  private static boolean tryTrigger(Runnable trigger) {
    try {
      trigger.run();
      return true;
    } catch (AppAlreadyRunningException e) {
      return false;
    }
  }

  private static void pause(long millis) {
    try {
      Thread.sleep(millis);
    } catch (InterruptedException ie) {
      Thread.currentThread().interrupt();
      throw new RuntimeException("Retry interrupted", ie);
    }
  }
}
