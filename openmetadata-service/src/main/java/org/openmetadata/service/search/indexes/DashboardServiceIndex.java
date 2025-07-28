package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.service.Entity;

public record DashboardServiceIndex(DashboardService dashboardService) implements SearchIndex {

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
