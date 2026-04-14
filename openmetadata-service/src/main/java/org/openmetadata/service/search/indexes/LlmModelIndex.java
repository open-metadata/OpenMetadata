package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.ai.LLMModel;
import org.openmetadata.service.Entity;

public class LlmModelIndex implements TaggableIndex, ServiceBackedIndex, LineageIndex {
  final LLMModel llmModel;

  public LlmModelIndex(LLMModel llmModel) {
    this.llmModel = llmModel;
  }

  @Override
  public Object getEntity() {
    return llmModel;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.LLM_MODEL;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    return doc;
  }
}
