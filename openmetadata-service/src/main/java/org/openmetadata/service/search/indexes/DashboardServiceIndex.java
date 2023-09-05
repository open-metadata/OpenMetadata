package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.service.util.JsonUtils;

public class DashboardServiceIndex implements ElasticSearchIndex {

  final DashboardService dashboardService;

  public DashboardServiceIndex(DashboardService dashboardService) {
    this.dashboardService = dashboardService;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(dashboardService);
    return doc;
  }
}
