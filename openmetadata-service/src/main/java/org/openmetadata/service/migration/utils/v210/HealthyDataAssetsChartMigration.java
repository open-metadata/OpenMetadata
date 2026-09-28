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

package org.openmetadata.service.migration.utils.v210;

import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.JdbiException;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.LineChart;
import org.openmetadata.schema.dataInsight.custom.LineChartMetric;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;

/**
 * Repairs the Platform Insights "Healthy Data Assets" card, which always showed 0%.
 *
 * <p>The v190 chart was a single definition serving both the polled (Data Insights index) and the
 * live (search index) request. It grouped by service instead of by day, counted unhealthy tables
 * instead of healthy ones, and referenced {@code table.id.keyword} / {@code
 * testCaseStatus.keyword}, sub-fields that do not exist in the test-case-result index, so the polled
 * request matched nothing. As with the other Platform Insights cards, the polled and live requests
 * now read separate charts.
 */
@Slf4j
public final class HealthyDataAssetsChartMigration {
  public static final String HEALTHY_DATA_ASSETS = "healthy_data_assets";
  public static final String HEALTHY_DATA_ASSETS_LIVE = "healthy_data_assets_live";

  /**
   * Per day, over test-case-result documents: tables that ran tests that day, less those with a
   * failed or aborted run that day.
   */
  static final String DAILY_FORMULA =
      "unique(k='table.id',q='testCaseStatus: *')"
          + "-unique(k='table.id',q='testCaseStatus: Failed OR testCaseStatus: Aborted')";

  /**
   * Over test-case documents, matching the Data Quality page: entities with tests, less those
   * whose latest result failed or aborted. The top-level {@code testCaseStatus} on a test case is
   * not its latest result; {@code testCaseResult.testCaseStatus} is.
   */
  static final String LIVE_FORMULA =
      "unique(k='originEntityFQN')"
          + "-unique(k='originEntityFQN',q='testCaseResult.testCaseStatus: Failed"
          + " OR testCaseResult.testCaseStatus: Aborted')";

  private HealthyDataAssetsChartMigration() {}

  /** Idempotent; safe to call on every reprocessing pass. */
  public static void repairHealthyDataAssetsCharts() {
    DataInsightSystemChartRepository repository = new DataInsightSystemChartRepository();
    upsertChart(repository, HEALTHY_DATA_ASSETS, dailyChart());
    upsertChart(repository, HEALTHY_DATA_ASSETS_LIVE, liveChart());
  }

  static LineChart dailyChart() {
    return new LineChart().withMetrics(List.of(new LineChartMetric().withFormula(DAILY_FORMULA)));
  }

  static LineChart liveChart() {
    return new LineChart()
        .withMetrics(List.of(new LineChartMetric().withFormula(LIVE_FORMULA)))
        .withxAxisField("service.name.keyword");
  }

  private static void upsertChart(
      DataInsightSystemChartRepository repository, String chartName, LineChart chartDetails) {
    try {
      DataInsightCustomChart existing = repository.findByNameOrNull(chartName, Include.NON_DELETED);
      if (existing == null) {
        DataInsightCustomChart chart = newSystemChart(chartName, chartDetails);
        repository.prepareInternal(chart, false);
        repository.getDao().insert("fqnHash", chart, chart.getFullyQualifiedName());
      } else {
        existing.setChartDetails(chartDetails);
        repository.prepareInternal(existing, false);
        repository.getDao().update(existing);
      }
    } catch (JdbiException ex) {
      LOG.warn("v210: could not repair chart '{}': {}", chartName, ex.getMessage());
    }
  }

  private static DataInsightCustomChart newSystemChart(String chartName, LineChart chartDetails) {
    return new DataInsightCustomChart()
        .withId(UUID.randomUUID())
        .withName(chartName)
        .withChartDetails(chartDetails)
        .withUpdatedAt(System.currentTimeMillis())
        .withUpdatedBy("ingestion-bot")
        .withDeleted(false)
        .withChartType(DataInsightCustomChart.ChartType.LINE_CHART)
        .withIsSystemChart(true);
  }
}
