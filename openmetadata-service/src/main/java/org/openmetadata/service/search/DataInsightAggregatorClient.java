package org.openmetadata.service.search;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;

public interface DataInsightAggregatorClient {

  default DataInsightCustomChartResultList buildDIChart(
      DataInsightCustomChart diChart, long start, long end, boolean live) throws IOException {
    return null;
  }

  default DataInsightCustomChartResultList buildDIChart(
      DataInsightCustomChart diChart, long start, long end) throws IOException {
    return buildDIChart(diChart, start, end, false);
  }

  default List<Map<String, String>> fetchDIChartFields() throws IOException {
    return null;
  }
}
