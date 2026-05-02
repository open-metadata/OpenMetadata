/*
 *  Copyright 2024 Collate
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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import org.awaitility.Awaitility;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Abstract base class for all search index integration test suites.
 *
 * <p>Provides shared helpers for triggering and waiting on the SearchIndexingApplication,
 * polling run stats, counting documents in a search index, and running a health probe
 * in the background during long-running operations.
 */
public abstract class SearchIndexTestBase {

  protected static final String APP_NAME = "SearchIndexingApplication";
  protected static final String TRIGGER_URL = "/v1/apps/trigger/" + APP_NAME;
  protected static final String STOP_URL = "/v1/apps/stop/" + APP_NAME;
  protected static final String LATEST_RUN_URL = "/v1/apps/name/" + APP_NAME + "/runs/latest";
  protected static final String HEALTH_URL = "/v1/system/health";

  private static final ObjectMapper MAPPER = new ObjectMapper();

  record HealthProbeHandle(
      ScheduledFuture<?> future,
      ScheduledExecutorService scheduler,
      AtomicInteger failureCount,
      AtomicLong maxResponseMs) {}

  protected void triggerApp(Map<String, Object> config) {
    Awaitility.await("Trigger SearchIndexingApplication")
        .atMost(Duration.ofMinutes(2))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptionsMatching(
            e -> e.getMessage() != null && e.getMessage().contains("already running"))
        .until(
            () -> {
              SdkClients.adminClient()
                  .getHttpClient()
                  .execute(HttpMethod.POST, TRIGGER_URL, config, Void.class);
              return true;
            });
  }

  protected void waitForIdle() {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();
    Awaitility.await("Wait for SearchIndexingApplication to reach idle/terminal state")
        .atMost(Duration.ofMinutes(3))
        .pollInterval(Duration.ofSeconds(3))
        .ignoreExceptions()
        .until(
            () -> {
              AppRunRecord run =
                  httpClient.execute(HttpMethod.GET, LATEST_RUN_URL, null, AppRunRecord.class);
              if (run == null || run.getStatus() == null) {
                return true;
              }
              String status = run.getStatus().value();
              return "success".equals(status)
                  || "failed".equals(status)
                  || "completed".equals(status)
                  || "stopped".equals(status);
            });
  }

  protected AppRunRecord waitForTerminal(Duration maxWait) {
    HttpClient httpClient = SdkClients.adminClient().getHttpClient();
    AtomicReference<AppRunRecord> lastRecord = new AtomicReference<>();

    Awaitility.await("Wait for SearchIndexingApplication terminal status")
        .atMost(maxWait)
        .pollInterval(Duration.ofSeconds(3))
        .ignoreExceptions()
        .until(
            () -> {
              AppRunRecord run =
                  httpClient.execute(HttpMethod.GET, LATEST_RUN_URL, null, AppRunRecord.class);
              if (run != null) {
                lastRecord.set(run);
              }
              if (run == null || run.getStatus() == null) {
                return false;
              }
              String status = run.getStatus().value();
              return "success".equals(status)
                  || "failed".equals(status)
                  || "completed".equals(status)
                  || "stopped".equals(status);
            });

    return lastRecord.get();
  }

  protected AppRunRecord triggerAndWait(Map<String, Object> config, Duration maxWait) {
    waitForIdle();
    triggerApp(config);
    return waitForTerminal(maxWait);
  }

  protected void stopApp() {
    try {
      SdkClients.adminClient().getHttpClient().execute(HttpMethod.POST, STOP_URL, null, Void.class);
    } catch (Exception ignored) {
    }
  }

  protected Stats extractStats(AppRunRecord run) {
    if (run == null) {
      return null;
    }
    if (run.getSuccessContext() == null) {
      return null;
    }
    return run.getSuccessContext().getStats();
  }

  protected long countInSearchIndex(String indexName) throws Exception {
    String url = "/v1/search/query?q=*&index=" + indexName + "&from=0&size=0&trackTotalHits=true";
    String response =
        SdkClients.adminClient().getHttpClient().executeForString(HttpMethod.GET, url, null);
    JsonNode root = MAPPER.readTree(response);
    return root.path("hits").path("total").path("value").asLong(0);
  }

  protected Map<String, Object> nonDistributedConfig(int batchSize) {
    return Map.of("batchSize", batchSize, "useDistributedIndexing", false, "recreateIndex", false);
  }

  protected Map<String, Object> distributedConfig(int batchSize) {
    return Map.of("batchSize", batchSize, "useDistributedIndexing", true, "recreateIndex", false);
  }

  protected Map<String, Object> autoTuneConfig(boolean distributed) {
    return Map.of("autoTune", true, "useDistributedIndexing", distributed, "recreateIndex", false);
  }

  protected HealthProbeHandle startHealthProbe() {
    AtomicInteger failureCount = new AtomicInteger(0);
    AtomicLong maxResponseMs = new AtomicLong(0);
    ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    ScheduledFuture<?> future =
        scheduler.scheduleAtFixedRate(
            () -> {
              long start = System.currentTimeMillis();
              try {
                SdkClients.adminClient()
                    .getHttpClient()
                    .executeForString(HttpMethod.GET, HEALTH_URL, null);
                long elapsed = System.currentTimeMillis() - start;
                maxResponseMs.updateAndGet(prev -> Math.max(prev, elapsed));
                if (elapsed > 1000) {
                  failureCount.incrementAndGet();
                }
              } catch (Exception e) {
                long elapsed = System.currentTimeMillis() - start;
                maxResponseMs.updateAndGet(prev -> Math.max(prev, elapsed));
                failureCount.incrementAndGet();
              }
            },
            0,
            30,
            TimeUnit.SECONDS);

    return new HealthProbeHandle(future, scheduler, failureCount, maxResponseMs);
  }

  protected void stopHealthProbeAndAssert(HealthProbeHandle handle) {
    handle.future().cancel(false);
    handle.scheduler().shutdown();
    assertEquals(
        0,
        handle.failureCount().get(),
        "Health probe had "
            + handle.failureCount().get()
            + " violations. Max response time: "
            + handle.maxResponseMs().get()
            + "ms");
  }
}
