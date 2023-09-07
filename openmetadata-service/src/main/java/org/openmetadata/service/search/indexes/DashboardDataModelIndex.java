package org.openmetadata.service.search.indexes;

import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.util.JsonUtils;

public class DashboardDataModelIndex implements ElasticSearchIndex {

  private static final List<String> excludeFields = List.of("changeDescription");

  final DashboardDataModel dashboardDataModel;

  public DashboardDataModelIndex(DashboardDataModel dashboardDataModel) {
    this.dashboardDataModel = dashboardDataModel;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(dashboardDataModel);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    return doc;
  }
}
