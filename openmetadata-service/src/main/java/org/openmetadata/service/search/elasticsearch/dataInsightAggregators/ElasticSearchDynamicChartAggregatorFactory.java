package org.openmetadata.service.search.elasticsearch.dataInsightAggregators;

import java.util.LinkedHashMap;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.LineChart;
import org.openmetadata.schema.dataInsight.custom.SummaryCard;

public class ElasticSearchDynamicChartAggregatorFactory {
  public static ElasticSearchDynamicChartAggregatorInterface getAggregator(
      DataInsightCustomChart diChart) {
    if (((LinkedHashMap) diChart.getChartDetails())
        .get("type")
        .equals(LineChart.Type.LINE_CHART.value())) {
      return new ElasticSearchLineChartAggregator();
    } else if (((LinkedHashMap) diChart.getChartDetails())
        .get("type")
        .equals(SummaryCard.Type.SUMMARY_CARD.value())) {
      return new ElasticSearchSummaryCardAggregator();
    }
    return null;
  }
}
