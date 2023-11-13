package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class DashboardServiceIndex implements SearchIndex {

  final DashboardService dashboardService;

  private static final List<String> excludeFields = List.of("changeDescription");

  public DashboardServiceIndex(DashboardService dashboardService) {
    this.dashboardService = dashboardService;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(dashboardService);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(dashboardService.getName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(dashboardService.getDisplayName()).weight(10).build());
    doc.put(
        "fqnParts",
        getFQNParts(
            dashboardService.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).collect(Collectors.toList())));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.DASHBOARD_SERVICE);
    doc.put("owner", getEntityWithDisplayName(dashboardService.getOwner()));
    doc.put("domain", getEntityWithDisplayName(dashboardService.getDomain()));
    return doc;
  }
}
