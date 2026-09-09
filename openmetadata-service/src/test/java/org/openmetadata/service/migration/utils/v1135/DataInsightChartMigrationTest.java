/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.service.migration.utils.v1135;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;

/**
 * Covers the transform the 1.13.5 migration applies to a stored chart definition. The definitions
 * arrive as the maps they deserialize to out of the chart table, so the transform has to work on
 * maps rather than the typed builders (issue #31478).
 */
class DataInsightChartMigrationTest {

  @Test
  void everyMetricGetsTheDataAssetFilter() {
    Map<String, Object> chartDetails = chartDetails("entityType.keyword", 2);

    DataInsightChartMigration.scopeToDataAssets(chartDetails);

    for (Map<String, Object> metric : metricsOf(chartDetails)) {
      assertEquals(DataInsightSystemChartRepository.DATA_ASSET_FILTER, metric.get("filter"));
    }
  }

  @Test
  void anExistingFilterIsReplacedRatherThanLeftStale() {
    Map<String, Object> chartDetails = chartDetails("entityType.keyword", 1);
    metricsOf(chartDetails).getFirst().put("filter", "{\"query\":{\"match_all\":{}}}");

    DataInsightChartMigration.scopeToDataAssets(chartDetails);

    assertEquals(
        DataInsightSystemChartRepository.DATA_ASSET_FILTER,
        metricsOf(chartDetails).getFirst().get("filter"));
  }

  @Test
  void groupingOnEntityTypeAlsoExcludesGovernanceArtifacts() {
    Map<String, Object> chartDetails = chartDetails("entityType.keyword", 1);

    DataInsightChartMigration.scopeToDataAssets(chartDetails);

    assertEquals(
        DataInsightSystemChartRepository.NON_DATA_ASSET_ENTITY_TYPES,
        chartDetails.get("excludeGroups"));
  }

  @Test
  void groupingOnAnotherFieldKeepsItsOwnGroups() {
    Map<String, Object> chartDetails = chartDetails("tier.keyword", 1);

    DataInsightChartMigration.scopeToDataAssets(chartDetails);

    assertFalse(
        chartDetails.containsKey("excludeGroups"),
        "excludeGroups lists entity types, so it must not be forced onto a tier breakdown");
    assertEquals(
        DataInsightSystemChartRepository.DATA_ASSET_FILTER,
        metricsOf(chartDetails).getFirst().get("filter"));
  }

  @Test
  void aSummaryCardWithoutAGroupByIsStillScoped() {
    Map<String, Object> chartDetails = chartDetails(null, 1);

    DataInsightChartMigration.scopeToDataAssets(chartDetails);

    assertFalse(chartDetails.containsKey("excludeGroups"));
    assertEquals(
        DataInsightSystemChartRepository.DATA_ASSET_FILTER,
        metricsOf(chartDetails).getFirst().get("filter"));
  }

  @Test
  void aDefinitionWithNoMetricsIsLeftAlone() {
    Map<String, Object> chartDetails = new LinkedHashMap<>();
    chartDetails.put("type", "SummaryCard");

    DataInsightChartMigration.scopeToDataAssets(chartDetails);

    assertEquals(Map.of("type", "SummaryCard"), chartDetails);
  }

  @Test
  void theFilterExcludesDocumentsWithoutAnEntityType() {
    String filter = DataInsightSystemChartRepository.DATA_ASSET_FILTER;

    assertTrue(
        filter.contains("{\"exists\":{\"field\":\"entityType\"}}"),
        "A must_not list alone cannot drop the data-quality documents: they have no entityType, "
            + "so they satisfy every must_not clause");
  }

  @SuppressWarnings("unchecked")
  private static List<Map<String, Object>> metricsOf(Map<String, Object> chartDetails) {
    return (List<Map<String, Object>>) chartDetails.get("metrics");
  }

  private static Map<String, Object> chartDetails(String groupBy, int metricCount) {
    List<Map<String, Object>> metrics = new ArrayList<>();
    for (int i = 0; i < metricCount; i++) {
      Map<String, Object> metric = new HashMap<>();
      metric.put("formula", "count(k='id.keyword')");
      metrics.add(metric);
    }
    Map<String, Object> chartDetails = new LinkedHashMap<>();
    chartDetails.put("metrics", metrics);
    if (groupBy != null) {
      chartDetails.put("groupBy", groupBy);
    }
    return chartDetails;
  }
}
