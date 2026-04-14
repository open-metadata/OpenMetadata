package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.service.Entity;

public class PipelineIndex implements DataAssetIndex {
  final Pipeline pipeline;

  public PipelineIndex(Pipeline pipeline) {
    this.pipeline = pipeline;
  }

  @Override
  public Object getEntity() {
    return pipeline;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.PIPELINE;
  }

  @Override
  public Object getIndexServiceType() {
    return pipeline.getServiceType();
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    doc.put("name", pipeline.getName() != null ? pipeline.getName() : pipeline.getDisplayName());
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("tasks.name", 8.0f);
    fields.put("tasks.description", 1.0f);
    return fields;
  }
}
