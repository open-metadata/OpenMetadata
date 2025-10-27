package org.openmetadata.service.search;

import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;
import org.openmetadata.schema.entity.data.QueryCostSearchResult;

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

  Response listDataInsightChartResult(
      Long startTs,
      Long endTs,
      String tier,
      String team,
      DataInsightChartResult.DataInsightChartType dataInsightChartName,
      Integer size,
      Integer from,
      String queryFilter,
      String dataReportIndex)
      throws IOException;

  QueryCostSearchResult getQueryCostRecords(String serviceName) throws IOException;
}
