package org.openmetadata.service.search.indexes;

import java.util.Collections;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.openmetadata.service.Entity;

public record SearchEntityIndex(org.openmetadata.schema.entity.data.SearchIndex searchIndex)
    implements DataAssetIndex {

  @Override
  public Object getEntity() {
    return searchIndex;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.SEARCH_INDEX;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    doc.put("indexType", searchIndex.getIndexType());
    return doc;
  }

  @Override
  public Set<String> getRequiredReindexFields() {
    // SearchIndexRepository.bulkPopulateEntityFieldTags only hydrates field-level tags when fields
    // contains "fields"; without it a reindex drops the search index's field tags from _source.
    Set<String> fields = new HashSet<>(DataAssetIndex.super.getRequiredReindexFields());
    fields.add("fields");
    return Collections.unmodifiableSet(fields);
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("fields.name", 7.0f);
    fields.put("fields.name.keyword", 50f);
    fields.put("fields.children.description", 1.0f);
    fields.put("fields.children.name", 7.0f);
    return fields;
  }
}
