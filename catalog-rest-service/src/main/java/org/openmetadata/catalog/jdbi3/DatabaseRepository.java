/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.jdbi3;

import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Database;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.resources.databases.DatabaseResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;

import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.net.URI;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import static javax.ws.rs.core.Response.Status.CREATED;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;

public class DatabaseRepository extends EntityRepository<Database> {
  private static final Fields DATABASE_UPDATE_FIELDS = new Fields(DatabaseResource.FIELD_LIST, "owner");
  private static final Fields DATABASE_PATCH_FIELDS = new Fields(DatabaseResource.FIELD_LIST,
          "owner,service, usageSummary");
  private final CollectionDAO dao;

  public DatabaseRepository(CollectionDAO dao) {
    super(DatabaseResource.COLLECTION_PATH, Entity.DATABASE, Database.class, dao.databaseDAO(), dao,
            DATABASE_PATCH_FIELDS, DATABASE_UPDATE_FIELDS);
    this.dao = dao;
  }

  public static String getFQN(Database database) {
    return (database.getService().getName() + "." + database.getName());
  }

  @Transaction
  public void delete(UUID id) {
    if (dao.relationshipDAO().findToCount(id.toString(), Relationship.CONTAINS.ordinal(), Entity.TABLE) > 0) {
      throw new IllegalArgumentException("Database is not empty");
    }
    if (dao.databaseDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.DATABASE, id));
    }
    dao.relationshipDAO().deleteAll(id.toString());
  }

  @Transaction
  public void deleteLocation(String databaseId) {
    dao.relationshipDAO().deleteFrom(databaseId, Relationship.HAS.ordinal(), Entity.LOCATION);
  }

  @Override
  public void validate(Database database) throws IOException {
    database.setService(getService(database.getService()));
    database.setFullyQualifiedName(getFQN(database));
    database.setOwner(EntityUtil.populateOwner(dao.userDAO(), dao.teamDAO(), database.getOwner())); // Validate owner
  }

  @Override
  public void store(Database database, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = database.getOwner();
    EntityReference service = database.getService();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    database.withOwner(null).withService(null).withHref(null);

    if (update) {
      dao.databaseDAO().update(database.getId(), JsonUtils.pojoToJson(database));
    } else {
      dao.databaseDAO().insert(database);
    }

    // Restore the relationships
    database.withOwner(owner).withService(service);
  }

  @Override
  public void storeRelationships(Database database) throws IOException {
    dao.relationshipDAO().insert(database.getService().getId().toString(), database.getId().toString(),
            database.getService().getType(), Entity.DATABASE, Relationship.CONTAINS.ordinal());
    EntityUtil.setOwner(dao.relationshipDAO(), database.getId(), Entity.DATABASE, database.getOwner());
  }

  public EntityReference getOwner(Database database) throws IOException {
    return database != null ? EntityUtil.populateOwner(database.getId(), dao.relationshipDAO(), dao.userDAO(),
            dao.teamDAO()) : null;
  }

  private List<EntityReference> getTables(Database database) throws IOException {
    if (database == null) {
      return null;
    }
    String databaseId = database.getId().toString();
    List<String> tableIds = dao.relationshipDAO().findTo(databaseId, Relationship.CONTAINS.ordinal(), Entity.TABLE);
    List<EntityReference> tables = new ArrayList<>();
    for (String tableId : tableIds) {
      tables.add(dao.tableDAO().findEntityReferenceById(UUID.fromString(tableId)));
    }
    return tables;
  }

  public Database setFields(Database database, Fields fields) throws IOException {
    database.setService(getService(database));
    database.setOwner(fields.contains("owner") ? getOwner(database) : null);
    database.setTables(fields.contains("tables") ? getTables(database) : null);
    database.setUsageSummary(fields.contains("usageSummary") ? EntityUtil.getLatestUsage(dao.usageDAO(),
            database.getId()) : null);
    database.setLocation(fields.contains("location") ? getLocation(database): null);
    return database;
  }

  @Override
  public void restorePatchAttributes(Database original, Database updated) throws IOException, ParseException {
    // Patch can't make changes to following fields. Ignore the changes
    updated.withFullyQualifiedName(original.getFullyQualifiedName()).withName(original.getName())
            .withService(original.getService()).withId(original.getId());
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
    List<String> result = dao.relationshipDAO().findTo(databaseId, Relationship.HAS.ordinal(), Entity.LOCATION);
    if (result.size() == 1) {
      String locationId= result.get(0);
      return dao.locationDAO().findEntityReferenceById(UUID.fromString(locationId));
    } else {
      return null;
    }
  }

  private EntityReference getService(Database database) throws IOException {
    EntityReference ref =  EntityUtil.getService(dao.relationshipDAO(), database.getId(), Entity.DATABASE_SERVICE);
    return getService(Objects.requireNonNull(ref));
  }

  private EntityReference getService(EntityReference service) throws IOException {
    if (service.getType().equalsIgnoreCase(Entity.DATABASE_SERVICE)) {
      return dao.dbServiceDAO().findEntityReferenceById(service.getId());
    } else {
      throw new IllegalArgumentException(String.format("Invalid service type %s for the database", service.getType()));
    }
  }

  @Transaction
  public Status addLocation(UUID databaseId, UUID locationId) throws IOException {
    dao.databaseDAO().findEntityById(databaseId);
    dao.locationDAO().findEntityById(locationId);
    // A database has only one location.
    dao.relationshipDAO().deleteFrom(databaseId.toString(), Relationship.HAS.ordinal(), Entity.LOCATION);
    dao.relationshipDAO().insert(databaseId.toString(), locationId.toString(), Entity.DATABASE, Entity.LOCATION, Relationship.HAS.ordinal());
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
    public EntityReference getOwner() {
      return entity.getOwner();
    }

    @Override
    public String getFullyQualifiedName() {
      return entity.getFullyQualifiedName();
    }

    @Override
    public List<TagLabel> getTags() { return null; }

    @Override
    public Double getVersion() { return entity.getVersion(); }

    @Override
    public String getUpdatedBy() { return entity.getUpdatedBy(); }

    @Override
    public Date getUpdatedAt() { return entity.getUpdatedAt(); }

    @Override
    public URI getHref() {
      return entity.getHref();
    }

    @Override
    public List<EntityReference> getFollowers() {
      throw new UnsupportedOperationException("Database does not support followers");
    }

    @Override
    public EntityReference getEntityReference() {
      return new EntityReference().withId(getId()).withName(getFullyQualifiedName()).withDescription(getDescription())
              .withDisplayName(getDisplayName()).withType(Entity.DATABASE);
    }

    @Override
    public Database getEntity() { return entity; }

    @Override
    public void setId(UUID id) { entity.setId(id); }

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
    public void setOwner(EntityReference owner) { entity.setOwner(owner); }

    @Override
    public Database withHref(URI href) { return entity.withHref(href); }

    @Override
    public ChangeDescription getChangeDescription() { return entity.getChangeDescription(); }

    @Override
    public void setTags(List<TagLabel> tags) { }
  }
}
