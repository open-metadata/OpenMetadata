package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.service.util.JsonUtils;

public class DatabaseServiceIndex implements ElasticSearchIndex {

  final DatabaseService databaseService;

  public DatabaseServiceIndex(DatabaseService databaseService) {
    this.databaseService = databaseService;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(databaseService);
    return doc;
  }
}
