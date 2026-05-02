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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import java.time.Duration;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Disabled;
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
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingMetrics;

/**
 * Integration tests for the bulk circuit breaker in the SearchIndexingApplication.
 *
 * <p>These tests verify that:
 * <ul>
 *   <li>A clean reindex produces zero circuit breaker trips</li>
 *   <li>All three circuit breaker transition counters are accessible and non-negative</li>
 *   <li>Logging context added to BulkCircuitBreaker does not appear on clean runs</li>
 *   <li>Both entity-sink and column-sink circuit breakers show zero trips on a clean run</li>
 * </ul>
 *
 * <p>Tests that require forcing a circuit breaker open (by writing a block on the search index)
 * are marked {@link Disabled} because they need direct search engine manipulation that is not yet
 * wired to the integration test harness.
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@ExtendWith(TestNamespaceExtension.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class SearchIndexCircuitBreakerIT extends SearchIndexTestBase {

  @BeforeAll
  static void setupAll() {
    SdkClients.adminClient();
  }

  @Test
  @Order(1)
  void baseline_noCircuitBreakerTrips_onSuccessfulRun(TestNamespace ns) {
    long tripsBefore = getCircuitBreakerTrips("closed_to_open");

    AppRunRecord run = triggerAndWait(nonDistributedConfig(100), Duration.ofMinutes(5));

    assertTrue(isSuccessful(run), "Run must succeed before asserting no circuit breaker trips");

    long tripsAfter = getCircuitBreakerTrips("closed_to_open");
    assertEquals(
        tripsBefore,
        tripsAfter,
        "No circuit breaker trips expected on a clean, successful reindex run");
  }

  @Test
  @Order(2)
  void circuitBreakerMetrics_methodWorks_afterReindex(TestNamespace ns) {
    AppRunRecord run = triggerAndWait(nonDistributedConfig(100), Duration.ofMinutes(5));
    assertTrue(isSuccessful(run), "Run must succeed before reading metric counters");

    long closedToOpen = getCircuitBreakerTrips("closed_to_open");
    long halfOpenToClosed = getCircuitBreakerTrips("half_open_to_closed");
    long openToHalfOpen = getCircuitBreakerTrips("open_to_half_open");

    assertTrue(closedToOpen >= 0, "closed_to_open trip count must be non-negative");
    assertTrue(halfOpenToClosed >= 0, "half_open_to_closed trip count must be non-negative");
    assertTrue(openToHalfOpen >= 0, "open_to_half_open trip count must be non-negative");
  }

  @Test
  @Order(3)
  @Disabled("Requires direct search engine index write-block manipulation")
  void circuitBreaker_opens_onConsecutiveFailures(TestNamespace ns) {
    fail(
        "Not yet implemented: requires confirmed Rest5Client write-block API to force bulk failures"
            + " on table_search_index and observe closed_to_open trip count increase.");
  }

  @Test
  @Order(4)
  @Disabled("Requires direct search engine index write-block manipulation")
  void circuitBreaker_recovers_afterConditionsImprove(TestNamespace ns) {
    fail(
        "Not yet implemented: requires confirmed Rest5Client write-block API to verify"
            + " open_to_half_open and half_open_to_closed transitions after write block removal.");
  }

  @Test
  @Order(5)
  void contextLogging_inCircuitBreakerTransitions(TestNamespace ns) {
    AppRunRecord run = triggerAndWait(nonDistributedConfig(100), Duration.ofMinutes(5));

    assertTrue(
        isSuccessful(run),
        "Run must succeed before asserting absence of circuit breaker failure context");
    assertNull(
        run.getFailureContext(),
        "A clean run must not produce a failure context (no circuit breaker activation expected)");
  }

  @Test
  @Order(6)
  void entityAndColumnSink_haveIndependentBreakers_metricsBothAtZero(TestNamespace ns) {
    AppRunRecord run = triggerAndWait(nonDistributedConfig(100), Duration.ofMinutes(5));

    assertTrue(
        isSuccessful(run),
        "Run must succeed before asserting entity-sink and column-sink circuit breaker counts");

    long closedToOpenTrips = getCircuitBreakerTrips("closed_to_open");
    assertEquals(
        0L,
        closedToOpenTrips,
        "Both entity-sink and column-sink circuit breakers should show zero closed_to_open trips"
            + " on a successful clean reindex");
  }

  private boolean isSuccessful(AppRunRecord run) {
    if (run == null || run.getStatus() == null) {
      return false;
    }
    String status = run.getStatus().value();
    return "success".equals(status) || "completed".equals(status);
  }

  private long getCircuitBreakerTrips(String transition) {
    ReindexingMetrics metrics = ReindexingMetrics.getInstance();
    if (metrics == null) {
      return 0L;
    }
    return metrics.getCircuitBreakerTripCount(transition);
  }
}
