package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.service.Entity;

public record DatabaseServiceIndex(DatabaseService databaseService)
    implements TaggableIndex, LineageIndex {

  @Override
  public Object getEntity() {
    return databaseService;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.DATABASE_SERVICE;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    return doc;
  }
}
