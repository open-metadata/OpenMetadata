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
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.METRIC;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetricUnitOfMeasurement;
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

    // Register bulk field fetchers for efficient database operations
    fieldFetchers.put("relatedMetrics", this::fetchAndSetRelatedMetrics);
  }

  @Override
  public void setFullyQualifiedName(Metric metric) {
    metric.setFullyQualifiedName(metric.getName());
  }

  @Override
  public void prepare(Metric metric, boolean update) {
    validateRelatedTerms(metric, metric.getRelatedMetrics());
    validateCustomUnitOfMeasurement(metric);
  }

  private void validateCustomUnitOfMeasurement(Metric metric) {
    MetricUnitOfMeasurement unitOfMeasurement = metric.getUnitOfMeasurement();
    String customUnit = metric.getCustomUnitOfMeasurement();

    if (unitOfMeasurement == MetricUnitOfMeasurement.OTHER) {
      if (CommonUtil.nullOrEmpty(customUnit)) {
        throw new IllegalArgumentException(
            "customUnitOfMeasurement is required when unitOfMeasurement is OTHER");
      }
      // Trim and normalize
      metric.setCustomUnitOfMeasurement(customUnit.trim());
    } else {
      // Clear custom unit if not OTHER to maintain consistency
      metric.setCustomUnitOfMeasurement(null);
    }
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

  // Individual field fetchers registered in constructor
  private void fetchAndSetRelatedMetrics(List<Metric> metrics, EntityUtil.Fields fields) {
    if (!fields.contains("relatedMetrics") || metrics == null || metrics.isEmpty()) {
      return;
    }
    // Use bulk relationship fetching for related metrics
    setFieldFromMap(true, metrics, batchFetchRelatedMetrics(metrics), Metric::setRelatedMetrics);
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
      recordChange(
          "customUnitOfMeasurement",
          original.getCustomUnitOfMeasurement(),
          updated.getCustomUnitOfMeasurement());
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

  public List<String> getDistinctCustomUnitsOfMeasurement() {
    // Execute efficient database query to get distinct custom units
    return daoCollection.metricDAO().getDistinctCustomUnitsOfMeasurement();
  }

  private Map<UUID, List<EntityReference>> batchFetchRelatedMetrics(List<Metric> metrics) {
    Map<UUID, List<EntityReference>> relatedMetricsMap = new HashMap<>();
    if (metrics == null || metrics.isEmpty()) {
      return relatedMetricsMap;
    }

    // Initialize empty lists for all metrics
    for (Metric metric : metrics) {
      relatedMetricsMap.put(metric.getId(), new ArrayList<>());
    }

    // For bidirectional relationships, we need to fetch both directions
    // First, get relationships where these metrics are the source
    List<CollectionDAO.EntityRelationshipObject> records =
        daoCollection
            .relationshipDAO()
            .findToBatch(entityListToStrings(metrics), Relationship.RELATED_TO.ordinal(), METRIC);

    // Group related metrics by source metric ID
    for (CollectionDAO.EntityRelationshipObject record : records) {
      UUID metricId = UUID.fromString(record.getFromId());
      EntityReference relatedMetricRef =
          Entity.getEntityReferenceById(METRIC, UUID.fromString(record.getToId()), NON_DELETED);
      relatedMetricsMap.get(metricId).add(relatedMetricRef);
    }

    // Second, get relationships where these metrics are the target (bidirectional)
    List<CollectionDAO.EntityRelationshipObject> reverseRecords =
        daoCollection
            .relationshipDAO()
            .findFromBatch(entityListToStrings(metrics), Relationship.RELATED_TO.ordinal());

    // Group related metrics by target metric ID
    for (CollectionDAO.EntityRelationshipObject record : reverseRecords) {
      UUID metricId = UUID.fromString(record.getToId());
      EntityReference relatedMetricRef =
          Entity.getEntityReferenceById(METRIC, UUID.fromString(record.getFromId()), NON_DELETED);
      relatedMetricsMap.get(metricId).add(relatedMetricRef);
    }

    return relatedMetricsMap;
  }
}
