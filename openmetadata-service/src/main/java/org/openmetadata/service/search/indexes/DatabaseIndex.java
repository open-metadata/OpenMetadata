package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.service.Entity;

public record DatabaseIndex(Database database) implements SearchIndex {
  @Override
  public Object getEntity() {
    return database;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Map<String, Object> commonAttributes = getCommonAttributesMap(database, Entity.DATABASE);
    doc.putAll(commonAttributes);
    return doc;
  }
}
