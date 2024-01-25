package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.service.util.JsonUtils;

public record ReportDataIndexes(ReportData reportData) implements SearchIndex {
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
