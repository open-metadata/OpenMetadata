package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class DashboardServiceIndex implements ElasticSearchIndex {

  final DashboardService dashboardService;

  private static final List<String> excludeFields = List.of("changeDescription");

  public DashboardServiceIndex(DashboardService dashboardService) {
    this.dashboardService = dashboardService;
  }

  public Map<String, Object> buildESDoc() {
    if (dashboardService.getOwner() != null) {
      EntityReference owner = dashboardService.getOwner();
      owner.setDisplayName(CommonUtil.nullOrEmpty(owner.getDisplayName()) ? owner.getName() : owner.getDisplayName());
      dashboardService.setOwner(owner);
    }
    Map<String, Object> doc = JsonUtils.getMap(dashboardService);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(dashboardService.getName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(dashboardService.getDisplayName()).weight(10).build());
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.DASHBOARD_SERVICE);
    return doc;
  }
}
