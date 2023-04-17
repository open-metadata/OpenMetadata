package org.openmetadata.service.elasticsearch;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.type.Task;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.JsonUtils;

public class PipelineIndex implements ElasticSearchIndex {
  final Pipeline pipeline;
  final List<String> excludeFields = List.of("changeDescription");

  public PipelineIndex(Pipeline pipeline) {
    this.pipeline = pipeline;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(pipeline);
    ElasticSearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<ElasticSearchSuggest> suggest = new ArrayList<>();
    List<ElasticSearchSuggest> serviceSuggest = new ArrayList<>();
    List<ElasticSearchSuggest> taskSuggest = new ArrayList<>();
    suggest.add(ElasticSearchSuggest.builder().input(pipeline.getFullyQualifiedName()).weight(5).build());
    suggest.add(ElasticSearchSuggest.builder().input(pipeline.getDisplayName()).weight(10).build());
    serviceSuggest.add(ElasticSearchSuggest.builder().input(pipeline.getService().getName()).weight(5).build());
    if (pipeline.getTasks() != null) {
      for (Task task : pipeline.getTasks()) {
        taskSuggest.add(ElasticSearchSuggest.builder().input(task.getName()).weight(5).build());
      }
    }
    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.PIPELINE, pipeline));
    doc.put("name", pipeline.getName() != null ? pipeline.getName() : pipeline.getDisplayName());
    doc.put("displayName", pipeline.getDisplayName() != null ? pipeline.getDisplayName() : pipeline.getName());
    doc.put("followers", ElasticSearchIndexUtils.parseFollowers(pipeline.getFollowers()));
    doc.put("tags", parseTags.tags);
    doc.put("tier", parseTags.tierTag);
    doc.put("suggest", suggest);
    doc.put("task_suggest", taskSuggest);
    doc.put("service_suggest", serviceSuggest);
    doc.put("entityType", Entity.PIPELINE);
    doc.put("serviceType", pipeline.getServiceType());
    return doc;
  }
}
