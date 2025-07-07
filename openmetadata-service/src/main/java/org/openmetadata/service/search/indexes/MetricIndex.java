package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.service.Entity;

public class MetricIndex implements SearchIndex {
  final Metric metric;

  public MetricIndex(Metric metric) {
    this.metric = metric;
  }

  @Override
  public Object getEntity() {
    return metric;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Map<String, Object> commonAttributes = getCommonAttributesMap(metric, Entity.METRIC);
    doc.putAll(commonAttributes);
    doc.put("upstreamLineage", SearchIndex.getLineageData(metric.getEntityReference()));
    return doc;
  }
}
