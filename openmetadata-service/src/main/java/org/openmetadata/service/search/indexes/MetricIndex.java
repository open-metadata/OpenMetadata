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
  private static final String FIELD_CHILDREN_COUNT = "childrenCount";
  private static final Set<String> EXCLUDED_FIELDS = Set.of(Entity.FIELD_CHILDREN);

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
   * The hierarchy fields are computed on read rather than stored, so both the reindex pipeline and
   * the live single-entity update path have to request them explicitly or they never reach the
   * document. {@code children} is deliberately absent: the list view loads a metric's children on
   * demand through {@code GET /v1/metrics?parent={fqn}}, so indexing an unbounded child list would
   * cost document size for nothing.
   */
  @Override
  public Set<String> getRequiredReindexFields() {
    Set<String> fields = new HashSet<>(TaggableIndex.super.getRequiredReindexFields());
    fields.add(Entity.FIELD_PARENT);
    fields.add(FIELD_CHILDREN_COUNT);
    fields.add("metricGroup");
    return Collections.unmodifiableSet(fields);
  }

  @Override
  public Set<String> getExcludedFields() {
    return EXCLUDED_FIELDS;
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
    // Null indexes as `missing` for an integer field, which breaks the numeric range and sort
    // queries that assume the field is always present.
    doc.put(
        FIELD_CHILDREN_COUNT, metric.getChildrenCount() != null ? metric.getChildrenCount() : 0);
    doc.put("metricGroup", metric.getMetricGroup());
    return doc;
  }

  private void addDimensionFQNParts(Set<String> fqnParts, List<MetricDimension> dimensions) {
    if (CommonUtil.nullOrEmpty(dimensions)) {
      return;
    }
    for (MetricDimension dimension : dimensions) {
      addChildFQNParts(fqnParts, dimension.getFullyQualifiedName());
    }
  }

  private void addMeasureFQNParts(Set<String> fqnParts, List<MetricMeasure> measures) {
    if (CommonUtil.nullOrEmpty(measures)) {
      return;
    }
    for (MetricMeasure measure : measures) {
      addChildFQNParts(fqnParts, measure.getFullyQualifiedName());
    }
  }

  private void addChildFQNParts(Set<String> fqnParts, String fqn) {
    if (fqn == null) {
      return;
    }
    fqnParts.addAll(getFQNParts(fqn));
  }
}
