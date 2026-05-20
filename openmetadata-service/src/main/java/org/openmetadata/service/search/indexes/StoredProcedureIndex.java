package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.service.Entity;

public record StoredProcedureIndex(StoredProcedure storedProcedure) implements DataAssetIndex {

  @Override
  public Object getEntity() {
    return storedProcedure;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.STORED_PROCEDURE;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    doc.put("processedLineage", storedProcedure.getProcessedLineage());
    return doc;
  }

  public static Map<String, Float> getFields() {
    return SearchIndex.getDefaultFields();
  }
}
