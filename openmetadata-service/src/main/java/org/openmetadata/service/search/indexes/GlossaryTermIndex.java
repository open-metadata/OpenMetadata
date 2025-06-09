package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.service.Entity;

public class GlossaryTermIndex implements SearchIndex {
  final GlossaryTerm glossaryTerm;

  public GlossaryTermIndex(GlossaryTerm glossaryTerm) {
    this.glossaryTerm = glossaryTerm;
  }

  @Override
  public Object getEntity() {
    return glossaryTerm;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Map<String, Object> commonAttributes =
        getCommonAttributesMap(glossaryTerm, Entity.GLOSSARY_TERM);
    doc.putAll(commonAttributes);
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("synonyms", 5.0f);
    fields.put("synonyms.ngram", 1.0f);
    fields.put("glossary.name", 5.0f);
    fields.put("glossary.displayName", 5.0f);
    return fields;
  }
}
