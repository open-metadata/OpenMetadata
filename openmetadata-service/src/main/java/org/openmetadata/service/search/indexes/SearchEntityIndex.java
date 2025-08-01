package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;

public record SearchEntityIndex(org.openmetadata.schema.entity.data.SearchIndex searchIndex)
    implements SearchIndex {

  @Override
  public Object getEntity() {
    return searchIndex;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Map<String, Object> commonAttributes = getCommonAttributesMap(searchIndex, Entity.SEARCH_INDEX);
    doc.putAll(commonAttributes);
    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.SEARCH_INDEX, searchIndex));
    doc.put("tags", parseTags.getTags());
    doc.put("tier", parseTags.getTierTag());
    doc.put("service", getEntityWithDisplayName(searchIndex.getService()));
    doc.put("indexType", searchIndex.getIndexType());
    doc.put("upstreamLineage", SearchIndex.getLineageData(searchIndex.getEntityReference()));
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("fields.name", 7.0f);
    fields.put("fields.name.keyword", 50f);
    fields.put("fields.children.description", 1.0f);
    fields.put("fields.children.name", 7.0f);
    fields.put("fields.children.name.keyword", 5.0f);
    return fields;
  }
}
