package org.openmetadata.service.search.indexes;

import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.service.util.JsonUtils;

import java.util.Map;

public class DatabaseSchemaIndex {
  final DatabaseSchema databaseSchema;

  public DatabaseSchemaIndex(DatabaseSchema databaseSchema) {
    this.databaseSchema = databaseSchema;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(databaseSchema);
    return doc;
  }
}
