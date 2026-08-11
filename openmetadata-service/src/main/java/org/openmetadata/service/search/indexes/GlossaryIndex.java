package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.service.Entity;

public class GlossaryIndex implements TaggableIndex {
  final Glossary glossary;

  public GlossaryIndex(Glossary glossary) {
    this.glossary = glossary;
  }

  @Override
  public Object getEntity() {
    return glossary;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.GLOSSARY;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    return doc;
  }
}
