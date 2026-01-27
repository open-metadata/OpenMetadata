package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;

public class AiApplicationIndex implements SearchIndex {
  final AIApplication aiApplication;

  public AiApplicationIndex(AIApplication aiApplication) {
    this.aiApplication = aiApplication;
  }

  @Override
  public Object getEntity() {
    return aiApplication;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.AI_APPLICATION, aiApplication));
    Map<String, Object> commonAttributes =
        getCommonAttributesMap(aiApplication, Entity.AI_APPLICATION);
    doc.putAll(commonAttributes);
    doc.put("tags", parseTags.getTags());
    doc.put("tier", parseTags.getTierTag());
    doc.put("upstreamLineage", SearchIndex.getLineageData(aiApplication.getEntityReference()));
    return doc;
  }
}
