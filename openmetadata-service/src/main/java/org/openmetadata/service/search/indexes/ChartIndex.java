package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;

public record ChartIndex(Chart chart) implements SearchIndex {

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(chart.getName()).weight(10).build());
    suggest.add(SearchSuggest.builder().input(chart.getFullyQualifiedName()).weight(5).build());
    doc.put(
        "fqnParts",
        getFQNParts(
            chart.getFullyQualifiedName(), suggest.stream().map(SearchSuggest::getInput).toList()));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.CHART);
    doc.put("owner", getEntityWithDisplayName(chart.getOwner()));
    doc.put("domain", getEntityWithDisplayName(chart.getDomain()));
    doc.put("followers", SearchIndexUtils.parseFollowers(chart.getFollowers()));
    doc.put(
        "totalVotes",
        CommonUtil.nullOrEmpty(chart.getVotes())
            ? 0
            : chart.getVotes().getUpVotes() - chart.getVotes().getDownVotes());
    return doc;
  }

  @Override
  public Object getEntity() {
    return chart;
  }
}
