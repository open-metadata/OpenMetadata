package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class GlossaryIndex implements SearchIndex {
  final Glossary glossary;
  final List<String> excludeFields = List.of("changeDescription");

  public GlossaryIndex(Glossary glossary) {
    this.glossary = glossary;
  }

  public List<SearchSuggest> getSuggest() {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(glossary.getName()).weight(5).build());
    if (glossary.getDisplayName() != null && !glossary.getDisplayName().isEmpty()) {
      suggest.add(SearchSuggest.builder().input(glossary.getDisplayName()).weight(10).build());
    }
    return suggest;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(glossary);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    Map<String, Object> commonAttributes = getCommonAttributesMap(glossary, Entity.GLOSSARY);
    doc.putAll(commonAttributes);
    return doc;
  }
}
