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

import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.DASHBOARD_SERVICE;

import org.openmetadata.schema.entity.data.Metrics;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.metrics.MetricsResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

public class MetricsRepository extends EntityRepository<Metrics> {
  public MetricsRepository() {
    super(
        MetricsResource.COLLECTION_PATH, Entity.METRICS, Metrics.class, Entity.getCollectionDAO().metricsDAO(), "", "");
  }

  @Override
  public void setFullyQualifiedName(Metrics metrics) {
    metrics.setFullyQualifiedName(FullyQualifiedName.add(metrics.getService().getName(), metrics.getName()));
  }

  @Override
  public Metrics setFields(Metrics metrics, Fields fields) {
    metrics.setService(getContainer(metrics.getId())); // service is a default field
    if (metrics.getUsageSummary() == null) {
      metrics.withUsageSummary(
          fields.contains("usageSummary")
              ? EntityUtil.getLatestUsage(daoCollection.usageDAO(), metrics.getId())
              : metrics.getUsageSummary());
    }
    return metrics;
  }

  @Override
  public Metrics clearFields(Metrics metrics, Fields fields) {
    return metrics.withUsageSummary(fields.contains("usageSummary") ? metrics.getUsageSummary() : null);
  }

  @Override
  public void prepare(Metrics metrics, boolean update) {
    metrics.setService(getService(metrics.getService()));
  }

  @Override
  public void storeEntity(Metrics metrics, boolean update) {
    // Relationships and fields such as service are derived and not stored as part of json
    EntityReference service = metrics.getService();
    metrics.withService(null);
    store(metrics, update);
    metrics.withService(service);
  }

  @Override
  public void storeRelationships(Metrics metrics) {
    EntityReference service = metrics.getService();
    addRelationship(service.getId(), metrics.getId(), service.getType(), Entity.METRICS, Relationship.CONTAINS);
  }

  private EntityReference getService(EntityReference service) { // Get service by service ID
    if (service.getType().equalsIgnoreCase(Entity.DASHBOARD_SERVICE)) {
      return Entity.getEntityReferenceById(Entity.DATABASE_SERVICE, service.getId(), NON_DELETED);
    }
    throw new IllegalArgumentException(
        CatalogExceptionMessage.invalidServiceEntity(service.getType(), Entity.METRICS, DASHBOARD_SERVICE));
  }
}
