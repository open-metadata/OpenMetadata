package org.openmetadata.service.search.indexes;

import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.util.JsonUtils;

public class DatabaseServiceIndex implements ElasticSearchIndex {

  final DatabaseService databaseService;

  private static final List<String> excludeFields = List.of("changeDescription");

  public DatabaseServiceIndex(DatabaseService databaseService) {
    this.databaseService = databaseService;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(databaseService);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    return doc;
  }
}
