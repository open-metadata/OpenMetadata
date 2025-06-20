package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.service.Entity;

public record DatabaseSchemaIndex(DatabaseSchema databaseSchema) implements SearchIndex {

  @Override
  public Object getEntity() {
    return databaseSchema;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Map<String, Object> commonAttributes =
        getCommonAttributesMap(databaseSchema, Entity.DATABASE_SCHEMA);
    doc.putAll(commonAttributes);
    return doc;
  }
}
