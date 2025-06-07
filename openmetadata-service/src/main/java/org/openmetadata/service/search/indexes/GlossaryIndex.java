package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.service.Entity;

public class GlossaryIndex implements SearchIndex {
  final Glossary glossary;

  public GlossaryIndex(Glossary glossary) {
    this.glossary = glossary;
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
