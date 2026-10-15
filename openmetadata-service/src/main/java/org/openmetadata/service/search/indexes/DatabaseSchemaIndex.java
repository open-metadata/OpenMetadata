package org.openmetadata.service.search.indexes;

import java.util.Collections;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.service.Entity;

public record DatabaseSchemaIndex(DatabaseSchema databaseSchema)
    implements TaggableIndex, ServiceBackedIndex {

  @Override
  public Object getEntity() {
    return databaseSchema;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.DATABASE_SCHEMA;
  }

  @Override
  public Set<String> getExcludedFields() {
    return Set.of("tables");
  }

  @Override
  public Set<String> getRequiredReindexFields() {
    final Set<String> fields = new HashSet<>(TaggableIndex.super.getRequiredReindexFields());
    fields.add("usageSummary");
    return Collections.unmodifiableSet(fields);
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    return doc;
  }
}
