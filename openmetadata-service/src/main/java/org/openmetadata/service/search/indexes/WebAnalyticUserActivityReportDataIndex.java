package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

public record WebAnalyticUserActivityReportDataIndex(ReportData reportData) implements SearchIndex {
  @Override
  public Object getEntity() {
    return reportData;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> esDoc) {
    Map<String, Object> doc = JsonUtils.getMap(reportData);
    doc.put("entityType", "webAnalyticUserActivityReportData");
    return doc;
  }
}
