/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.Entity.METRIC;

import java.util.List;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.metrics.MetricResource;
import org.openmetadata.service.util.EntityUtil;

public class MetricRepository extends EntityRepository<Metric> {
  private static final String UPDATE_FIELDS = "relatedMetrics";
  private static final String PATCH_FIELDS = "relatedMetrics";

  public MetricRepository() {
    super(
        MetricResource.COLLECTION_PATH,
        Entity.METRIC,
        Metric.class,
        Entity.getCollectionDAO().metricDAO(),
        PATCH_FIELDS,
        UPDATE_FIELDS);
    supportsSearch = true;
    renameAllowed = true;
  }

  @Override
  public void setFullyQualifiedName(Metric metric) {
    metric.setFullyQualifiedName(metric.getName());
  }

  @Override
  public void prepare(Metric metric, boolean update) {
    validateRelatedTerms(metric, metric.getRelatedMetrics());
  }

  @Override
  public void setFields(Metric metric, EntityUtil.Fields fields) {
    metric.setRelatedMetrics(
        fields.contains("relatedMetrics") ? getRelatedMetrics(metric) : metric.getRelatedMetrics());
  }

  @Override
  protected void clearFields(Metric entity, EntityUtil.Fields fields) {
    entity.setRelatedMetrics(fields.contains("relatedMetrics") ? entity.getRelatedMetrics() : null);
  }

  @Override
  public void storeEntity(Metric metric, boolean update) {
    List<EntityReference> relatedMetrics = metric.getRelatedMetrics();
    metric.setRelatedMetrics(null);
    store(metric, update);
    metric.setRelatedMetrics(relatedMetrics);
  }

  @Override
  public void storeRelationships(Metric metric) {
    // Nothing to do
    for (EntityReference relatedMetric : listOrEmpty(metric.getRelatedMetrics())) {
      addRelationship(
          metric.getId(), relatedMetric.getId(), METRIC, METRIC, Relationship.RELATED_TO, true);
    }
  }

  private List<EntityReference> getRelatedMetrics(Metric metric) {
    return findBoth(metric.getId(), METRIC, Relationship.RELATED_TO, METRIC);
  }

  @Override
  public EntityRepository<Metric>.EntityUpdater getUpdater(
      Metric original, Metric updated, Operation operation, ChangeSource changeSource) {
    return new MetricRepository.MetricUpdater(original, updated, operation);
  }

  private void validateRelatedTerms(Metric metric, List<EntityReference> relatedMetrics) {
    for (EntityReference relatedMetric : listOrEmpty(relatedMetrics)) {
      if (!relatedMetric.getType().equals(METRIC)) {
        throw new IllegalArgumentException(
            "Related metric " + relatedMetric.getId() + " is not a metric");
      }
      if (relatedMetric.getId().equals(metric.getId())) {
        throw new IllegalArgumentException(
            "Related metric " + relatedMetric.getId() + " cannot be the same as the metric");
      }
    }
  }

  public class MetricUpdater extends EntityUpdater {

    public MetricUpdater(Metric original, Metric updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      recordChange("granularity", original.getGranularity(), updated.getGranularity());
      recordChange("metricType", original.getMetricType(), updated.getMetricType());
      recordChange(
          "unitOfMeasurement", original.getUnitOfMeasurement(), updated.getUnitOfMeasurement());
      if (updated.getMetricExpression() != null) {
        recordChange(
            "metricExpression", original.getMetricExpression(), updated.getMetricExpression());
      }
      updateRelatedMetrics(original, updated);
    }

    private void updateRelatedMetrics(Metric original, Metric updated) {
      List<EntityReference> originalRelatedMetrics = listOrEmpty(original.getRelatedMetrics());
      List<EntityReference> updatedRelatedMetrics = listOrEmpty(updated.getRelatedMetrics());
      validateRelatedTerms(updated, updatedRelatedMetrics);
      updateToRelationships(
          "relatedMetrics",
          METRIC,
          original.getId(),
          Relationship.RELATED_TO,
          METRIC,
          originalRelatedMetrics,
          updatedRelatedMetrics,
          true);
    }
  }
}
