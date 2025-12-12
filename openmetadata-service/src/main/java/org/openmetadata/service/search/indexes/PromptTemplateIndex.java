package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.ai.PromptTemplate;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;

public class PromptTemplateIndex implements SearchIndex {
  final PromptTemplate promptTemplate;

  public PromptTemplateIndex(PromptTemplate promptTemplate) {
    this.promptTemplate = promptTemplate;
  }

  @Override
  public Object getEntity() {
    return promptTemplate;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    ParseTags parseTags =
        new ParseTags(Entity.getEntityTags(Entity.PROMPT_TEMPLATE, promptTemplate));
    Map<String, Object> commonAttributes =
        getCommonAttributesMap(promptTemplate, Entity.PROMPT_TEMPLATE);
    doc.putAll(commonAttributes);
    doc.put("tags", parseTags.getTags());
    doc.put("tier", parseTags.getTierTag());
    doc.put("upstreamLineage", SearchIndex.getLineageData(promptTemplate.getEntityReference()));
    return doc;
  }
}
