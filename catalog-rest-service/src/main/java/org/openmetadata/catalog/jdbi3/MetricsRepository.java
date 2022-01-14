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

import java.io.IOException;
import java.net.URI;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Metrics;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.resources.metrics.MetricsResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;

public class MetricsRepository extends EntityRepository<Metrics> {
  private static final Fields METRICS_UPDATE_FIELDS = new Fields(MetricsResource.FIELD_LIST, "owner");

  public MetricsRepository(CollectionDAO dao) {
    super(
        MetricsResource.COLLECTION_PATH,
        Entity.METRICS,
        Metrics.class,
        dao.metricsDAO(),
        dao,
        Fields.EMPTY_FIELDS,
        METRICS_UPDATE_FIELDS,
        true,
        true,
        true);
  }

  public static String getFQN(Metrics metrics) {
    return (metrics.getService().getName() + "." + metrics.getName());
  }

  @Override
  public Metrics setFields(Metrics metrics, Fields fields) throws IOException {
    metrics.setService(getService(metrics)); // service is a default field
    metrics.setOwner(fields.contains("owner") ? getOwner(metrics) : null);
    metrics.setUsageSummary(
        fields.contains("usageSummary") ? EntityUtil.getLatestUsage(daoCollection.usageDAO(), metrics.getId()) : null);
    return metrics;
  }

  @Override
  public void restorePatchAttributes(Metrics original, Metrics updated) {
    /* Nothing to do */
  }

  @Override
  public EntityInterface<Metrics> getEntityInterface(Metrics entity) {
    return new MetricsEntityInterface(entity);
  }

  @Override
  public void prepare(Metrics metrics) throws IOException {
    metrics.setFullyQualifiedName(getFQN(metrics));
    EntityUtil.populateOwner(daoCollection.userDAO(), daoCollection.teamDAO(), metrics.getOwner()); // Validate owner
    metrics.setService(getService(metrics.getService()));
    metrics.setTags(EntityUtil.addDerivedTags(daoCollection.tagDAO(), metrics.getTags()));
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
    daoCollection
        .relationshipDAO()
        .insert(
            metrics.getService().getId().toString(),
            metrics.getId().toString(),
            metrics.getService().getType(),
            Entity.METRICS,
            Relationship.CONTAINS.ordinal());
    setOwner(metrics, metrics.getOwner());
    applyTags(metrics);
  }

  private EntityReference getService(Metrics metrics) throws IOException { // Get service by metrics ID
    EntityReference ref =
        EntityUtil.getService(
            daoCollection.relationshipDAO(), Entity.METRICS, metrics.getId(), Entity.DASHBOARD_SERVICE);
    return getService(Objects.requireNonNull(ref));
  }

  private EntityReference getService(EntityReference service) throws IOException { // Get service by service ID
    if (service.getType().equalsIgnoreCase(Entity.DASHBOARD_SERVICE)) {
      return daoCollection.dbServiceDAO().findEntityReferenceById(service.getId());
    }
    throw new IllegalArgumentException(CatalogExceptionMessage.invalidServiceEntity(service.getType(), Entity.METRICS));
  }

  static class MetricsEntityInterface implements EntityInterface<Metrics> {
    private final Metrics entity;

    MetricsEntityInterface(Metrics entity) {
      this.entity = entity;
    }

    @Override
    public UUID getId() {
      return entity.getId();
    }

    @Override
    public String getDescription() {
      return entity.getDescription();
    }

    @Override
    public String getDisplayName() {
      return entity.getDisplayName();
    }

    @Override
    public Boolean isDeleted() {
      return entity.getDeleted();
    }

    @Override
    public EntityReference getOwner() {
      return entity.getOwner();
    }

    @Override
    public String getFullyQualifiedName() {
      return entity.getFullyQualifiedName();
    }

    @Override
    public List<TagLabel> getTags() {
      return entity.getTags();
    }

    @Override
    public Double getVersion() {
      return entity.getVersion();
    }

    @Override
    public String getUpdatedBy() {
      return entity.getUpdatedBy();
    }

    @Override
    public long getUpdatedAt() {
      return entity.getUpdatedAt();
    }

    @Override
    public URI getHref() {
      return entity.getHref();
    }

    @Override
    public ChangeDescription getChangeDescription() {
      return entity.getChangeDescription();
    }

    @Override
    public EntityReference getEntityReference() {
      return new EntityReference()
          .withId(getId())
          .withName(getFullyQualifiedName())
          .withDescription(getDescription())
          .withDisplayName(getDisplayName())
          .withType(Entity.METRICS);
    }

    @Override
    public Metrics getEntity() {
      return entity;
    }

    @Override
    public EntityReference getContainer() {
      return entity.getService();
    }

    @Override
    public void setId(UUID id) {
      entity.setId(id);
    }

    @Override
    public void setDescription(String description) {
      entity.setDescription(description);
    }

    @Override
    public void setDisplayName(String displayName) {
      entity.setDisplayName(displayName);
    }

    @Override
    public void setUpdateDetails(String updatedBy, long updatedAt) {
      entity.setUpdatedBy(updatedBy);
      entity.setUpdatedAt(updatedAt);
    }

    @Override
    public void setChangeDescription(Double newVersion, ChangeDescription changeDescription) {
      entity.setVersion(newVersion);
      entity.setChangeDescription(changeDescription);
    }

    @Override
    public void setOwner(EntityReference owner) {
      entity.setOwner(owner);
    }

    @Override
    public void setDeleted(boolean flag) {
      entity.setDeleted(flag);
    }

    @Override
    public Metrics withHref(URI href) {
      return entity.withHref(href);
    }

    @Override
    public void setTags(List<TagLabel> tags) {
      entity.setTags(tags);
    }
  }
}
