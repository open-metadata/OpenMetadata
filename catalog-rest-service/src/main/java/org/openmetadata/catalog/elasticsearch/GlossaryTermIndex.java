package org.openmetadata.catalog.elasticsearch;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.catalog.entity.data.GlossaryTerm;
import org.openmetadata.catalog.util.JsonUtils;

public class GlossaryTermIndex implements ElasticSearchIndex {
  GlossaryTerm glossaryTerm;
  final List<String> excludeFields = List.of("changeDescription");

  public GlossaryTermIndex(GlossaryTerm glossaryTerm) {
    this.glossaryTerm = glossaryTerm;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(glossaryTerm);
    ElasticSearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<ElasticSearchSuggest> suggest = new ArrayList<>();
    suggest.add(ElasticSearchSuggest.builder().input(glossaryTerm.getName()).weight(5).build());
    suggest.add(ElasticSearchSuggest.builder().input(glossaryTerm.getDisplayName()).weight(10).build());
    doc.put("suggest", suggest);
    return doc;
  }
}
