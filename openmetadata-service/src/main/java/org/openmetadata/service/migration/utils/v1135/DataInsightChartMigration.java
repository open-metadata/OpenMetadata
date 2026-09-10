/*
 *  Copyright 2021 Collate
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

import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;
import org.openmetadata.service.util.EntityUtil;

/**
 * Realigns the system Data Insights charts that report on data assets so a summary card and the
 * breakdown below it count the same documents.
 *
 * <p>The {@code di-data-assets-*} pattern the charts read also resolves the data-quality aliases,
 * and those documents carry no {@code entityType}. A breakdown grouped on {@code
 * entityType.keyword} drops them, while the summary cards' old {@code must_not} filter let them
 * through, so the card always ran ahead of the chart by the number of test case results in the
 * window (#31478). The charts were created back in 1.5.0 and every deployment already holds those
 * definitions, so re-apply the scope to each affected chart.
 *
 * <p>Only the two scope-defining properties are rewritten. The metrics' formulas and the rest of
 * each chart are left as stored, so a definition changed by a later migration survives.
 */
@Slf4j
public class DataInsightChartMigration {

  private static final String METRICS_KEY = "metrics";
  private static final String FILTER_KEY = "filter";
  private static final String GROUP_BY_KEY = "groupBy";
  private static final String EXCLUDE_GROUPS_KEY = "excludeGroups";
  private static final String ENTITY_TYPE_GROUP_BY = "entityType.keyword";

  /** System charts that report on data assets and must therefore share one scope. */
  private static final List<String> DATA_ASSET_CHARTS =
      List.of(
          "total_data_assets",
          "total_data_assets_by_tier",
          "total_data_assets_summary_card",
          "total_data_assets_with_tier_summary_card",
          "percentage_of_data_asset_with_description",
          "percentage_of_data_asset_with_owner",
          "percentage_of_service_with_description",
          "percentage_of_service_with_owner",
          "data_assets_with_description_summary_card",
          "data_assets_with_owner_summary_card",
          "percentage_of_data_asset_with_description_kpi",
          "percentage_of_data_asset_with_owner_kpi",
          "number_of_data_asset_with_description_kpi",
          "number_of_data_asset_with_owner_kpi");

  private DataInsightChartMigration() {
    /* Static migration entry point only */
  }

  public static void alignDataAssetChartScope() {
    DataInsightSystemChartRepository repository = new DataInsightSystemChartRepository();
    for (String chartName : DATA_ASSET_CHARTS) {
      applyDataAssetScope(repository, chartName);
    }
  }

  private static void applyDataAssetScope(
      DataInsightSystemChartRepository repository, String chartName) {
    try {
      DataInsightCustomChart chart =
          repository.getByName(null, chartName, EntityUtil.Fields.EMPTY_FIELDS);
      Map<String, Object> chartDetails = asChartDetails(chart);
      if (chartDetails == null) {
        LOG.warn("Chart {} has no chart details, skipping data asset scope alignment", chartName);
      } else {
        scopeToDataAssets(chartDetails);
        chart.setChartDetails(chartDetails);
        repository.prepareInternal(chart, false);
        repository.getDao().update(chart);
      }
    } catch (Exception ex) {
      LOG.warn("Failed to align data asset scope for chart {}: {}", chartName, ex.getMessage());
    }
  }

  static void scopeToDataAssets(Map<String, Object> chartDetails) {
    List<Map<String, Object>> metrics = asMetrics(chartDetails.get(METRICS_KEY));
    if (metrics != null) {
      for (Map<String, Object> metric : metrics) {
        metric.put(FILTER_KEY, DataInsightSystemChartRepository.DATA_ASSET_FILTER);
      }
    }
    if (ENTITY_TYPE_GROUP_BY.equals(chartDetails.get(GROUP_BY_KEY))) {
      chartDetails.put(
          EXCLUDE_GROUPS_KEY, DataInsightSystemChartRepository.NON_DATA_ASSET_ENTITY_TYPES);
    }
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> asChartDetails(DataInsightCustomChart chart) {
    Map<String, Object> chartDetails = null;
    if (chart.getChartDetails() instanceof Map<?, ?> details) {
      chartDetails = (Map<String, Object>) details;
    }
    return chartDetails;
  }

  @SuppressWarnings("unchecked")
  private static List<Map<String, Object>> asMetrics(Object metrics) {
    List<Map<String, Object>> typedMetrics = null;
    if (metrics instanceof List<?> metricList) {
      typedMetrics = (List<Map<String, Object>>) metricList;
    }
    return typedMetrics;
  }
}
