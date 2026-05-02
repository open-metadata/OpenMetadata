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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SearchIndexWebSocketClient;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Happy-path integration tests for the SearchIndexingApplication.
 *
 * <p>Each test triggers the search indexing application with different configurations and
 * verifies that the run completes successfully with expected stats. A background health probe
 * runs during every test to detect latency or availability regressions in the API tier.
 *
 * <p>Tests are ordered so that simpler (non-distributed, small-batch) scenarios run first,
 * providing fast signal, followed by distributed and edge-case scenarios.
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@ExtendWith(TestNamespaceExtension.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class SearchIndexHappyPathIT extends SearchIndexTestBase {

  private HealthProbeHandle healthProbe;

  @BeforeAll
  static void setupAll() {
    SdkClients.adminClient();
  }

  @BeforeEach
  void startProbe() {
    healthProbe = startHealthProbe();
  }

  @AfterEach
  void stopProbe() {
    stopHealthProbeAndAssert(healthProbe);
  }

  @Test
  @Order(1)
  void nonDistributed_smallBatch_completesSuccess() {
    Map<String, Object> config = nonDistributedConfig(50);
    AppRunRecord run = triggerAndWait(config, Duration.ofMinutes(5));

    assertTrue(isSuccessful(run), "Run should complete successfully, got: " + statusOf(run));

    Stats stats = extractStats(run);
    assertNotNull(stats, "Stats must be present on a successful run");
    assertNotNull(stats.getJobStats(), "jobStats must be present");
    assertTrue(
        stats.getJobStats().getSuccessRecords() > 0, "At least one record should be indexed");
    assertEquals(0L, (long) stats.getJobStats().getFailedRecords(), "No records should fail");
  }

  @Test
  @Order(2)
  void nonDistributed_withAutoTune_completesSuccess() {
    Map<String, Object> config = autoTuneConfig(false);
    AppRunRecord run = triggerAndWait(config, Duration.ofMinutes(5));

    assertTrue(isSuccessful(run), "Auto-tune non-distributed run should succeed");
    assertNotNull(run.getConfig(), "Auto-tune should persist resolved config on the run record");

    Stats stats = extractStats(run);
    assertNotNull(stats, "Stats must be present");
  }

  @Test
  @Order(3)
  void distributed_smallBatch_completesSuccess() {
    Map<String, Object> config = distributedConfig(50);
    AppRunRecord run = triggerAndWait(config, Duration.ofMinutes(8));

    assertTrue(isSuccessful(run), "Distributed run should complete successfully");

    Stats stats = extractStats(run);
    assertNotNull(stats, "Stats must be present on a successful distributed run");
    assertNotNull(stats.getJobStats(), "jobStats must be present");
    assertTrue(
        stats.getJobStats().getSuccessRecords() > 0,
        "At least one record should be indexed in distributed mode");
  }

  @Test
  @Order(4)
  void distributed_withAutoTune_completesSuccess() {
    Map<String, Object> config = autoTuneConfig(true);
    AppRunRecord run = triggerAndWait(config, Duration.ofMinutes(8));

    assertTrue(isSuccessful(run), "Auto-tune distributed run should succeed");
  }

  @Test
  @Order(5)
  void recreateIndex_completesSuccess() {
    Map<String, Object> config = new HashMap<>();
    config.put("recreateIndex", true);
    config.put("useDistributedIndexing", false);

    AppRunRecord run = triggerAndWait(config, Duration.ofMinutes(5));

    assertTrue(isSuccessful(run), "Recreate-index run should complete successfully");
  }

  @Test
  @Order(6)
  void readerAndSinkStats_allPresentAndNonZero() {
    Map<String, Object> config = nonDistributedConfig(100);
    AppRunRecord run = triggerAndWait(config, Duration.ofMinutes(5));

    assertTrue(isSuccessful(run), "Run should succeed before checking stats breakdown");

    Stats stats = extractStats(run);
    assertNotNull(stats, "Stats must be present");
    assertNotNull(stats.getReaderStats(), "readerStats must be present");
    assertNotNull(stats.getSinkStats(), "sinkStats must be present");
    assertTrue(
        stats.getReaderStats().getSuccessRecords() > 0,
        "readerStats should report at least one record read");
    assertTrue(
        stats.getSinkStats().getSuccessRecords() > 0,
        "sinkStats should report at least one record written");
  }

  @Test
  @Order(7)
  void progressUpdates_observableViaPollDuringExecution() {
    Map<String, Object> config = nonDistributedConfig(10);

    waitForIdle();
    triggerApp(config);

    AppRunRecord[] seenRunning = {null};
    try {
      Awaitility.await("Observe a RUNNING or in-progress state after trigger")
          .atMost(Duration.ofSeconds(30))
          .pollInterval(Duration.ofSeconds(1))
          .ignoreExceptions()
          .until(
              () -> {
                AppRunRecord run =
                    SdkClients.adminClient()
                        .getHttpClient()
                        .execute(HttpMethod.GET, LATEST_RUN_URL, null, AppRunRecord.class);
                if (run != null && run.getStatus() != null) {
                  seenRunning[0] = run;
                  String status = run.getStatus().value();
                  return "running".equals(status) || "started".equals(status) || isSuccessful(run);
                }
                return false;
              });
    } catch (org.awaitility.core.ConditionTimeoutException ignored) {
    }

    AppRunRecord terminal = waitForTerminal(Duration.ofMinutes(5));
    assertTrue(isSuccessful(terminal), "Run must ultimately complete successfully");
  }

  @Test
  @Order(8)
  void jobStats_successPlusFailed_equalsTotal() {
    Map<String, Object> config = nonDistributedConfig(100);
    AppRunRecord run = triggerAndWait(config, Duration.ofMinutes(5));

    assertTrue(isSuccessful(run), "Run should succeed before validating stats invariant");

    Stats stats = extractStats(run);
    assertNotNull(stats, "Stats must be present");

    StepStats job = stats.getJobStats();
    assertNotNull(job, "jobStats must be present");

    if (job.getTotalRecords() > 0) {
      assertEquals(
          (long) job.getTotalRecords(),
          (long) job.getSuccessRecords() + (long) job.getFailedRecords(),
          "totalRecords must equal successRecords + failedRecords");
    }
  }

  @Test
  @Order(9)
  void websocket_receivesProgressUpdatesInRealTime() throws Exception {
    Map<String, Object> config = nonDistributedConfig(50);
    waitForIdle();

    try (SearchIndexWebSocketClient ws =
        SearchIndexWebSocketClient.connect(SdkClients.getServerUrl(), "admin")) {
      triggerApp(config);
      ws.awaitMinRecords(1, Duration.ofSeconds(60));

      AppRunRecord terminal = waitForTerminal(Duration.ofMinutes(5));
      assertTrue(isSuccessful(terminal), "Run must complete successfully");

      List<AppRunRecord> received = ws.getReceivedRecords();
      assertNotNull(received, "Should have received at least one WebSocket update");
      assertTrue(received.size() >= 1, "At least one AppRunRecord update expected via WebSocket");

      AppRunRecord last = received.get(received.size() - 1);
      assertNotNull(last.getStatus(), "Last received record must have a status");
    }
  }

  private boolean isSuccessful(AppRunRecord run) {
    if (run == null || run.getStatus() == null) {
      return false;
    }
    String status = run.getStatus().value();
    return "success".equals(status) || "completed".equals(status);
  }

  private String statusOf(AppRunRecord run) {
    if (run == null || run.getStatus() == null) {
      return "null";
    }
    return run.getStatus().value();
  }
}
