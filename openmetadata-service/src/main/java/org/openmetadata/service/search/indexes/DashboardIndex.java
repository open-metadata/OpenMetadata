package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;

public class DashboardIndex implements SearchIndex {
  final Dashboard dashboard;

  public DashboardIndex(Dashboard dashboard) {
    this.dashboard = dashboard;
  }

  @Override
  public Object getEntity() {
    return dashboard;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.DASHBOARD, dashboard));
    Map<String, Object> commonAttributes = getCommonAttributesMap(dashboard, Entity.DASHBOARD);
    doc.putAll(commonAttributes);
    doc.put("tags", parseTags.getTags());
    doc.put("tier", parseTags.getTierTag());
    doc.put("serviceType", dashboard.getServiceType());
    doc.put("upstreamLineage", SearchIndex.getLineageData(dashboard.getEntityReference()));
    doc.put("service", getEntityWithDisplayName(dashboard.getService()));
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("charts.name", 2.0f);
    fields.put("charts.description", 1.0f);
    return fields;
  }
}
