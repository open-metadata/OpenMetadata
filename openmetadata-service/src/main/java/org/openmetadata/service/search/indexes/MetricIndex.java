package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.models.SearchSuggest;

public class MetricIndex implements SearchIndex {
  final Metric metric;

  public MetricIndex(Metric metric) {
    this.metric = metric;
  }

  @Override
  public List<SearchSuggest> getSuggest() {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(metric.getName()).weight(5).build());
    if (metric.getDisplayName() != null && !metric.getDisplayName().isEmpty()) {
      suggest.add(SearchSuggest.builder().input(metric.getDisplayName()).weight(10).build());
    }
    return suggest;
  }

  @Override
  public Object getEntity() {
    return metric;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Map<String, Object> commonAttributes = getCommonAttributesMap(metric, Entity.METRIC);
    doc.putAll(commonAttributes);
    doc.put("upstreamLineage", SearchIndex.getLineageData(metric.getEntityReference()));
    return doc;
  }
}
