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

import static org.openmetadata.catalog.Entity.FIELD_OWNER;
import static org.openmetadata.catalog.util.EntityUtil.Fields;

import java.io.IOException;
import java.net.URI;
import java.text.ParseException;
import java.util.UUID;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.services.StorageService;
import org.openmetadata.catalog.resources.services.storage.StorageServiceResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityInterface;

public class StorageServiceRepository extends EntityRepository<StorageService> {
  private static final Fields UPDATE_FIELDS = new Fields(StorageServiceResource.ALLOWED_FIELDS, "owner");

  public StorageServiceRepository(CollectionDAO dao) {
    super(
        StorageServiceResource.COLLECTION_PATH,
        Entity.STORAGE_SERVICE,
        StorageService.class,
        dao.storageServiceDAO(),
        dao,
        Fields.EMPTY_FIELDS,
        UPDATE_FIELDS);
  }

  @Override
  public StorageService setFields(StorageService entity, Fields fields) throws IOException, ParseException {
    entity.setOwner(fields.contains(FIELD_OWNER) ? getOwner(entity) : null);
    return entity;
  }

  @Override
  public EntityInterface<StorageService> getEntityInterface(StorageService entity) {
    return new StorageServiceRepository.StorageServiceEntityInterface(entity);
  }

  @Override
  public void prepare(StorageService entity) throws IOException, ParseException {
    // Check if owner is valid and set the relationship
    entity.setOwner(Entity.getEntityReference(entity.getOwner()));
  }

  @Override
  public void storeEntity(StorageService service, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = service.getOwner();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    service.withOwner(null).withHref(null);

    store(service.getId(), service, update);

    // Restore the relationships
    service.withOwner(owner);
  }

  @Override
  public void storeRelationships(StorageService entity) {
    // Add owner relationship
    setOwner(entity, entity.getOwner());
  }

  public static class StorageServiceEntityInterface extends EntityInterface<StorageService> {
    public StorageServiceEntityInterface(StorageService entity) {
      super(Entity.STORAGE_SERVICE, entity);
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
    public String getName() {
      return entity.getName();
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
    public EntityReference getOwner() {
      return entity.getOwner();
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
    public StorageService getEntity() {
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
    public void setName(String name) {
      entity.setName(name);
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
    public StorageService withHref(URI href) {
      return entity.withHref(href);
    }
  }
}
