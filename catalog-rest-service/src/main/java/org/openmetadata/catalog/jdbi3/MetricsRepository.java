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

package org.openmetadata.catalog.jdbi3;

import static org.openmetadata.catalog.Entity.DASHBOARD_SERVICE;
import static org.openmetadata.catalog.Entity.FIELD_OWNER;

import java.io.IOException;
import java.util.List;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Metrics;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.resources.metrics.MetricsResource;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.FullyQualifiedName;

public class MetricsRepository extends EntityRepository<Metrics> {
  private static final String METRICS_UPDATE_FIELDS = "owner";

  public MetricsRepository(CollectionDAO dao) {
    super(
        MetricsResource.COLLECTION_PATH,
        Entity.METRICS,
        Metrics.class,
        dao.metricsDAO(),
        dao,
        "",
        METRICS_UPDATE_FIELDS);
  }

  @Override
  public void setFullyQualifiedName(Metrics metrics) {
    metrics.setFullyQualifiedName(FullyQualifiedName.add(metrics.getService().getName(), metrics.getName()));
  }

  @Override
  public Metrics setFields(Metrics metrics, Fields fields) throws IOException {
    metrics.setService(getContainer(metrics.getId())); // service is a default field
    metrics.setOwner(fields.contains(FIELD_OWNER) ? getOwner(metrics) : null);
    metrics.setUsageSummary(
        fields.contains("usageSummary") ? EntityUtil.getLatestUsage(daoCollection.usageDAO(), metrics.getId()) : null);
    return metrics;
  }

  @Override
  public void prepare(Metrics metrics) throws IOException {
    populateOwner(metrics.getOwner()); // Validate owner
    metrics.setService(getService(metrics.getService()));
    setFullyQualifiedName(metrics);
    metrics.setTags(addDerivedTags(metrics.getTags()));
  }

  @Override
  public void storeEntity(Metrics metrics, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = metrics.getOwner();
    List<TagLabel> tags = metrics.getTags();
    EntityReference service = metrics.getService();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    metrics.withOwner(null).withService(null).withHref(null).withTags(null);

    store(metrics.getId(), metrics, update);

    // Restore the relationships
    metrics.withOwner(owner).withService(service).withTags(tags);
  }

  @Override
  public void storeRelationships(Metrics metrics) {
    EntityReference service = metrics.getService();
    addRelationship(service.getId(), metrics.getId(), service.getType(), Entity.METRICS, Relationship.CONTAINS);
    storeOwner(metrics, metrics.getOwner());
    applyTags(metrics);
  }

  private EntityReference getService(EntityReference service) throws IOException { // Get service by service ID
    if (service.getType().equalsIgnoreCase(Entity.DASHBOARD_SERVICE)) {
      return daoCollection.dbServiceDAO().findEntityReferenceById(service.getId());
    }
    throw new IllegalArgumentException(
        CatalogExceptionMessage.invalidServiceEntity(service.getType(), Entity.METRICS, DASHBOARD_SERVICE));
  }
}
