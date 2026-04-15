package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.service.Entity;

public record DatabaseSchemaIndex(DatabaseSchema databaseSchema) implements TaggableIndex {

  @Override
  public Object getEntity() {
    return databaseSchema;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.DATABASE_SCHEMA;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    return doc;
  }
}
