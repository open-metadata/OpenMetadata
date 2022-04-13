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

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.services.CreateDatabaseService;
import org.openmetadata.catalog.api.services.DatabaseConnection;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.exception.InvalidServiceConnectionException;
import org.openmetadata.catalog.resources.services.database.DatabaseServiceResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;

public class DatabaseServiceRepository extends EntityRepository<DatabaseService> {
  private static final String UPDATE_FIELDS = "owner";

  public DatabaseServiceRepository(CollectionDAO dao) {
    super(
        DatabaseServiceResource.COLLECTION_PATH,
        Entity.DATABASE_SERVICE,
        DatabaseService.class,
        dao.dbServiceDAO(),
        dao,
        "",
        UPDATE_FIELDS);
    this.allowEdits = true;
  }

  @Override
  public DatabaseService setFields(DatabaseService entity, Fields fields) throws IOException {
    entity.setPipelines(fields.contains("pipelines") ? getIngestionPipelines(entity) : null);
    entity.setOwner(fields.contains(FIELD_OWNER) ? getOwner(entity) : null);
    return entity;
  }

  private List<EntityReference> getIngestionPipelines(DatabaseService service) throws IOException {
    List<String> ingestionPipelineIds =
        findTo(service.getId(), Entity.DATABASE_SERVICE, Relationship.CONTAINS, Entity.INGESTION_PIPELINE);
    List<EntityReference> ingestionPipelines = new ArrayList<>();
    for (String ingestionPipelineId : ingestionPipelineIds) {
      ingestionPipelines.add(
          daoCollection
              .ingestionPipelineDAO()
              .findEntityReferenceById(UUID.fromString(ingestionPipelineId), Include.ALL));
    }
    return ingestionPipelines;
  }

  @Override
  public EntityInterface<DatabaseService> getEntityInterface(DatabaseService entity) {
    return new DatabaseServiceEntityInterface(entity);
  }

  @Override
  public void prepare(DatabaseService databaseService) throws IOException {
    // Check if owner is valid and set the relationship
    databaseService.setOwner(Entity.getEntityReference(databaseService.getOwner()));
    // validate database service connection
    validateDatabaseConnection(databaseService.getConnection(), databaseService.getServiceType());
  }

  @Override
  public void storeEntity(DatabaseService service, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = service.getOwner();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    service.withOwner(null).withHref(null);

    store(service.getId(), service, update);

    // Restore the relationships
    service.withOwner(owner);
  }

  @Override
  public void storeRelationships(DatabaseService entity) {
    // Add owner relationship
    storeOwner(entity, entity.getOwner());
  }

  @Override
  public EntityUpdater getUpdater(DatabaseService original, DatabaseService updated, Operation operation) {
    return new DatabaseServiceUpdater(original, updated, operation);
  }

  private void validateDatabaseConnection(
      DatabaseConnection databaseConnection, CreateDatabaseService.DatabaseServiceType databaseServiceType) {
    try {
      Object connectionConfig = databaseConnection.getConfig();
      String clazzName =
          "org.openmetadata.catalog.services.connections.database." + databaseServiceType.value() + "Connection";
      Class<?> clazz = Class.forName(clazzName);
      JsonUtils.convertValue(connectionConfig, clazz);
    } catch (Exception e) {
      throw InvalidServiceConnectionException.byMessage(
          databaseServiceType.value(),
          String.format("Failed to construct connection instance of %s", databaseServiceType.value()));
    }
  }

  public static class DatabaseServiceEntityInterface extends EntityInterface<DatabaseService> {
    public DatabaseServiceEntityInterface(DatabaseService entity) {
      super(Entity.DATABASE_SERVICE, entity);
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
    public EntityReference getOwner() {
      return entity.getOwner();
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
    public ChangeDescription getChangeDescription() {
      return entity.getChangeDescription();
    }

    @Override
    public DatabaseService getEntity() {
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
    public DatabaseService withHref(URI href) {
      return entity.withHref(href);
    }
  }

  public class DatabaseServiceUpdater extends EntityUpdater {
    public DatabaseServiceUpdater(DatabaseService original, DatabaseService updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      updateDatabaseConnectionConfig();
    }

    private void updateDatabaseConnectionConfig() throws JsonProcessingException {
      DatabaseConnection origConn = original.getEntity().getConnection();
      DatabaseConnection updatedConn = updated.getEntity().getConnection();
      recordChange("connection", origConn, updatedConn, true);
    }
  }
}
