package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.service.Entity;

public record PipelineServiceIndex(PipelineService pipelineService)
    implements TaggableIndex, LineageIndex {
  @Override
  public Object getEntity() {
    return pipelineService;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.PIPELINE_SERVICE;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    return doc;
  }
}
