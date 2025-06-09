package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;

public class PipelineIndex implements SearchIndex {
  final Pipeline pipeline;

  public PipelineIndex(Pipeline pipeline) {
    this.pipeline = pipeline;
  }

  @Override
  public Object getEntity() {
    return pipeline;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.PIPELINE, pipeline));
    Map<String, Object> commonAttributes = getCommonAttributesMap(pipeline, Entity.PIPELINE);
    doc.putAll(commonAttributes);
    doc.put("name", pipeline.getName() != null ? pipeline.getName() : pipeline.getDisplayName());
    doc.put("tags", parseTags.getTags());
    doc.put("tier", parseTags.getTierTag());
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
