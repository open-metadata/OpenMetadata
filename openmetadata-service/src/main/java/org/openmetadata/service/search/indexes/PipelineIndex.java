package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.type.Task;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class PipelineIndex implements SearchIndex {

  final Pipeline pipeline;
  final List<String> excludeFields = List.of("changeDescription");

  public PipelineIndex(Pipeline pipeline) {
    this.pipeline = pipeline;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(pipeline);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<SearchSuggest> suggest = new ArrayList<>();
    List<SearchSuggest> serviceSuggest = new ArrayList<>();
    List<SearchSuggest> taskSuggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(pipeline.getFullyQualifiedName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(pipeline.getDisplayName()).weight(10).build());
    serviceSuggest.add(SearchSuggest.builder().input(pipeline.getService().getName()).weight(5).build());
    if (pipeline.getTasks() != null) {
      for (Task task : pipeline.getTasks()) {
        taskSuggest.add(SearchSuggest.builder().input(task.getName()).weight(5).build());
      }
    }
    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.PIPELINE, pipeline));
    doc.put("name", pipeline.getName() != null ? pipeline.getName() : pipeline.getDisplayName());
    doc.put("displayName", pipeline.getDisplayName() != null ? pipeline.getDisplayName() : pipeline.getName());
    doc.put("followers", SearchIndexUtils.parseFollowers(pipeline.getFollowers()));
    doc.put("tags", parseTags.getTags());
    doc.put("tier", parseTags.getTierTag());
    doc.put("suggest", suggest);
    doc.put("task_suggest", taskSuggest);
    doc.put("service_suggest", serviceSuggest);
    doc.put("entityType", Entity.PIPELINE);
    doc.put("serviceType", pipeline.getServiceType());
    doc.put(
      "fqnParts",
      getFQNParts(
        pipeline.getFullyQualifiedName(),
        suggest.stream().map(SearchSuggest::getInput).collect(Collectors.toList())
      )
    );
    doc.put("owner", getEntityWithDisplayName(pipeline.getOwner()));
    doc.put("service", getEntityWithDisplayName(pipeline.getService()));
    doc.put("domain", getEntityWithDisplayName(pipeline.getDomain()));
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("tasks.name", 2.0f);
    fields.put("tasks.description", 1.0f);
    return fields;
  }
}
