package org.openmetadata.service.elasticsearch;

import java.util.Map;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.service.util.JsonUtils;

public class ReportDataIndexes implements ElasticSearchIndex {

  final ReportData reportData;

  public ReportDataIndexes(ReportData reportData) {
    this.reportData = reportData;
  }

  @Override
  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(reportData);
    doc.put("id", null);
    doc.put("timestamp", reportData.getTimestamp());
    doc.put("reportDataType", reportData.getReportDataType());
    doc.put("data", reportData.getData());
    return doc;
  }
}
