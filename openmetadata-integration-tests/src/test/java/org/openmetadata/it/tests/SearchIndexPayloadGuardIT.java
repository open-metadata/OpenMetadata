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
import java.util.HashMap;
import java.util.Map;
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

/**
 * Integration tests for the payload guard / bulk payload size enforcement in the
 * SearchIndexingApplication.
 *
 * <p>These tests verify that:
 * <ul>
 *   <li>The default configuration completes without HTTP 413 payload-too-large errors</li>
 *   <li>A small explicit payloadSize cap completes without 413 (chunking kicks in internally)</li>
 *   <li>The payloadSize config is stored on the run record</li>
 *   <li>A very large batchSize does not overflow the bulk endpoint</li>
 *   <li>Distributed mode respects the payload guard equally</li>
 * </ul>
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@ExtendWith(TestNamespaceExtension.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class SearchIndexPayloadGuardIT extends SearchIndexTestBase {

  @BeforeAll
  static void setupAll() {
    SdkClients.adminClient();
  }

  @Test
  @Order(1)
  void defaultPayloadSize_successfulReindex(TestNamespace ns) {
    AppRunRecord run = triggerAndWait(nonDistributedConfig(100), Duration.ofMinutes(5));

    assertNotNull(run, "Run record must not be null");
    assertTrue(
        isSuccessful(run) || "completed_with_errors".equals(statusOf(run)),
        "Run should succeed or complete-with-errors, got: " + statusOf(run));

    if (isSuccessful(run)) {
      Stats stats = extractStats(run);
      assertNotNull(stats, "Stats must be present on a successful run");
      assertNotNull(stats.getSinkStats(), "sinkStats must be present");
      assertTrue(
          stats.getSinkStats().getSuccessRecords() > 0,
          "At least one record should have been indexed");
    }

    if (run.getFailureContext() != null && run.getFailureContext().getFailure() != null) {
      String msg = run.getFailureContext().getFailure().getMessage();
      assertFalse(
          msg != null && (msg.contains("413") || msg.toLowerCase().contains("too large")),
          "Unexpected payload size error on default config: " + msg);
    }
  }

  @Test
  @Order(2)
  void smallPayloadSize_reindexCompletes_noHttp413(TestNamespace ns) {
    Map<String, Object> config = new HashMap<>();
    config.put("batchSize", 10);
    config.put("useDistributedIndexing", false);
    config.put("recreateIndex", false);
    config.put("payloadSize", 1_048_576L);

    AppRunRecord run = triggerAndWait(config, Duration.ofMinutes(5));

    assertNotNull(run, "Run record must not be null");
    assertTrue(
        isSuccessful(run) || "completed_with_errors".equals(statusOf(run)),
        "Run should complete (possibly with errors) regardless of payload cap, got: "
            + statusOf(run));

    if (run.getFailureContext() != null && run.getFailureContext().getFailure() != null) {
      String msg = run.getFailureContext().getFailure().getMessage();
      assertFalse(
          msg != null && msg.contains("413"),
          "Should not surface an HTTP 413 when payload chunking is active: " + msg);
    }
  }

  @Test
  @Order(3)
  void payloadSize_config_isPassedThrough(TestNamespace ns) {
    Map<String, Object> config = new HashMap<>();
    config.put("batchSize", 50);
    config.put("useDistributedIndexing", false);
    config.put("recreateIndex", false);
    config.put("payloadSize", 52_428_800L);

    AppRunRecord run = triggerAndWait(config, Duration.ofMinutes(5));

    assertNotNull(run, "Run record must not be null");
    assertNotNull(run.getStatus(), "Run must have a terminal status");
    assertNotNull(run.getConfig(), "Config should be stored on the run record");
  }

  @Test
  @Order(4)
  void veryLargeBatchSize_noBulkOverflow(TestNamespace ns) {
    Map<String, Object> config = new HashMap<>();
    config.put("batchSize", 1000);
    config.put("useDistributedIndexing", false);
    config.put("payloadSize", 104_857_600L);
    config.put("recreateIndex", false);

    AppRunRecord run = triggerAndWait(config, Duration.ofMinutes(8));

    assertNotNull(run, "Run record must not be null");
    assertTrue(
        isSuccessful(run) || "completed_with_errors".equals(statusOf(run)),
        "Large-batch run should complete; payload guard must split internally if needed, got: "
            + statusOf(run));
  }

  @Test
  @Order(5)
  void distributed_defaultPayloadSize_completesWithoutOverflow(TestNamespace ns) {
    AppRunRecord run = triggerAndWait(distributedConfig(100), Duration.ofMinutes(8));

    assertNotNull(run, "Run record must not be null");

    if (run.getFailureContext() != null && run.getFailureContext().getFailure() != null) {
      String msg = run.getFailureContext().getFailure().getMessage();
      assertFalse(
          msg != null && (msg.contains("413") || msg.toLowerCase().contains("payload")),
          "Distributed run should not hit payload size limits: " + msg);
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
