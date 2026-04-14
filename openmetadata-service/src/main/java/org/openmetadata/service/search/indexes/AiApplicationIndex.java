package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.service.Entity;

public class AiApplicationIndex implements TaggableIndex, LineageIndex {
  final AIApplication aiApplication;

  public AiApplicationIndex(AIApplication aiApplication) {
    this.aiApplication = aiApplication;
  }

  @Override
  public Object getEntity() {
    return aiApplication;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.AI_APPLICATION;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    return doc;
  }
}
