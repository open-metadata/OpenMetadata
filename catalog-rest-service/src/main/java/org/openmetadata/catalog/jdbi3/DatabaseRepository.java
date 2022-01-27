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
import static org.openmetadata.catalog.Entity.DATABASE_SERVICE;
import static org.openmetadata.catalog.Entity.helper;
import static org.openmetadata.catalog.util.EntityUtil.toBoolean;

import java.io.IOException;
import java.net.URI;
import java.text.ParseException;
import java.util.ArrayList;
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
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;

public class DatabaseRepository extends EntityRepository<Database> {
  private static final Fields DATABASE_UPDATE_FIELDS = new Fields(DatabaseResource.FIELD_LIST, "owner");
  private static final Fields DATABASE_PATCH_FIELDS = new Fields(DatabaseResource.FIELD_LIST, "owner,usageSummary");

  public DatabaseRepository(CollectionDAO dao) {
    super(
        DatabaseResource.COLLECTION_PATH,
        Entity.DATABASE,
        Database.class,
        dao.databaseDAO(),
        dao,
        DATABASE_PATCH_FIELDS,
        DATABASE_UPDATE_FIELDS,
        false,
        true,
        false);
  }

  public static String getFQN(Database database) {
    return (database.getService().getName() + "." + database.getName());
  }

  @Transaction
  public void deleteLocation(String databaseId) {
    daoCollection
        .relationshipDAO()
        .deleteFrom(databaseId, Entity.DATABASE, Relationship.HAS.ordinal(), Entity.LOCATION);
  }

  @Override
  public void prepare(Database database) throws IOException {
    populateService(database);
    database.setFullyQualifiedName(getFQN(database));
    database.setOwner(
        EntityUtil.populateOwner(
            daoCollection.userDAO(), daoCollection.teamDAO(), database.getOwner())); // Validate owner
  }

  @Override
  public void storeEntity(Database database, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = database.getOwner();
    EntityReference service = database.getService();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    database.withOwner(null).withService(null).withHref(null);

    if (update) {
      daoCollection.databaseDAO().update(database.getId(), JsonUtils.pojoToJson(database));
    } else {
      daoCollection.databaseDAO().insert(database);
    }

    // Restore the relationships
    database.withOwner(owner).withService(service);
  }

  @Override
  public void storeRelationships(Database database) {
    daoCollection
        .relationshipDAO()
        .insert(
            database.getService().getId().toString(),
            database.getId().toString(),
            database.getService().getType(),
            Entity.DATABASE,
            Relationship.CONTAINS.ordinal());
    EntityUtil.setOwner(daoCollection.relationshipDAO(), database.getId(), Entity.DATABASE, database.getOwner());
  }

  private List<EntityReference> getTables(Database database) throws IOException {
    if (database == null) {
      return null;
    }
    String databaseId = database.getId().toString();
    List<String> tableIds =
        daoCollection
            .relationshipDAO()
            .findTo(
                databaseId,
                Entity.DATABASE,
                Relationship.CONTAINS.ordinal(),
                Entity.TABLE,
                toBoolean(toInclude(database)));
    List<EntityReference> tables = new ArrayList<>();
    for (String tableId : tableIds) {
      tables.add(daoCollection.tableDAO().findEntityReferenceById(UUID.fromString(tableId)));
    }
    return tables;
  }

  public Database setFields(Database database, Fields fields) throws IOException, ParseException {
    database.setService(getService(database));
    database.setOwner(fields.contains("owner") ? getOwner(database) : null);
    database.setTables(fields.contains("tables") ? getTables(database) : null);
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
    String databaseId = database.getId().toString();
    List<String> result =
        daoCollection
            .relationshipDAO()
            .findTo(
                databaseId,
                Entity.DATABASE,
                Relationship.HAS.ordinal(),
                Entity.LOCATION,
                toBoolean(toInclude(database)));
    if (result.size() == 1) {
      String locationId = result.get(0);
      return daoCollection.locationDAO().findEntityReferenceById(UUID.fromString(locationId));
    } else {
      return null;
    }
  }

  private EntityReference getService(Database database) throws IOException, ParseException {
    return helper(database).getContainer(DATABASE_SERVICE);
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
    throw new IllegalArgumentException(CatalogExceptionMessage.invalidServiceEntity(entityType, Entity.DATABASE));
  }

  @Transaction
  public Status addLocation(UUID databaseId, UUID locationId) throws IOException {
    daoCollection.databaseDAO().findEntityById(databaseId);
    daoCollection.locationDAO().findEntityById(locationId);
    // A database has only one location.
    daoCollection
        .relationshipDAO()
        .deleteFrom(databaseId.toString(), Entity.DATABASE, Relationship.HAS.ordinal(), Entity.LOCATION);
    daoCollection
        .relationshipDAO()
        .insert(
            databaseId.toString(), locationId.toString(), Entity.DATABASE, Entity.LOCATION, Relationship.HAS.ordinal());
    return CREATED;
  }

  public static class DatabaseEntityInterface implements EntityInterface<Database> {
    private final Database entity;

    public DatabaseEntityInterface(Database entity) {
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
    public EntityReference getEntityReference() {
      return new EntityReference()
          .withId(getId())
          .withName(getFullyQualifiedName())
          .withDescription(getDescription())
          .withDisplayName(getDisplayName())
          .withType(Entity.DATABASE);
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
