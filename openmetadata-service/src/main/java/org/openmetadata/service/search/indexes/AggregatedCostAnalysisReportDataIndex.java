package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.service.Entity;

public record AggregatedCostAnalysisReportDataIndex(ReportData reportData) implements SearchIndex {

  @Override
  public Object getEntity() {
    return reportData;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.AGGREGATED_COST_ANALYSIS_REPORT_DATA;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> esDoc) {
    esDoc.put("entityType", "aggregatedCostAnalysisReportData");
    return esDoc;
  }
}
