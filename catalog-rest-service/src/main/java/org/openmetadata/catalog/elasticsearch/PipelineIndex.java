package org.openmetadata.catalog.elasticsearch;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Pipeline;
import org.openmetadata.catalog.type.Task;
import org.openmetadata.catalog.util.JsonUtils;

public class PipelineIndex implements ElasticSearchIndex {
  Pipeline pipeline;
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
    suggest.add(ElasticSearchSuggest.builder().input(pipeline.getName()).weight(10).build());
    serviceSuggest.add(ElasticSearchSuggest.builder().input(pipeline.getService().getName()).weight(5).build());
    ParseTags parseTags = new ParseTags(ElasticSearchIndexUtils.parseTags(pipeline.getTags()));
    if (pipeline.getTasks() != null) {
      for (Task task : pipeline.getTasks()) {
        taskSuggest.add(ElasticSearchSuggest.builder().input(task.getName()).weight(5).build());
      }
    }
    doc.put("name", pipeline.getDisplayName() != null ? pipeline.getDisplayName() : pipeline.getName());
    doc.put("followers", ElasticSearchIndexUtils.parseFollowers(pipeline.getFollowers()));
    doc.put("tags", parseTags.tags);
    doc.put("tier", parseTags.tierTag);
    doc.put("suggest", suggest);
    doc.put("task_suggest", taskSuggest);
    doc.put("service_suggest", serviceSuggest);
    doc.put("entityType", Entity.PIPELINE);
    if (pipeline.getService() != null) {
      doc.put("serviceType", pipeline.getService().getName());
    }
    return doc;
  }
}
