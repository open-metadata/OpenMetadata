package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.service.Entity;

public record StorageServiceIndex(StorageService storageService)
    implements TaggableIndex, LineageIndex {

  @Override
  public Object getEntity() {
    return storageService;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.STORAGE_SERVICE;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    return doc;
  }
}
