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
package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils.END_TIMESTAMP_KEY;
import static org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils.START_TIMESTAMP_KEY;
import static org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.DataAssetsWorkflow.ENTITY_TYPE_FIELDS_KEY;
import static org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentContext.SNAPSHOT_TIMESTAMP_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_TYPE_KEY;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.applications.configuration.internal.DataAssetsConfig;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchInterface;
import org.openmetadata.service.apps.bundles.insights.workflows.WorkflowStats;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.DataInsightsEntityEnricherProcessor;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.search.SearchRepository;

class DataAssetsWorkflowStatsTest {
  private static final long SNAPSHOT_TIMESTAMP = 1_700_000_000_000L;

  @Test
  void multiSourceWorkflowStatsExcludeRealEnricherDiagnosticsAcrossSources()
      throws SearchIndexException {
    final DataAssetsWorkflow workflow = newWorkflow();
    workflow.entityEnricher = new DataInsightsEntityEnricherProcessor(125);

    enrichSampleTable(workflow.entityEnricher, "svc.db.schema.orders");
    workflow.updateWorkflowStats("[DataAssetsWorkflow] table", stepStats(100, 100, 0));
    workflow.mergeEnricherStepStats();
    assertStepStats(workflow.getWorkflowStats().getWorkflowStats(), 100, 100, 0);

    enrichSampleTable(workflow.entityEnricher, "svc.db.schema.customers");
    workflow.updateWorkflowStats("[DataAssetsWorkflow] dashboard", stepStats(25, 24, 1));
    workflow.mergeEnricherStepStats();

    assertMergedStepsAndTotals(workflow);
  }

  @Test
  void mergeEnricherStepStatsSkipsWhenEnricherIsNull() {
    final DataAssetsWorkflow workflow = newWorkflow();
    workflow.mergeEnricherStepStats();
    assertTrue(workflow.getWorkflowStats().getWorkflowStepStats().isEmpty());
  }

  private static void assertMergedStepsAndTotals(final DataAssetsWorkflow workflow) {
    final Map<String, StepStats> steps = workflow.getWorkflowStats().getWorkflowStepStats();
    final List<String> enricherKeys =
        steps.keySet().stream().filter(key -> !key.startsWith("[DataAssetsWorkflow]")).toList();

    assertFalse(enricherKeys.isEmpty());
    assertEquals(workflow.entityEnricher.getEntityStats().size(), enricherKeys.size());
    assertTrue(enricherKeys.stream().allMatch(WorkflowStats::isDiagnosticStep));
    assertStepStats(steps.get("[Enricher] identity"), 2, 2, 0);
    assertStepStats(steps.get("[Enricher] descriptionStats"), 2, 0, 2);
    assertStepStats(workflow.getWorkflowStats().getWorkflowStats(), 125, 124, 1);
  }

  private static void enrichSampleTable(
      final DataInsightsEntityEnricherProcessor enricher, final String fqn)
      throws SearchIndexException {
    final Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("sample")
            .withFullyQualifiedName(fqn)
            .withDescription("table description")
            .withColumns(Collections.singletonList(null));
    final Map<String, Object> context =
        Map.of(
            ENTITY_TYPE_KEY,
            "table",
            ENTITY_TYPE_FIELDS_KEY,
            List.of("id", "name", "fullyQualifiedName", "description"),
            START_TIMESTAMP_KEY,
            SNAPSHOT_TIMESTAMP,
            END_TIMESTAMP_KEY,
            SNAPSHOT_TIMESTAMP,
            SNAPSHOT_TIMESTAMP_KEY,
            SNAPSHOT_TIMESTAMP);
    assertFalse(enricher.enrichSingle(table, context).isEmpty());
  }

  private static DataAssetsWorkflow newWorkflow() {
    return new DataAssetsWorkflow(
        new DataAssetsConfig().withEnabled(true),
        SNAPSHOT_TIMESTAMP,
        100,
        Optional.empty(),
        Set.of(),
        null,
        mock(SearchRepository.class),
        mock(DataInsightsSearchInterface.class));
  }

  private static StepStats stepStats(final int total, final int success, final int failed) {
    return new StepStats()
        .withTotalRecords(total)
        .withSuccessRecords(success)
        .withFailedRecords(failed);
  }

  private static void assertStepStats(
      final StepStats actual, final int total, final int success, final int failed) {
    assertEquals(total, actual.getTotalRecords());
    assertEquals(success, actual.getSuccessRecords());
    assertEquals(failed, actual.getFailedRecords());
  }
}
