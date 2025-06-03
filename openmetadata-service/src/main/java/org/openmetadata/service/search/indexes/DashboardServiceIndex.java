package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.models.SearchSuggest;

public record DashboardServiceIndex(DashboardService dashboardService) implements SearchIndex {

  @Override
  public List<SearchSuggest> getSuggest() {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(dashboardService.getName()).weight(5).build());
    suggest.add(
        SearchSuggest.builder().input(dashboardService.getDisplayName()).weight(10).build());
    return suggest;
  }

  @Override
  public Object getEntity() {
    return dashboardService;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Map<String, Object> commonAttributes =
        getCommonAttributesMap(dashboardService, Entity.DASHBOARD_SERVICE);
    doc.putAll(commonAttributes);
    doc.put("upstreamLineage", SearchIndex.getLineageData(dashboardService.getEntityReference()));
    return doc;
  }
}
