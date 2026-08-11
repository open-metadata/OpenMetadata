package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.services.SearchService;
import org.openmetadata.service.Entity;

public record SearchServiceIndex(SearchService searchService)
    implements TaggableIndex, LineageIndex {

  @Override
  public Object getEntity() {
    return searchService;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.SEARCH_SERVICE;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    return doc;
  }
}
