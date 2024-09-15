package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.models.SearchSuggest;

public class GlossaryIndex implements SearchIndex {
  final Glossary glossary;

  public GlossaryIndex(Glossary glossary) {
    this.glossary = glossary;
  }

  @Override
  public List<SearchSuggest> getSuggest() {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(glossary.getName()).weight(5).build());
    if (glossary.getDisplayName() != null && !glossary.getDisplayName().isEmpty()) {
      suggest.add(SearchSuggest.builder().input(glossary.getDisplayName()).weight(10).build());
    }
    return suggest;
  }

  @Override
  public Object getEntity() {
    return glossary;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Map<String, Object> commonAttributes = getCommonAttributesMap(glossary, Entity.GLOSSARY);
    doc.putAll(commonAttributes);
    return doc;
  }
}
