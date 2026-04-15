package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.service.Entity;

public record DatabaseIndex(Database database) implements TaggableIndex {
  @Override
  public Object getEntity() {
    return database;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.DATABASE;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    return doc;
  }
}
