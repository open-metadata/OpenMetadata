package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.services.SearchService;
import org.openmetadata.service.Entity;

public record SearchServiceIndex(SearchService searchService) implements SearchIndex {

  @Override
  public Object getEntity() {
    return searchService;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Map<String, Object> commonAttributes =
        getCommonAttributesMap(searchService, Entity.SEARCH_SERVICE);
    doc.putAll(commonAttributes);
    doc.put("upstreamLineage", SearchIndex.getLineageData(searchService.getEntityReference()));
    return doc;
  }
}
