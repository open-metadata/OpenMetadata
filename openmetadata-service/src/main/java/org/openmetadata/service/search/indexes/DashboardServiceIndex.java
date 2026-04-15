package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.service.Entity;

public record DashboardServiceIndex(DashboardService dashboardService)
    implements TaggableIndex, LineageIndex {

  @Override
  public Object getEntity() {
    return dashboardService;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.DASHBOARD_SERVICE;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    return doc;
  }
}
