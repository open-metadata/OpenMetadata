package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.service.util.JsonUtils;

public class DashboardDataModelIndex implements ElasticSearchIndex {

  final DashboardDataModel dashboardDataModel;

  public DashboardDataModelIndex(DashboardDataModel dashboardDataModel) {
    this.dashboardDataModel = dashboardDataModel;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(dashboardDataModel);
    return doc;
  }
}
