package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;

public record DashboardServiceIndex(DashboardService dashboardService) implements SearchIndex {

  @Override
  public Object getEntity() {
    return dashboardService;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(dashboardService.getName()).weight(5).build());
    suggest.add(
        SearchSuggest.builder().input(dashboardService.getDisplayName()).weight(10).build());
    doc.put(
        "fqnParts",
        getFQNParts(
            dashboardService.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).toList()));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.DASHBOARD_SERVICE);
    doc.put("owner", getEntityWithDisplayName(dashboardService.getOwner()));
    doc.put("domain", getEntityWithDisplayName(dashboardService.getDomain()));
    doc.put("followers", SearchIndexUtils.parseFollowers(dashboardService.getFollowers()));
    return doc;
  }
}
