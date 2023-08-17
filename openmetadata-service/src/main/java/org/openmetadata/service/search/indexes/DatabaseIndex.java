package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.service.util.JsonUtils;

public class DatabaseIndex {

  final Database database;

  public DatabaseIndex(Database database) {
    this.database = database;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(database);
    return doc;
  }
}
