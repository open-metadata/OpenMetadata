package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.service.Entity;

public record TagIndex(Tag tag) implements SearchIndex {

  @Override
  public Object getEntity() {
    return tag;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.TAG;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    doc.put("disabled", tag.getDisabled() != null && tag.getDisabled());
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("classification.name", 7.0f);
    return fields;
  }
}
