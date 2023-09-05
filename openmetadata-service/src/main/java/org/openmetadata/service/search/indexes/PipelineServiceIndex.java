package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.service.util.JsonUtils;

public class PipelineServiceIndex implements ElasticSearchIndex {

  final PipelineService pipelineService;

  public PipelineServiceIndex(PipelineService pipelineService) {
    this.pipelineService = pipelineService;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(pipelineService);
    return doc;
  }
}
