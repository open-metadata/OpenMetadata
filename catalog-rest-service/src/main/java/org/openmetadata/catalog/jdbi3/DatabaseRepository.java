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

import static javax.ws.rs.core.Response.Status.CREATED;
import static org.openmetadata.catalog.Entity.FIELD_OWNER;
import static org.openmetadata.catalog.type.Include.ALL;

import java.io.IOException;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import javax.ws.rs.core.Response.Status;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Database;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.DatabaseServiceRepository.DatabaseServiceEntityInterface;
import org.openmetadata.catalog.resources.databases.DatabaseResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.FullyQualifiedName;

public class DatabaseRepository extends EntityRepository<Database> {
  private static final String DATABASE_UPDATE_FIELDS = "owner";
  private static final String DATABASE_PATCH_FIELDS = DATABASE_UPDATE_FIELDS;

  public DatabaseRepository(CollectionDAO dao) {
    super(
        DatabaseResource.COLLECTION_PATH,
        Entity.DATABASE,
        Database.class,
        dao.databaseDAO(),
        dao,
        DATABASE_PATCH_FIELDS,
        DATABASE_UPDATE_FIELDS);
  }

  public static String getFQN(Database database) {
    return (database != null && database.getService() != null)
        ? FullyQualifiedName.add(database.getService().getFullyQualifiedName(), database.getName())
        : null;
  }

  @Transaction
  public void deleteLocation(String databaseId) {
    deleteFrom(UUID.fromString(databaseId), Entity.DATABASE, Relationship.HAS, Entity.LOCATION);
  }

  @Override
  public void prepare(Database database) throws IOException {
    populateService(database);
    database.setFullyQualifiedName(getFQN(database));
    populateOwner(database.getOwner()); // Validate owner
  }

  @Override
  public void storeEntity(Database database, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = database.getOwner();
    EntityReference service = database.getService();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    database.withOwner(null).withService(null).withHref(null);

    store(database.getId(), database, update);

    // Restore the relationships
    database.withOwner(owner).withService(service);
  }

  @Override
  public void storeRelationships(Database database) {
    EntityReference service = database.getService();
    addRelationship(service.getId(), database.getId(), service.getType(), Entity.DATABASE, Relationship.CONTAINS);
    storeOwner(database, database.getOwner());
  }

  private List<EntityReference> getSchemas(Database database) throws IOException {
    if (database == null) {
      return null;
    }
    List<String> schemaIds = findTo(database.getId(), Entity.DATABASE, Relationship.CONTAINS, Entity.DATABASE_SCHEMA);
    return EntityUtil.populateEntityReferences(schemaIds, Entity.DATABASE_SCHEMA);
  }

  public Database setFields(Database database, Fields fields) throws IOException {
    database.setService(getService(database));
    database.setOwner(fields.contains(FIELD_OWNER) ? getOwner(database) : null);
    database.setDatabaseSchemas(fields.contains("databaseSchemas") ? getSchemas(database) : null);
    database.setUsageSummary(
        fields.contains("usageSummary") ? EntityUtil.getLatestUsage(daoCollection.usageDAO(), database.getId()) : null);
    database.setLocation(fields.contains("location") ? getLocation(database) : null);
    return database;
  }

  @Override
  public void restorePatchAttributes(Database original, Database updated) {
    // Patch can't make changes to following fields. Ignore the changes
    updated
        .withFullyQualifiedName(original.getFullyQualifiedName())
        .withName(original.getName())
        .withService(original.getService())
        .withId(original.getId());
  }

  @Override
  public EntityInterface<Database> getEntityInterface(Database entity) {
    return new DatabaseEntityInterface(entity);
  }

  private EntityReference getLocation(Database database) throws IOException {
    if (database == null) {
      return null;
    }
    List<String> result = findTo(database.getId(), Entity.DATABASE, Relationship.HAS, Entity.LOCATION);
    if (result.size() == 1) {
      String locationId = result.get(0);
      return daoCollection.locationDAO().findEntityReferenceById(UUID.fromString(locationId), ALL);
    } else {
      return null;
    }
  }

  private EntityReference getService(Database database) throws IOException {
    return getContainer(database.getId(), Entity.DATABASE);
  }

  private void populateService(Database database) throws IOException {
    DatabaseService service = getService(database.getService().getId(), database.getService().getType());
    database.setService(new DatabaseServiceEntityInterface(service).getEntityReference());
    database.setServiceType(service.getServiceType());
  }

  private DatabaseService getService(UUID serviceId, String entityType) throws IOException {
    if (entityType.equalsIgnoreCase(Entity.DATABASE_SERVICE)) {
      return daoCollection.dbServiceDAO().findEntityById(serviceId);
    }
    throw new IllegalArgumentException(
        CatalogExceptionMessage.invalidServiceEntity(entityType, Entity.DATABASE, Entity.DATABASE_SERVICE));
  }

  @Transaction
  public Status addLocation(UUID databaseId, UUID locationId) throws IOException {
    daoCollection.databaseDAO().findEntityById(databaseId);
    daoCollection.locationDAO().findEntityById(locationId);
    // A database has only one location.
    deleteFrom(databaseId, Entity.DATABASE, Relationship.HAS, Entity.LOCATION);
    addRelationship(databaseId, locationId, Entity.DATABASE, Entity.LOCATION, Relationship.HAS);
    return CREATED;
  }

  public static class DatabaseEntityInterface extends EntityInterface<Database> {
    public DatabaseEntityInterface(Database entity) {
      super(Entity.DATABASE, entity);
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
    public EntityReference getOwner() {
      return entity.getOwner();
    }

    @Override
    public String getFullyQualifiedName() {
      return entity.getFullyQualifiedName() != null
          ? entity.getFullyQualifiedName()
          : DatabaseRepository.getFQN(entity);
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
    public Database getEntity() {
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
    public Database withHref(URI href) {
      return entity.withHref(href);
    }

    @Override
    public ChangeDescription getChangeDescription() {
      return entity.getChangeDescription();
    }
  }
}
