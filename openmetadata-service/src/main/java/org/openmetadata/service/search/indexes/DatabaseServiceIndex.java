package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.service.Entity;

public record DatabaseServiceIndex(DatabaseService databaseService) implements SearchIndex {

  @Override
  public Object getEntity() {
    return databaseService;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Map<String, Object> commonAttributes =
        getCommonAttributesMap(databaseService, Entity.DATABASE_SERVICE);
    doc.putAll(commonAttributes);
    doc.put("upstreamLineage", SearchIndex.getLineageData(databaseService.getEntityReference()));
    return doc;
  }
}
