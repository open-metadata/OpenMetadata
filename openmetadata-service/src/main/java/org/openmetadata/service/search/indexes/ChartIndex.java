package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.models.SearchSuggest;

public record ChartIndex(Chart chart) implements SearchIndex {
  @Override
  public List<SearchSuggest> getSuggest() {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(chart.getName()).weight(10).build());
    suggest.add(SearchSuggest.builder().input(chart.getFullyQualifiedName()).weight(5).build());
    return suggest;
  }

  @Override
  public Object getEntity() {
    return chart;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> esDoc) {
    Map<String, Object> commonAttributes = getCommonAttributesMap(chart, Entity.CHART);
    esDoc.putAll(commonAttributes);
    return esDoc;
  }
}
