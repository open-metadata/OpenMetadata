package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class DashboardDataModelIndex implements ElasticSearchIndex {

  private static final List<String> excludeFields = List.of("changeDescription");

  final DashboardDataModel dashboardDataModel;

  public DashboardDataModelIndex(DashboardDataModel dashboardDataModel) {
    this.dashboardDataModel = dashboardDataModel;
  }

  public Map<String, Object> buildESDoc() {
    if (dashboardDataModel.getOwner() != null) {
      EntityReference owner = dashboardDataModel.getOwner();
      owner.setDisplayName(CommonUtil.nullOrEmpty(owner.getDisplayName()) ? owner.getName() : owner.getDisplayName());
      dashboardDataModel.setOwner(owner);
    }
    Map<String, Object> doc = JsonUtils.getMap(dashboardDataModel);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(dashboardDataModel.getName()).weight(10).build());
    suggest.add(SearchSuggest.builder().input(dashboardDataModel.getFullyQualifiedName()).weight(5).build());
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.DASHBOARD_DATA_MODEL);
    return doc;
  }
}
