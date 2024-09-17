package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.analytics.ReportData;

public record AggregatedCostAnalysisReportDataIndex(ReportData reportData) implements SearchIndex {

  @Override
  public Object getEntity() {
    return reportData;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> esDoc) {
    esDoc.put("entityType", "aggregatedCostAnalysisReportData");
    return esDoc;
  }
}
