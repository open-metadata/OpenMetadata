package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.service.util.JsonUtils;

public record AggregatedCostAnalysisReportDataIndex(ReportData reportData) implements SearchIndex {

  @Override
  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(reportData);
    doc.put("entityType", "aggregatedCostAnalysisReportData");
    return doc;
  }
}
