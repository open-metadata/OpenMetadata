package org.openmetadata.service.migration.utils.v190;

import static org.openmetadata.service.migration.utils.v170.MigrationUtil.createChart;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.LineChart;
import org.openmetadata.schema.dataInsight.custom.LineChartMetric;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
public class MigrationUtil {

  static DataInsightSystemChartRepository dataInsightSystemChartRepository;

  public static void updateChart(String chartName, Object chartDetails) {
    DataInsightCustomChart chart =
        dataInsightSystemChartRepository.getByName(null, chartName, EntityUtil.Fields.EMPTY_FIELDS);
    chart.setChartDetails(chartDetails);
    dataInsightSystemChartRepository.prepareInternal(chart, false);
    try {
      dataInsightSystemChartRepository.getDao().update(chart);
    } catch (Exception ex) {
      LOG.warn(ex.toString());
      LOG.warn(String.format("Error updating chart %s ", chart));
    }
  }

  public static void updateServiceCharts() {
    dataInsightSystemChartRepository = new DataInsightSystemChartRepository();
    updateChart(
        "tag_source_breakdown",
        new LineChart()
            .withxAxisField("service.name.keyword")
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula(
                            "sum(k='tagSources.Ingested')+"
                                + "sum(k='tagSources.Manual')+"
                                + "sum(k='tagSources.Propagated')")
                        .withName("manual"),
                    new LineChartMetric()
                        .withFormula("sum(k='tagSources.Generated')")
                        .withName("ai"))));

    updateChart(
        "tier_source_breakdown",
        new LineChart()
            .withxAxisField("service.name.keyword")
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula(
                            "sum(k='tierSources.Ingested')+"
                                + "sum(k='tierSources.Manual')+"
                                + "sum(k='tierSources.Propagated')")
                        .withName("manual"),
                    new LineChartMetric()
                        .withFormula("sum(k='tierSources.Generated')")
                        .withName("ai"))));

    updateChart(
        "description_source_breakdown",
        new LineChart()
            .withxAxisField("service.name.keyword")
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula(
                            "sum(k='descriptionSources.Ingested')+"
                                + "sum(k='descriptionSources.Manual')+"
                                + "sum(k='descriptionSources.Propagated')+"
                                + "sum(k='descriptionSources.Automated')")
                        .withName("manual"),
                    new LineChartMetric()
                        .withFormula("sum(k='descriptionSources.Suggested')")
                        .withName("ai"))));

    updateChart(
        "assets_with_pii_bar",
        new LineChart()
            .withMetrics(List.of(new LineChartMetric().withFormula("count(k='id.keyword')")))
            .withxAxisField("columns.tags.tagFQN")
            .withIncludeXAxisFiled("PII.*|pii.*")
            .withGroupBy("columns.tags.name.keyword"));
    updateChart(
        "assets_with_tier_bar",
        new LineChart()
            .withMetrics(List.of(new LineChartMetric().withFormula("count(k='id.keyword')")))
            .withxAxisField("tags.tagFQN")
            .withIncludeXAxisFiled("Tier.*|tier.*")
            .withGroupBy("tags.name.keyword"));

    createChart(
        "assets_with_tier_bar_live",
        new LineChart()
            .withMetrics(List.of(new LineChartMetric().withFormula("count(k='id.keyword')")))
            .withxAxisField("tier.tagFQN")
            .withIncludeXAxisFiled("Tier.*|tier.*")
            .withGroupBy("tier.name.keyword"),
        DataInsightCustomChart.ChartType.BAR_CHART);
  }
}
