package org.openmetadata.service.search.indexes;

import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.service.Entity;

public class DashboardIndex implements DataAssetIndex {
  final Dashboard dashboard;

  public DashboardIndex(Dashboard dashboard) {
    this.dashboard = dashboard;
  }

  @Override
  public Object getEntity() {
    return dashboard;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.DASHBOARD;
  }

  @Override
  public Object getIndexServiceType() {
    return dashboard.getServiceType();
  }

  @Override
  public Set<String> getExcludedFields() {
    return Set.of("dataModels");
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("charts.name", 2.0f);
    fields.put("charts.description", 1.0f);
    return fields;
  }
}
