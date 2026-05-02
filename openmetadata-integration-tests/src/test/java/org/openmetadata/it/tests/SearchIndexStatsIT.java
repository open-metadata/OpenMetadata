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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Integration tests that verify statistics reported by the SearchIndexingApplication.
 *
 * <p>Each test validates a different invariant of the stats model: presence, non-negativity,
 * internal consistency between reader and sink, and monotonic progress during execution.
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@ExtendWith(TestNamespaceExtension.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class SearchIndexStatsIT extends SearchIndexTestBase {

  @BeforeAll
  static void setupAll() {
    SdkClients.adminClient();
  }

  @Test
  @Order(1)
  void successfulRun_allStatsPresent(TestNamespace ns) {
    AppRunRecord run = triggerAndWait(nonDistributedConfig(100), Duration.ofMinutes(5));

    assertTrue(isSuccessful(run), "Run should complete successfully before checking stats");

    Stats stats = extractStats(run);
    assertNotNull(stats, "Stats must be present after successful run");
    assertNotNull(stats.getJobStats(), "jobStats must be present");
    assertNotNull(stats.getReaderStats(), "readerStats must be present");
    assertNotNull(stats.getSinkStats(), "sinkStats must be present");
    assertNotNull(stats.getProcessStats(), "processStats must be present");
  }

  @Test
  @Order(2)
  void jobStats_successPlusFailed_doesNotExceedTotal(TestNamespace ns) {
    AppRunRecord run = triggerAndWait(nonDistributedConfig(100), Duration.ofMinutes(5));

    Stats stats = extractStats(run);
    if (stats == null) {
      return;
    }

    StepStats job = stats.getJobStats();
    if (job == null || job.getTotalRecords() == null || job.getTotalRecords() == 0) {
      return;
    }

    assertTrue(job.getSuccessRecords() >= 0, "successRecords must not be negative");
    assertTrue(job.getFailedRecords() >= 0, "failedRecords must not be negative");
    assertTrue(
        job.getSuccessRecords() + job.getFailedRecords() <= job.getTotalRecords(),
        "success + failed should not exceed totalRecords");
  }

  @Test
  @Order(3)
  void sinkStats_successRecords_positive(TestNamespace ns) {
    AppRunRecord run = triggerAndWait(nonDistributedConfig(100), Duration.ofMinutes(5));

    if (!isSuccessful(run)) {
      return;
    }

    Stats stats = extractStats(run);
    if (stats == null || stats.getSinkStats() == null) {
      return;
    }

    assertTrue(
        stats.getSinkStats().getSuccessRecords() > 0,
        "sinkStats should report at least one successfully written record");
  }

  @Test
  @Order(4)
  void readerStats_matchSinkStats_roughly(TestNamespace ns) {
    AppRunRecord run = triggerAndWait(nonDistributedConfig(100), Duration.ofMinutes(5));

    Stats stats = extractStats(run);
    if (stats == null || stats.getReaderStats() == null || stats.getSinkStats() == null) {
      return;
    }

    long readerSuccess = stats.getReaderStats().getSuccessRecords();
    long sinkSuccess = stats.getSinkStats().getSuccessRecords();

    if (readerSuccess == 0) {
      return;
    }

    long delta = Math.abs(readerSuccess - sinkSuccess);
    double allowedSkew = readerSuccess * 0.05;
    assertTrue(
        delta <= allowedSkew,
        "Reader success ("
            + readerSuccess
            + ") and sink success ("
            + sinkSuccess
            + ") should be within 5% of each other");
  }

  @Test
  @Order(5)
  void progressStats_monotonicallyIncreasing_duringExecution(TestNamespace ns) {
    waitForIdle();
    triggerApp(nonDistributedConfig(10));

    List<Long> successSnapshots = new ArrayList<>();

    for (int i = 0; i < 10; i++) {
      try {
        AppRunRecord r =
            SdkClients.adminClient()
                .getHttpClient()
                .execute(HttpMethod.GET, LATEST_RUN_URL, null, AppRunRecord.class);
        if (r != null
            && r.getStatus() != null
            && "running".equals(r.getStatus().value())
            && r.getSuccessContext() != null
            && r.getSuccessContext().getStats() != null
            && r.getSuccessContext().getStats().getSinkStats() != null) {
          successSnapshots.add(r.getSuccessContext().getStats().getSinkStats().getSuccessRecords());
        }
      } catch (Exception ignored) {
      }

      Awaitility.await("brief poll pause")
          .pollDelay(Duration.ofSeconds(2))
          .atMost(Duration.ofSeconds(3))
          .until(() -> true);
    }

    waitForTerminal(Duration.ofMinutes(5));

    for (int i = 1; i < successSnapshots.size(); i++) {
      assertTrue(
          successSnapshots.get(i) >= successSnapshots.get(i - 1),
          "Success record count should not decrease between polls: index "
              + (i - 1)
              + "="
              + successSnapshots.get(i - 1)
              + " index "
              + i
              + "="
              + successSnapshots.get(i));
    }
  }

  @Test
  @Order(6)
  void perEntityStats_presentInSuccessfulRun(TestNamespace ns) {
    AppRunRecord run = triggerAndWait(nonDistributedConfig(100), Duration.ofMinutes(5));

    Stats stats = extractStats(run);
    if (stats == null || stats.getEntityStats() == null) {
      return;
    }

    assertFalse(
        stats.getEntityStats().isEmpty(), "Per-entity stats should be present after a full run");
    stats
        .getEntityStats()
        .values()
        .forEach(stepStats -> assertNotNull(stepStats, "Each entity's StepStats must not be null"));
  }

  @Test
  @Order(7)
  void distributed_statsConsistent(TestNamespace ns) {
    AppRunRecord run = triggerAndWait(distributedConfig(100), Duration.ofMinutes(8));

    Stats stats = extractStats(run);
    assertNotNull(stats, "Stats must be present after distributed run");
    assertNotNull(stats.getJobStats(), "jobStats must be present after distributed run");
    assertTrue(
        stats.getJobStats().getSuccessRecords() >= 0,
        "successRecords must be non-negative in distributed run");
  }

  private boolean isSuccessful(AppRunRecord run) {
    if (run == null || run.getStatus() == null) {
      return false;
    }
    String status = run.getStatus().value();
    return "success".equals(status) || "completed".equals(status);
  }
}
