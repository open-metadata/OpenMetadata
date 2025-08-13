package org.openmetadata.service.resources.metrics;

import static org.openmetadata.service.util.EntityUtil.getEntityReferences;

import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;

public class MetricMapper implements EntityMapper<Metric, CreateMetric> {
  @Override
  public Metric createToEntity(CreateMetric create, String user) {
    return copy(new Metric(), create, user)
        .withMetricExpression(create.getMetricExpression())
        .withGranularity(create.getGranularity())
        .withRelatedMetrics(getEntityReferences(Entity.METRIC, create.getRelatedMetrics()))
        .withMetricType(create.getMetricType())
        .withUnitOfMeasurement(create.getUnitOfMeasurement())
        .withCustomUnitOfMeasurement(create.getCustomUnitOfMeasurement());
  }
}
