package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class TagIndex implements ElasticSearchIndex {
  final Tag tag;
  private static final List<String> excludeFields = List.of("changeDescription");

  public TagIndex(Tag tag) {
    this.tag = tag;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(tag);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(tag.getFullyQualifiedName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(tag.getName()).weight(10).build());
    if (tag.getDisabled() != null && tag.getDisabled()) {
      doc.put("disabled", tag.getDisabled());
    } else {
      doc.put("disabled", "false");
    }
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.TAG);
    return doc;
  }
}
