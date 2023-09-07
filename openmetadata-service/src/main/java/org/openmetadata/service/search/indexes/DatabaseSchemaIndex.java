package org.openmetadata.service.search.indexes;

import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.util.JsonUtils;

public class DatabaseSchemaIndex implements ElasticSearchIndex {
  final DatabaseSchema databaseSchema;

  private static final List<String> excludeFields = List.of("changeDescription");

  public DatabaseSchemaIndex(DatabaseSchema databaseSchema) {
    this.databaseSchema = databaseSchema;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(databaseSchema);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    return doc;
  }
}
