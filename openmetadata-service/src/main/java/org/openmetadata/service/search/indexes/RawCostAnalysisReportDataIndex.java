package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.service.util.JsonUtils;

public class RawCostAnalysisReportDataIndex implements SearchIndex {

  private final ReportData reportData;

  public RawCostAnalysisReportDataIndex(ReportData reportData) {
    this.reportData = reportData;
  }

  @Override
  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(reportData);
    doc.put("entityType", "rawCostAnalysisReportData");
    return doc;
  }
}
