package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.service.Entity;

public record APIServiceIndex(org.openmetadata.schema.entity.services.ApiService apiService)
    implements TaggableIndex, LineageIndex {

  @Override
  public Object getEntity() {
    return apiService;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.API_SERVICE;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    return doc;
  }
}
