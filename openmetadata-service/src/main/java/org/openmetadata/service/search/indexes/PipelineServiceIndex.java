package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.service.Entity;

public record PipelineServiceIndex(PipelineService pipelineService) implements SearchIndex {
  @Override
  public Object getEntity() {
    return pipelineService;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Map<String, Object> commonAttributes =
        getCommonAttributesMap(pipelineService, Entity.PIPELINE_SERVICE);
    doc.putAll(commonAttributes);
    doc.put("upstreamLineage", SearchIndex.getLineageData(pipelineService.getEntityReference()));
    return doc;
  }
}
