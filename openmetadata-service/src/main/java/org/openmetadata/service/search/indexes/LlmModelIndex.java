package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.ai.LLMModel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;

public class LlmModelIndex implements SearchIndex {
  final LLMModel llmModel;

  public LlmModelIndex(LLMModel llmModel) {
    this.llmModel = llmModel;
  }

  @Override
  public Object getEntity() {
    return llmModel;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.LLM_MODEL, llmModel));
    Map<String, Object> commonAttributes = getCommonAttributesMap(llmModel, Entity.LLM_MODEL);
    doc.putAll(commonAttributes);
    doc.put("tags", parseTags.getTags());
    doc.put("tier", parseTags.getTierTag());
    doc.put("upstreamLineage", SearchIndex.getLineageData(llmModel.getEntityReference()));
    if (llmModel.getService() != null) {
      doc.put("service", getEntityWithDisplayName(llmModel.getService()));
    }
    return doc;
  }
}
