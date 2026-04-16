package org.openmetadata.service.search.indexes;

import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;

public class GlossaryTermIndex implements TaggableIndex {
  final GlossaryTerm glossaryTerm;

  public GlossaryTermIndex(GlossaryTerm glossaryTerm) {
    this.glossaryTerm = glossaryTerm;
  }

  @Override
  public Object getEntity() {
    return glossaryTerm;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.GLOSSARY_TERM;
  }

  @Override
  public Set<String> getExcludedFields() {
    return Set.of("children");
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    if (doc.containsKey("glossary") && glossaryTerm.getGlossary() != null) {
      @SuppressWarnings("unchecked")
      Map<String, Object> glossaryMap = (Map<String, Object>) doc.get("glossary");
      Glossary glossary =
          Entity.getEntityOrNull(
              glossaryTerm.getGlossary(), "mutuallyExclusive", Include.NON_DELETED);
      if (glossary != null && glossary.getMutuallyExclusive() != null) {
        glossaryMap.put("mutuallyExclusive", glossary.getMutuallyExclusive());
      }
    }

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
