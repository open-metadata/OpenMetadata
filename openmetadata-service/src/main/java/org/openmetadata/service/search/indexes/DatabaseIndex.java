package org.openmetadata.service.search.indexes;

import org.openmetadata.schema.entity.data.Database;

public class DatabaseIndex {

  final Database database;

  public DatabaseIndex(Database database) {
    this.database = database;
  }
}
