package org.openmetadata.service.search.indexes;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.models.SearchSuggest;

public class DashboardIndex implements SearchIndex {
  final Dashboard dashboard;

  public DashboardIndex(Dashboard dashboard) {
    this.dashboard = dashboard;
  }

  @Override
  public List<SearchSuggest> getSuggest() {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(dashboard.getFullyQualifiedName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(dashboard.getDisplayName()).weight(10).build());
    return suggest;
  }

  @Override
  public Object getEntity() {
    return dashboard;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    List<SearchSuggest> serviceSuggest = new ArrayList<>();
    List<SearchSuggest> chartSuggest = new ArrayList<>();
    List<SearchSuggest> dataModelSuggest = new ArrayList<>();
    serviceSuggest.add(
        SearchSuggest.builder().input(dashboard.getService().getName()).weight(5).build());
    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.DASHBOARD, dashboard));

    for (EntityReference chart : listOrEmpty(dashboard.getCharts())) {
      chartSuggest.add(SearchSuggest.builder().input(chart.getDisplayName()).weight(5).build());
    }

    for (EntityReference chart : listOrEmpty(dashboard.getDataModels())) {
      dataModelSuggest.add(SearchSuggest.builder().input(chart.getDisplayName()).weight(5).build());
    }
    Map<String, Object> commonAttributes = getCommonAttributesMap(dashboard, Entity.DASHBOARD);
    doc.putAll(commonAttributes);
    doc.put("tags", parseTags.getTags());
    doc.put("tier", parseTags.getTierTag());
    doc.put("chart_suggest", chartSuggest);
    doc.put("data_model_suggest", dataModelSuggest);
    doc.put("service_suggest", serviceSuggest);
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
