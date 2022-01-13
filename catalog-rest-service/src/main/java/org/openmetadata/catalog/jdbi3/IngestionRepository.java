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
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.operations.workflows.Ingestion;
import org.openmetadata.catalog.resources.operations.IngestionResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;

public class IngestionRepository extends EntityRepository<Ingestion> {
  private static final Fields INGESTION_UPDATE_FIELDS =
      new Fields(IngestionResource.FIELD_LIST, "scheduleInterval,owner,tags");
  private static final Fields INGESTION_PATCH_FIELDS =
      new Fields(IngestionResource.FIELD_LIST, "scheduleInterval,owner,tags");

  public IngestionRepository(CollectionDAO dao) {
    super(
        IngestionResource.COLLECTION_PATH,
        Entity.INGESTION,
        Ingestion.class,
        dao.ingestionDAO(),
        dao,
        INGESTION_PATCH_FIELDS,
        INGESTION_UPDATE_FIELDS,
        true,
        true,
        false);
  }

  public static String getFQN(Ingestion ingestion) {
    return (ingestion.getService().getName() + "." + ingestion.getName());
  }

  @Transaction
  public EntityReference getOwnerReference(Ingestion ingestion) throws IOException {
    return EntityUtil.populateOwner(daoCollection.userDAO(), daoCollection.teamDAO(), ingestion.getOwner());
  }

  @Override
  public Ingestion setFields(Ingestion ingestion, Fields fields) throws IOException {
    ingestion.setDisplayName(ingestion.getDisplayName());
    ingestion.setService(getService(ingestion));
    ingestion.setConnectorConfig(ingestion.getConnectorConfig());
    ingestion.setScheduleInterval(ingestion.getScheduleInterval());
    ingestion.setOwner(fields.contains("owner") ? getOwner(ingestion) : null);
    ingestion.setTags(fields.contains("tags") ? getTags(ingestion.getFullyQualifiedName()) : null);
    return ingestion;
  }

  @Override
  public void restorePatchAttributes(Ingestion original, Ingestion updated) {}

  @Override
  public EntityInterface<Ingestion> getEntityInterface(Ingestion entity) {
    return new IngestionEntityInterface(entity);
  }

  @Override
  public void prepare(Ingestion ingestion) throws IOException {
    ingestion.setService(getService(ingestion.getService()));
    ingestion.setFullyQualifiedName(getFQN(ingestion));
    EntityUtil.populateOwner(daoCollection.userDAO(), daoCollection.teamDAO(), ingestion.getOwner()); // Validate owner
    getService(ingestion.getService());
    ingestion.setTags(EntityUtil.addDerivedTags(daoCollection.tagDAO(), ingestion.getTags()));
  }

  @Override
  public void storeEntity(Ingestion ingestion, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = ingestion.getOwner();
    List<TagLabel> tags = ingestion.getTags();
    EntityReference service = ingestion.getService();

    // Don't store owner, dashboard, href and tags as JSON. Build it on the fly based on relationships
    ingestion.withOwner(null).withHref(null).withTags(null);

    store(ingestion.getId(), ingestion, update);

    // Restore the relationships
    ingestion.withOwner(owner).withService(service).withTags(tags);
  }

  @Override
  public void storeRelationships(Ingestion ingestion) {
    EntityReference service = ingestion.getService();
    daoCollection
        .relationshipDAO()
        .insert(
            service.getId().toString(),
            ingestion.getId().toString(),
            service.getType(),
            Entity.INGESTION,
            Relationship.CONTAINS.ordinal());
    setOwner(ingestion, ingestion.getOwner());
    applyTags(ingestion);
  }

  @Override
  public EntityUpdater getUpdater(Ingestion original, Ingestion updated, boolean patchOperation) {
    return new IngestionUpdater(original, updated, patchOperation);
  }

  private EntityReference getService(Ingestion ingestion) throws IOException {
    EntityReference ref =
        EntityUtil.getService(
            daoCollection.relationshipDAO(), Entity.INGESTION, ingestion.getId(), toInclude(ingestion));
    return getService(Objects.requireNonNull(ref));
  }

  private EntityReference getService(EntityReference service) throws IOException {
    if (service.getType().equalsIgnoreCase(Entity.DATABASE_SERVICE)) {
      return daoCollection.dbServiceDAO().findEntityReferenceById(service.getId());
    } else if (service.getType().equalsIgnoreCase(Entity.DASHBOARD_SERVICE)) {
      return daoCollection.dashboardServiceDAO().findEntityReferenceById(service.getId());
    }
    throw new IllegalArgumentException(
        CatalogExceptionMessage.invalidServiceEntity(service.getType(), Entity.INGESTION));
  }

  public static class IngestionEntityInterface implements EntityInterface<Ingestion> {
    private final Ingestion entity;

    public IngestionEntityInterface(Ingestion entity) {
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
    public Date getUpdatedAt() {
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
          .withType(Entity.INGESTION);
    }

    @Override
    public Ingestion getEntity() {
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
    public void setUpdateDetails(String updatedBy, Date updatedAt) {
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
    public Ingestion withHref(URI href) {
      return entity.withHref(href);
    }

    @Override
    public void setTags(List<TagLabel> tags) {
      entity.setTags(tags);
    }
  }

  /** Handles entity updated from PUT and POST operation. */
  public class IngestionUpdater extends EntityUpdater {
    public IngestionUpdater(Ingestion original, Ingestion updated, boolean patchOperation) {
      super(original, updated, patchOperation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      Ingestion origIngestion = original.getEntity();
      Ingestion updatedIngestion = updated.getEntity();
      recordChange("scheduleInterval", origIngestion.getScheduleInterval(), updatedIngestion.getScheduleInterval());
      recordChange("connectorConfig", origIngestion.getConnectorConfig(), updatedIngestion.getConnectorConfig());
      recordChange("startDate", origIngestion.getStartDate(), updatedIngestion.getStartDate());
      recordChange("endDate", origIngestion.getEndDate(), updatedIngestion.getEndDate());
    }
  }
}
