package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.models.SearchSuggest;

public record TagIndex(Tag tag) implements SearchIndex {

  @Override
  public List<SearchSuggest> getSuggest() {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(tag.getFullyQualifiedName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(tag.getName()).weight(10).build());
    return suggest;
  }

  @Override
  public Object getEntity() {
    return tag;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Map<String, Object> commonAttributes = getCommonAttributesMap(tag, Entity.TAG);
    doc.putAll(commonAttributes);
    if (tag.getDisabled() != null && tag.getDisabled()) {
      doc.put("disabled", tag.getDisabled());
    } else {
      doc.put("disabled", "false");
    }
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("classification.name", 7.0f);
    return fields;
  }
}
