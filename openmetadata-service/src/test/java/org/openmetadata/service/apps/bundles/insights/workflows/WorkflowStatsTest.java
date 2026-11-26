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
package org.openmetadata.service.apps.bundles.insights.workflows;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.system.StepStats;

class WorkflowStatsTest {

  @Test
  void identifiesEnricherDiagnosticStepsOnly() {
    assertFalse(WorkflowStats.isDiagnosticStep(null));
    assertFalse(WorkflowStats.isDiagnosticStep(""));
    assertFalse(WorkflowStats.isDiagnosticStep("   "));
    assertFalse(WorkflowStats.isDiagnosticStep("[Enricher]"));
    assertFalse(WorkflowStats.isDiagnosticStep("[DataAssetsWorkflow] table"));
    assertFalse(WorkflowStats.isDiagnosticStep("[WebAnalyticsWorkflow] Entity View Sink"));
    assertFalse(WorkflowStats.isDiagnosticStep("[CostAnalysisWorkflow] snowflake_prod"));
    assertTrue(WorkflowStats.isDiagnosticStep("[Enricher] team"));
    assertTrue(WorkflowStats.isDiagnosticStep("[Enricher] customProperties"));
  }

  @Test
  void sumsReturnZeroForNullEmptyOrAllEnricherMaps() {
    assertSums(null, 0, 0, 0);
    assertSums(Map.of(), 0, 0, 0);
    assertSums(
        Map.of(
            "[Enricher] identity", stepStats(100, 100, 0),
            "[Enricher] team", stepStats(100, 97, 3)),
        0,
        0,
        0);
  }

  @Test
  void sumsHandleNullStepValuesAndNullCountersSafely() {
    final Map<String, StepStats> steps = new HashMap<>();
    steps.put("[DataAssetsWorkflow] topic", null);
    steps.put("[DataAssetsWorkflow] dashboard", nullCounters());
    steps.put("[DataAssetsWorkflow] table", stepStats(40, 38, 2));
    steps.put("[Enricher] tier", stepStats(40, 40, 0));

    assertSums(steps, 40, 38, 2);
  }

  @Test
  void sumsAggregateSourceStepsWhileExcludingDiagnosticSteps() {
    final Map<String, StepStats> steps =
        Map.of(
            "[DataAssetsWorkflow] table", stepStats(100, 100, 0),
            "[DataAssetsWorkflow] dashboard", stepStats(25, 24, 1),
            "[WebAnalyticsWorkflow] Entity View Sink", stepStats(30, 30, 0),
            "[CostAnalysisWorkflow] bigquery_prod", stepStats(15, 14, 1),
            "[Enricher] team", stepStats(125, 120, 5),
            "[Enricher] customProperties", stepStats(125, 125, 0));

    assertSums(steps, 170, 168, 2);
  }

  @Test
  void tracksWorkflowTotalsFailuresAndIncrementalUpdates() {
    final WorkflowStats stats = new WorkflowStats("DataAssetsWorkflow");
    assertEquals("DataAssetsWorkflow", stats.getName());
    assertFalse(stats.hasFailed());

    stats.setWorkflowStatsTotalRecords(50);
    stats.addWorkflowStatsTotalRecords(25);
    stats.updateWorkflowStats(70, 5);
    stats.addFailure("sink error");

    assertTrue(stats.hasFailed());
    assertEquals(List.of("sink error"), stats.getFailures());
    assertEquals(75, stats.getWorkflowStats().getTotalRecords());
    assertEquals(70, stats.getWorkflowStats().getSuccessRecords());
    assertEquals(5, stats.getWorkflowStats().getFailedRecords());
  }

  private static void assertSums(
      final Map<String, StepStats> steps,
      final int expectedTotal,
      final int expectedSuccess,
      final int expectedFailed) {
    assertEquals(expectedTotal, WorkflowStats.sumTotalRecords(steps));
    assertEquals(expectedSuccess, WorkflowStats.sumSuccessRecords(steps));
    assertEquals(expectedFailed, WorkflowStats.sumFailedRecords(steps));
  }

  private static StepStats stepStats(final int total, final int success, final int failed) {
    return new StepStats()
        .withTotalRecords(total)
        .withSuccessRecords(success)
        .withFailedRecords(failed);
  }

  private static StepStats nullCounters() {
    return new StepStats().withTotalRecords(null).withSuccessRecords(null).withFailedRecords(null);
  }
}
