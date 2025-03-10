package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.type.Task;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.models.SearchSuggest;

public class PipelineIndex implements SearchIndex {
  final Pipeline pipeline;

  public PipelineIndex(Pipeline pipeline) {
    this.pipeline = pipeline;
  }

  @Override
  public List<SearchSuggest> getSuggest() {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(pipeline.getFullyQualifiedName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(pipeline.getDisplayName()).weight(10).build());
    return suggest;
  }

  @Override
  public Object getEntity() {
    return pipeline;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    List<SearchSuggest> serviceSuggest = new ArrayList<>();
    List<SearchSuggest> taskSuggest = new ArrayList<>();
    serviceSuggest.add(
        SearchSuggest.builder()
            .input((pipeline.getService() != null ? pipeline.getService().getName() : null))
            .weight(5)
            .build());
    if (pipeline.getTasks() != null) {
      for (Task task : pipeline.getTasks()) {
        taskSuggest.add(SearchSuggest.builder().input(task.getName()).weight(5).build());
      }
    }
    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.PIPELINE, pipeline));
    Map<String, Object> commonAttributes = getCommonAttributesMap(pipeline, Entity.PIPELINE);
    doc.putAll(commonAttributes);
    doc.put("name", pipeline.getName() != null ? pipeline.getName() : pipeline.getDisplayName());
    doc.put("tags", parseTags.getTags());
    doc.put("tier", parseTags.getTierTag());
    doc.put("task_suggest", taskSuggest);
    doc.put("service_suggest", serviceSuggest);
    doc.put("serviceType", pipeline.getServiceType());
    doc.put("upstreamLineage", SearchIndex.getLineageData(pipeline.getEntityReference()));
    doc.put("service", getEntityWithDisplayName(pipeline.getService()));
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("tasks.name", 8.0f);
    fields.put("tasks.description", 1.0f);
    return fields;
  }
}
