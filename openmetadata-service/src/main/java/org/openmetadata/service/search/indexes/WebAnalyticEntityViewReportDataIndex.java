package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.service.util.JsonUtils;

public class WebAnalyticEntityViewReportDataIndex implements SearchIndex {
  private final ReportData reportData;

  public WebAnalyticEntityViewReportDataIndex(ReportData reportData) {
    this.reportData = reportData;
  }

  @Override
  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(reportData);
    doc.put("entityType", "webAnalyticEntityViewReportData");
    return doc;
  }
}
