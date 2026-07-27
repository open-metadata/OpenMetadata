package org.openmetadata.service.search.indexes;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.data.MetricDimension;
import org.openmetadata.schema.api.data.MetricMeasure;
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

  @SuppressWarnings("unchecked")
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Set<String> fqnParts =
        doc.get("fqnParts") instanceof Set<?> existing
            ? new HashSet<>((Set<String>) existing)
            : new HashSet<>();
    addDimensionFQNParts(fqnParts, metric.getDimensions());
    addMeasureFQNParts(fqnParts, metric.getMeasures());
    doc.put("fqnParts", fqnParts);
    return doc;
  }

  private void addDimensionFQNParts(Set<String> fqnParts, List<MetricDimension> dimensions) {
    if (CommonUtil.nullOrEmpty(dimensions)) return;
    for (MetricDimension dimension : dimensions) {
      addChildFQNParts(fqnParts, dimension.getFullyQualifiedName());
    }
  }

  private void addMeasureFQNParts(Set<String> fqnParts, List<MetricMeasure> measures) {
    if (CommonUtil.nullOrEmpty(measures)) return;
    for (MetricMeasure measure : measures) {
      addChildFQNParts(fqnParts, measure.getFullyQualifiedName());
    }
  }

  private void addChildFQNParts(Set<String> fqnParts, String fqn) {
    if (fqn == null) return;
    fqnParts.addAll(getFQNParts(fqn));
  }
}
