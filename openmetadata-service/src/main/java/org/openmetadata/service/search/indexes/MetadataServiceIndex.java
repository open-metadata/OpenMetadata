package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.services.MetadataService;
import org.openmetadata.service.Entity;

public record MetadataServiceIndex(MetadataService metadataService)
    implements TaggableIndex, LineageIndex {

  @Override
  public Object getEntity() {
    return metadataService;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.METADATA_SERVICE;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    return doc;
  }
}
