package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.utils.JsonUtils;

public record WebAnalyticEntityViewReportDataIndex(ReportData reportData) implements SearchIndex {
  @Override
  public Object getEntity() {
    return reportData;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> esDoc) {
    Map<String, Object> doc = JsonUtils.getMap(reportData);
    doc.put("entityType", "webAnalyticEntityViewReportData");
    return doc;
  }
}
