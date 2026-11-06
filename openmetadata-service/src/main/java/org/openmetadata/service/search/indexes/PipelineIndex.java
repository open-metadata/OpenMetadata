package org.openmetadata.service.search.indexes;

import java.util.Map;
import java.util.Set;
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
  public Set<String> getRequiredReindexFields() {
    Set<String> fields = new java.util.HashSet<>(DataAssetIndex.super.getRequiredReindexFields());
    fields.add("tasks");
    return java.util.Collections.unmodifiableSet(fields);
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
