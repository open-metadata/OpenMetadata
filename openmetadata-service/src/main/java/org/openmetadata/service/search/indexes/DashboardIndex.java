package org.openmetadata.service.search.indexes;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class DashboardIndex implements ElasticSearchIndex {
  final Dashboard dashboard;
  final List<String> excludeFields = List.of("changeDescription");

  public DashboardIndex(Dashboard dashboard) {
    this.dashboard = dashboard;
  }

  public Map<String, Object> buildESDoc() {
    if (dashboard.getOwner() != null) {
      EntityReference owner = dashboard.getOwner();
      owner.setDisplayName(CommonUtil.nullOrEmpty(owner.getDisplayName()) ? owner.getName() : owner.getDisplayName());
      dashboard.setOwner(owner);
    }
    Map<String, Object> doc = JsonUtils.getMap(dashboard);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<SearchSuggest> suggest = new ArrayList<>();
    List<SearchSuggest> serviceSuggest = new ArrayList<>();
    List<SearchSuggest> chartSuggest = new ArrayList<>();
    List<SearchSuggest> dataModelSuggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(dashboard.getFullyQualifiedName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(dashboard.getDisplayName()).weight(10).build());
    serviceSuggest.add(SearchSuggest.builder().input(dashboard.getService().getName()).weight(5).build());
    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.DASHBOARD, dashboard));

    for (EntityReference chart : listOrEmpty(dashboard.getCharts())) {
      chartSuggest.add(SearchSuggest.builder().input(chart.getDisplayName()).weight(5).build());
    }

    for (EntityReference chart : listOrEmpty(dashboard.getDataModels())) {
      dataModelSuggest.add(SearchSuggest.builder().input(chart.getDisplayName()).weight(5).build());
    }

    doc.put("name", dashboard.getDisplayName());
    doc.put("displayName", dashboard.getDisplayName() != null ? dashboard.getDisplayName() : dashboard.getName());
    doc.put("tags", parseTags.getTags());
    doc.put("followers", SearchIndexUtils.parseFollowers(dashboard.getFollowers()));
    doc.put("tier", parseTags.getTierTag());
    doc.put("suggest", suggest);
    doc.put("chart_suggest", chartSuggest);
    doc.put("data_model_suggest", dataModelSuggest);
    doc.put("service_suggest", serviceSuggest);
    doc.put("entityType", Entity.DASHBOARD);
    doc.put("serviceType", dashboard.getServiceType());
    return doc;
  }
}
