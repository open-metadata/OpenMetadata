package org.openmetadata.service.elasticsearch;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.JsonUtils;

public class DashboardIndex implements ElasticSearchIndex {
  final Dashboard dashboard;
  final List<String> excludeFields = List.of("changeDescription");

  public DashboardIndex(Dashboard dashboard) {
    this.dashboard = dashboard;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(dashboard);
    ElasticSearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<ElasticSearchSuggest> suggest = new ArrayList<>();
    List<ElasticSearchSuggest> serviceSuggest = new ArrayList<>();
    List<ElasticSearchSuggest> chartSuggest = new ArrayList<>();
    List<ElasticSearchSuggest> dataModelSuggest = new ArrayList<>();
    suggest.add(ElasticSearchSuggest.builder().input(dashboard.getFullyQualifiedName()).weight(5).build());
    suggest.add(ElasticSearchSuggest.builder().input(dashboard.getDisplayName()).weight(10).build());
    serviceSuggest.add(ElasticSearchSuggest.builder().input(dashboard.getService().getName()).weight(5).build());
    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.DASHBOARD, dashboard));

    for (EntityReference chart : listOrEmpty(dashboard.getCharts())) {
      chartSuggest.add(ElasticSearchSuggest.builder().input(chart.getDisplayName()).weight(5).build());
    }

    for (EntityReference chart : listOrEmpty(dashboard.getDataModels())) {
      dataModelSuggest.add(ElasticSearchSuggest.builder().input(chart.getDisplayName()).weight(5).build());
    }

    doc.put("name", dashboard.getDisplayName());
    doc.put("displayName", dashboard.getDisplayName() != null ? dashboard.getDisplayName() : dashboard.getName());
    doc.put("tags", parseTags.tags);
    doc.put("followers", ElasticSearchIndexUtils.parseFollowers(dashboard.getFollowers()));
    doc.put("tier", parseTags.tierTag);
    doc.put("suggest", suggest);
    doc.put("chart_suggest", chartSuggest);
    doc.put("data_model_suggest", dataModelSuggest);
    doc.put("service_suggest", serviceSuggest);
    doc.put("entityType", Entity.DASHBOARD);
    doc.put("serviceType", dashboard.getServiceType());
    return doc;
  }
}
