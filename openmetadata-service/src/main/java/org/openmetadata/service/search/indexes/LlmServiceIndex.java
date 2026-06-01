package org.openmetadata.service.search.indexes;

import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.services.LLMService;
import org.openmetadata.service.Entity;

public record LlmServiceIndex(LLMService llmService) implements TaggableIndex, LineageIndex {

  @Override
  public Object getEntity() {
    return llmService;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.LLM_SERVICE;
  }

  @Override
  public Set<String> getExcludedFields() {
    return Set.of("models");
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    return doc;
  }
}
