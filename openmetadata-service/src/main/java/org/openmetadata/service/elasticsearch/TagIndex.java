package org.openmetadata.service.elasticsearch;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.JsonUtils;

public class TagIndex implements ElasticSearchIndex {
  final Tag tag;

  public TagIndex(Tag tag) {
    this.tag = tag;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(tag);
    List<ElasticSearchSuggest> suggest = new ArrayList<>();
    suggest.add(ElasticSearchSuggest.builder().input(tag.getFullyQualifiedName()).weight(5).build());
    suggest.add(ElasticSearchSuggest.builder().input(tag.getName()).weight(10).build());
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.TAG);
    return doc;
  }
}
