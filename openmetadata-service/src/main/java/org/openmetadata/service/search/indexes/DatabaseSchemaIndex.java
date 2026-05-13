package org.openmetadata.service.search.indexes;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.service.Entity;

public record DatabaseSchemaIndex(DatabaseSchema databaseSchema) implements SearchIndex {

  @Override
  public Object getEntity() {
    return databaseSchema;
  }

  @Override
  public Set<String> getExcludedFields() {
    return Set.of("tables");
  }

  /**
   * Opt out of the wildcard reindex default. DatabaseSchema.tables is the fan-out relationship
   * that motivated PR #27723 in the first place — loading every child table per schema can OOM
   * an instance with thousands of tables. We return the common relationship set (which does
   * <em>not</em> include {@code "tables"}), so reindex pulls the relationships the doc actually
   * needs and skips the heavy one.
   */
  @Override
  public Set<String> getRequiredReindexFields() {
    return java.util.Collections.unmodifiableSet(new HashSet<>(COMMON_REINDEX_FIELDS));
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Map<String, Object> commonAttributes =
        getCommonAttributesMap(databaseSchema, Entity.DATABASE_SCHEMA);
    doc.putAll(commonAttributes);
    return doc;
  }
}
