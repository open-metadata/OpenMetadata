package org.openmetadata.service.search.indexes;

import java.util.Collections;
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
  private static final String FIELD_RELATED_METRICS = "relatedMetrics";

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

  /**
   * {@code relatedMetrics} is in the metric's embedding text, which a reindex reuses only while its
   * fingerprint matches the one the live write path built, so the reindex has to load it too.
   * ADR:2026-11-11-reindex-reuses-an-embedding-only-when-its-fingerprint-matches
   */
  @Override
  public Set<String> getRequiredReindexFields() {
    Set<String> fields = new HashSet<>(TaggableIndex.super.getRequiredReindexFields());
    fields.add(FIELD_RELATED_METRICS);
    return Collections.unmodifiableSet(fields);
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
