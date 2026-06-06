package org.openmetadata.service.search.indexes;

import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.service.Entity;

public record APICollectionIndex(APICollection apiCollection) implements TaggableIndex {

  @Override
  public Object getEntity() {
    return apiCollection;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.API_COLLECTION;
  }

  @Override
  public Set<String> getExcludedFields() {
    return Set.of("apiEndpoints");
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    return doc;
  }
}
