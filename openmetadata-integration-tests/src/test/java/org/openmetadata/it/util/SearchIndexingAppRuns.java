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
package org.openmetadata.it.util;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.awaitility.Awaitility;
import org.awaitility.core.ConditionTimeoutException;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;

/** Triggers the search indexing application and waits for the run it started. */
public final class SearchIndexingAppRuns {
  public static final String APP_NAME = "SearchIndexingApplication";
  private static final Set<String> SUCCESS_STATUSES = Set.of("success", "completed");
  private static final Set<String> TERMINAL_STATUSES =
      Set.of("success", "completed", "failed", "activeerror", "stopped");
  private static final Set<String> IN_FLIGHT_STATUSES = Set.of("running", "started");

  private SearchIndexingAppRuns() {}

  /** Waits out any in-flight run, starts one with {@code config} and returns it once successful. */
  public static AppRunRecord runToSuccess(
      final HttpClient httpClient, final Map<String, Object> config) {
    awaitIdle(httpClient);
    final Long previousStartTime = latestRunStartTime(httpClient);
    trigger(httpClient, config);
    return awaitSuccessfulRunAfter(httpClient, previousStartTime);
  }

  private static void trigger(final HttpClient httpClient, final Map<String, Object> config) {
    Awaitility.await("Trigger " + APP_NAME)
        .atMost(Duration.ofMinutes(2))
        .pollInterval(Duration.ofSeconds(3))
        .ignoreExceptionsMatching(
            failure ->
                failure.getMessage() != null && failure.getMessage().contains("already running"))
        .until(
            () -> {
              httpClient.execute(
                  HttpMethod.POST, "/v1/apps/trigger/" + APP_NAME, config, Void.class);
              return true;
            });
  }

  private static AppRunRecord awaitSuccessfulRunAfter(
      final HttpClient httpClient, final Long previousStartTime) {
    final AppRunRecord[] holder = new AppRunRecord[1];
    Awaitility.await(APP_NAME + " run completion")
        .atMost(Duration.ofMinutes(5))
        .pollDelay(Duration.ofSeconds(2))
        .pollInterval(Duration.ofSeconds(5))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              final AppRunRecord run = latestRun(httpClient);
              assertNotNull(run);
              assertNotNull(run.getStatus());
              assertTrue(
                  previousStartTime == null
                      || run.getStartTime() == null
                      || run.getStartTime() > previousStartTime,
                  "Latest run is still the one before the trigger");
              assertTrue(
                  TERMINAL_STATUSES.contains(status(run)), "Run not finished: " + status(run));
              holder[0] = run;
            });
    final AppRunRecord run = holder[0];
    assertTrue(
        SUCCESS_STATUSES.contains(status(run)),
        () -> "Expected a successful " + APP_NAME + " run but got: " + run);
    return run;
  }

  private static Long latestRunStartTime(final HttpClient httpClient) {
    try {
      final AppRunRecord latest = latestRun(httpClient);
      return latest == null ? null : latest.getStartTime();
    } catch (RuntimeException noRunYet) {
      return null;
    }
  }

  private static void awaitIdle(final HttpClient httpClient) {
    try {
      Awaitility.await("In-flight " + APP_NAME)
          .atMost(Duration.ofMinutes(5))
          .pollInterval(Duration.ofSeconds(3))
          .ignoreExceptions()
          .until(
              () -> {
                final AppRunRecord latest = latestRun(httpClient);
                return latest == null
                    || latest.getStatus() == null
                    || !IN_FLIGHT_STATUSES.contains(status(latest));
              });
    } catch (ConditionTimeoutException stillRunning) {
      // The trigger retries on "already running" while that run finishes.
    }
  }

  private static AppRunRecord latestRun(final HttpClient httpClient) {
    return httpClient.execute(
        HttpMethod.GET, "/v1/apps/name/" + APP_NAME + "/runs/latest", null, AppRunRecord.class);
  }

  private static String status(final AppRunRecord run) {
    return run.getStatus().value().toLowerCase(Locale.ROOT);
  }
}
