package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;

public record TagIndex(Tag tag) implements SearchIndex {

  @Override
  public Object getEntity() {
    return tag;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(tag.getFullyQualifiedName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(tag.getName()).weight(10).build());
    doc.put(
        "fqnParts",
        getFQNParts(
            tag.getFullyQualifiedName(), suggest.stream().map(SearchSuggest::getInput).toList()));
    if (tag.getDisabled() != null && tag.getDisabled()) {
      doc.put("disabled", tag.getDisabled());
    } else {
      doc.put("disabled", "false");
    }
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.TAG);
    doc.put("followers", SearchIndexUtils.parseFollowers(tag.getFollowers()));
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("classification.name", 7.0f);
    return fields;
  }
}
