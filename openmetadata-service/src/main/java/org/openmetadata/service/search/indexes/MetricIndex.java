package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.service.Entity;

public class MetricIndex implements TaggableIndex, LineageIndex {
  final Metric metric;

  public MetricIndex(Metric metric) {
    this.metric = metric;
  }

  @Override
  public Object getEntity() {
    return metric;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.METRIC;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    return doc;
  }
}
