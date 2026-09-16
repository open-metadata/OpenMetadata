package org.openmetadata.service.search.indexes;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;
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

  @Override
  public Set<String> getRequiredReindexFields() {
    Set<String> fields = new HashSet<>(DataAssetIndex.super.getRequiredReindexFields());
    // "service" is stripped from the stored JSON (StoredProcedureRepository
    // .getFieldsStrippedFromStorageJson) and re-derived from the parent schema, gated behind
    // "service"/"databaseSchema"/"database" in setFieldsInBulk. Reindex fetches only the declared
    // fields, so without this the ServiceBackedIndex mixin sees a null service and drops it from
    // the search doc.
    fields.add(Entity.FIELD_SERVICE);
    return Set.copyOf(fields);
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    doc.put("processedLineage", storedProcedure.getProcessedLineage());
    return doc;
  }

  public static Map<String, Float> getFields() {
    return SearchIndex.getDefaultFields();
  }
}
