package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class ChartIndex implements SearchIndex {

  private static final List<String> excludeFields = List.of("changeDescription");

  final Chart chart;

  public ChartIndex(Chart chart) {
    this.chart = chart;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(chart);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(chart.getName()).weight(10).build());
    suggest.add(SearchSuggest.builder().input(chart.getFullyQualifiedName()).weight(5).build());
    doc.put(
        "fqnParts",
        getFQNParts(
            chart.getFullyQualifiedName(), suggest.stream().map(SearchSuggest::getInput).collect(Collectors.toList())));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.CHART);
    doc.put("owner", getOwnerWithDisplayName(chart.getOwner()));
    doc.put("domain", getDomainWithDisplayName(chart.getDomain()));
    return doc;
  }
}
