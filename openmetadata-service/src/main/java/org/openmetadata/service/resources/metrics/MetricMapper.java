package org.openmetadata.service.resources.metrics;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.util.EntityUtil.getEntityReferences;

import java.util.List;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityReferenceInput;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;

public class MetricMapper implements EntityMapper<Metric, CreateMetric> {
  @Override
  public Metric createToEntity(CreateMetric create, String user) {
    return copy(new Metric(), create, user)
        .withMetricExpression(create.getMetricExpression())
        .withGranularity(create.getGranularity())
        .withRelatedMetrics(getEntityReferences(Entity.METRIC, create.getRelatedMetrics()))
        .withAssets(toEntityReferences(create.getAssets()))
        .withMetricType(create.getMetricType())
        .withUnitOfMeasurement(create.getUnitOfMeasurement())
        .withCustomUnitOfMeasurement(create.getCustomUnitOfMeasurement())
        .withDimensions(create.getDimensions())
        .withMeasures(create.getMeasures())
        .withFilters(create.getFilters());
  }

  /**
   * Converts inbound asset references, leaving them unresolved. MetricRepository#prepare runs
   * them through EntityUtil#populateEntityReferences, which resolves fullyQualifiedName to id
   * and drops references whose target does not exist.
   *
   * @param inputs inbound references, each keyed by id or fullyQualifiedName
   * @return unresolved references, or null when there are none
   */
  private static List<EntityReference> toEntityReferences(List<EntityReferenceInput> inputs) {
    List<EntityReference> result = null;
    if (!nullOrEmpty(inputs)) {
      result = inputs.stream().map(MetricMapper::toEntityReference).toList();
    }
    return result;
  }

  private static EntityReference toEntityReference(EntityReferenceInput input) {
    if (input.getId() == null && input.getFullyQualifiedName() == null) {
      throw new IllegalArgumentException(
          String.format(
              "Asset reference of type '%s' must set either 'id' or 'fullyQualifiedName'",
              input.getType()));
    }
    return new EntityReference()
        .withId(input.getId())
        .withType(input.getType())
        .withFullyQualifiedName(input.getFullyQualifiedName())
        .withName(input.getName())
        .withDescription(input.getDescription())
        .withDisplayName(input.getDisplayName())
        .withDeleted(input.getDeleted())
        .withInherited(input.getInherited())
        .withHref(input.getHref());
  }
}
