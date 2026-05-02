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

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
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
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Integration tests for stopping the SearchIndexingApplication under various conditions.
 *
 * <p>Verifies that stop requests are handled gracefully whether the job has not yet started,
 * is actively running, or when multiple stop calls are issued. Also verifies that a fresh
 * trigger succeeds after a stopped job.
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@ExtendWith(TestNamespaceExtension.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class SearchIndexStopIT extends SearchIndexTestBase {

  @BeforeAll
  static void setupAll() {
    SdkClients.adminClient();
  }

  @Test
  @Order(1)
  void stop_immediatelyAfterTrigger(TestNamespace ns) {
    waitForIdle();
    triggerApp(nonDistributedConfig(100));
    stopApp();
    AppRunRecord run = waitForTerminal(Duration.ofMinutes(2));

    assertNotNull(run, "A terminal run record must be present after stop");
    String status = run.getStatus().value();
    assertTrue(
        "stopped".equals(status) || "success".equals(status) || "completed".equals(status),
        "Expected stopped or success but got: " + status);
  }

  @Test
  @Order(2)
  void stop_whileRunning_jobStops(TestNamespace ns) {
    waitForIdle();
    triggerApp(nonDistributedConfig(100));

    Awaitility.await("Wait for job to reach RUNNING state")
        .atMost(Duration.ofMinutes(2))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .until(
            () -> {
              AppRunRecord r =
                  SdkClients.adminClient()
                      .getHttpClient()
                      .execute(HttpMethod.GET, LATEST_RUN_URL, null, AppRunRecord.class);
              return r != null && r.getStatus() != null && "running".equals(r.getStatus().value());
            });

    stopApp();
    AppRunRecord run = waitForTerminal(Duration.ofMinutes(2));

    assertNotNull(run, "A terminal run record must be present after stop");
    String status = run.getStatus().value();
    assertTrue(
        "stopped".equals(status) || "success".equals(status) || "completed".equals(status),
        "Expected stopped or success but got: " + status);
  }

  @Test
  @Order(3)
  void retrigger_afterStop_succeeds(TestNamespace ns) {
    waitForIdle();
    triggerApp(nonDistributedConfig(100));
    stopApp();
    waitForTerminal(Duration.ofMinutes(2));

    AppRunRecord run = triggerAndWait(nonDistributedConfig(100), Duration.ofMinutes(5));

    assertNotNull(run, "Run record must be present after retrigger");
    String status = run.getStatus().value();
    assertTrue(
        "success".equals(status) || "completed".equals(status),
        "Retrigger after stop should succeed, got: " + status);
  }

  @Test
  @Order(4)
  void stop_idempotent_multipleCallsNoError(TestNamespace ns) {
    waitForIdle();
    triggerApp(nonDistributedConfig(100));

    stopApp();
    stopApp();
    stopApp();

    waitForTerminal(Duration.ofMinutes(2));
  }

  @Test
  @Order(5)
  void distributed_stop_whileRunning(TestNamespace ns) {
    waitForIdle();
    triggerApp(distributedConfig(100));

    Awaitility.await("Wait for distributed job to reach RUNNING state")
        .atMost(Duration.ofMinutes(2))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .until(
            () -> {
              AppRunRecord r =
                  SdkClients.adminClient()
                      .getHttpClient()
                      .execute(HttpMethod.GET, LATEST_RUN_URL, null, AppRunRecord.class);
              return r != null && r.getStatus() != null && "running".equals(r.getStatus().value());
            });

    stopApp();
    AppRunRecord run = waitForTerminal(Duration.ofMinutes(3));

    assertNotNull(run, "A terminal run record must be present after distributed stop");
    String status = run.getStatus().value();
    assertTrue(
        "stopped".equals(status) || "success".equals(status) || "completed".equals(status),
        "Expected stopped or success but got: " + status);
  }
}
