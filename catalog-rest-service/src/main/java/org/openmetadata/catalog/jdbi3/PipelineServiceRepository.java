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

import static org.openmetadata.catalog.Entity.helper;

import java.io.IOException;
import java.net.URI;
import java.text.ParseException;
import java.util.UUID;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.services.PipelineService;
import org.openmetadata.catalog.resources.services.pipeline.PipelineServiceResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;

public class PipelineServiceRepository extends EntityRepository<PipelineService> {
  private static final Fields UPDATE_FIELDS = new Fields(PipelineServiceResource.FIELD_LIST, "owner");

  public PipelineServiceRepository(CollectionDAO dao) {
    super(
        PipelineServiceResource.COLLECTION_PATH,
        Entity.PIPELINE_SERVICE,
        PipelineService.class,
        dao.pipelineServiceDAO(),
        dao,
        Fields.EMPTY_FIELDS,
        UPDATE_FIELDS,
        false,
        true,
        false);
  }

  @Override
  public PipelineService setFields(PipelineService entity, Fields fields) throws IOException, ParseException {
    entity.setOwner(fields.contains("owner") ? getOwner(entity) : null);
    return entity;
  }

  @Override
  public void restorePatchAttributes(PipelineService original, PipelineService updated) {
    /* Nothing to do */
  }

  @Override
  public EntityInterface<PipelineService> getEntityInterface(PipelineService entity) {
    return new PipelineServiceEntityInterface(entity);
  }

  @Override
  public void prepare(PipelineService entity) throws IOException, ParseException {
    // Check if owner is valid and set the relationship
    entity.setOwner(helper(entity).validateOwnerOrNull());
    EntityUtil.validateIngestionSchedule(entity.getIngestionSchedule());
  }

  @Override
  public void storeEntity(PipelineService service, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = service.getOwner();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    service.withOwner(null).withHref(null);

    store(service.getId(), service, update);

    // Restore the relationships
    service.withOwner(owner);
  }

  @Override
  public void storeRelationships(PipelineService entity) {
    // Add owner relationship
    setOwner(entity, entity.getOwner());
  }

  @Override
  public EntityUpdater getUpdater(PipelineService original, PipelineService updated, Operation operation) {
    return new PipelineServiceUpdater(original, updated, operation);
  }

  public static class PipelineServiceEntityInterface implements EntityInterface<PipelineService> {
    private final PipelineService entity;

    public PipelineServiceEntityInterface(PipelineService entity) {
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
    public String getFullyQualifiedName() {
      return entity.getName();
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
    public EntityReference getOwner() {
      return entity.getOwner();
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
          .withType(Entity.PIPELINE_SERVICE);
    }

    @Override
    public PipelineService getEntity() {
      return entity;
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
    public PipelineService withHref(URI href) {
      return entity.withHref(href);
    }
  }

  public class PipelineServiceUpdater extends EntityUpdater {
    public PipelineServiceUpdater(PipelineService original, PipelineService updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      recordChange("pipelineUrl", original.getEntity().getPipelineUrl(), updated.getEntity().getPipelineUrl());
      recordChange(
          "ingestionSchedule",
          original.getEntity().getIngestionSchedule(),
          updated.getEntity().getIngestionSchedule(),
          true);
    }
  }
}
