package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.ai.PromptTemplate;
import org.openmetadata.service.Entity;

public class PromptTemplateIndex implements TaggableIndex, LineageIndex {
  final PromptTemplate promptTemplate;

  public PromptTemplateIndex(PromptTemplate promptTemplate) {
    this.promptTemplate = promptTemplate;
  }

  @Override
  public Object getEntity() {
    return promptTemplate;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.PROMPT_TEMPLATE;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    return doc;
  }
}
