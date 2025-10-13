package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.services.LLMService;
import org.openmetadata.service.Entity;

public record LlmServiceIndex(LLMService llmService) implements SearchIndex {

  @Override
  public Object getEntity() {
    return llmService;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Map<String, Object> commonAttributes = getCommonAttributesMap(llmService, Entity.LLM_SERVICE);
    doc.putAll(commonAttributes);
    doc.put("upstreamLineage", SearchIndex.getLineageData(llmService.getEntityReference()));
    return doc;
  }
}
