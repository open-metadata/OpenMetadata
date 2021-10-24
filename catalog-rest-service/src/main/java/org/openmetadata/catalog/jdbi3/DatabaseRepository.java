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
import org.openmetadata.catalog.resources.databases.DatabaseResource.DatabaseList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUpdater;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.json.JsonPatch;
import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.UUID;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;

public class DatabaseRepository extends EntityRepository<Database> {
  private static final Logger LOG = LoggerFactory.getLogger(DatabaseRepository.class);
  private static final Fields DATABASE_UPDATE_FIELDS = new Fields(DatabaseResource.FIELD_LIST, "owner");
  private static final Fields DATABASE_PATCH_FIELDS = new Fields(DatabaseResource.FIELD_LIST,
          "owner,service, usageSummary");
  private final CollectionDAO dao;

  public DatabaseRepository(CollectionDAO dao) {
    super(Database.class, dao.databaseDAO());
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
  public PutResponse<Database> createOrUpdate(Database updated) throws IOException {
    validate(updated);
    Database stored = JsonUtils.readValue(dao.databaseDAO().findJsonByFqn(updated.getFullyQualifiedName()),
            Database.class);
    if (stored == null) {  // Database does not exist. Create a new one
//      return new PutResponse<>(Status.CREATED, createInternal(updated));
    }
    setFields(stored, DATABASE_UPDATE_FIELDS);
    updated.setId(stored.getId());

    DatabaseUpdater databaseUpdater = new DatabaseUpdater(stored, updated, false);
    databaseUpdater.updateAll();
    databaseUpdater.store();
    return new PutResponse<>(Status.OK, updated);
  }

  @Transaction
  public Database patch(UUID id, String user, JsonPatch patch) throws IOException {
    Database original = setFields(dao.databaseDAO().findEntityById(id), DATABASE_PATCH_FIELDS);
    LOG.info("Database summary in original {}", original.getUsageSummary());
    Database updated = JsonUtils.applyPatch(original, patch, Database.class);
    updated.withUpdatedBy(user).withUpdatedAt(new Date());
    patch(original, updated);

    // TODO disallow updating tables
    return updated;
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

  private void patch(Database original, Database updated) throws IOException {
    // Patch can't make changes to following fields. Ignore the changes
    updated.withFullyQualifiedName(original.getFullyQualifiedName()).withName(original.getName())
            .withService(original.getService()).withId(original.getId());
    validate(updated);
    DatabaseUpdater databaseUpdater = new DatabaseUpdater(original, updated, true);
    databaseUpdater.updateAll();
    databaseUpdater.store();
  }

  public EntityReference getOwner(Database database) throws IOException {
    return database != null ? EntityUtil.populateOwner(database.getId(), dao.relationshipDAO(), dao.userDAO(),
            dao.teamDAO())
            : null;
  }

  private void setOwner(Database database, EntityReference owner) {
    EntityUtil.setOwner(dao.relationshipDAO(), database.getId(), Entity.DATABASE, owner);
    database.setOwner(owner);
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

  @Override
  public String getFullyQualifiedName(Database entity) {
    return entity.getFullyQualifiedName();
  }

  public Database setFields(Database database, Fields fields) throws IOException {
    database.setOwner(fields.contains("owner") ? getOwner(database) : null);
    database.setTables(fields.contains("tables") ? getTables(database) : null);
    database.setService(fields.contains("service") ? getService(database) : null);
    database.setUsageSummary(fields.contains("usageSummary") ? EntityUtil.getLatestUsage(dao.usageDAO(),
            database.getId()) : null);
    return database;
  }

  @Override
  public ResultList<Database> getResultList(List<Database> entities, String beforeCursor, String afterCursor,
                                            int total) throws GeneralSecurityException, UnsupportedEncodingException {
    return new DatabaseList(entities, beforeCursor, afterCursor, total);
  }

  private EntityReference getService(Database database) throws IOException {
    EntityReference ref =  EntityUtil.getService(dao.relationshipDAO(), database.getId(), Entity.DATABASE_SERVICE);
    return getService(ref);
  }

  private EntityReference getService(EntityReference service) throws IOException {
    if (service.getType().equalsIgnoreCase(Entity.DATABASE_SERVICE)) {
      return dao.dbServiceDAO().findEntityReferenceById(service.getId());
    } else {
      throw new IllegalArgumentException(String.format("Invalid service type %s for the database", service.getType()));
    }
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
    public EntityReference getEntityReference() {
      return new EntityReference().withId(getId()).withName(getFullyQualifiedName()).withDescription(getDescription())
              .withDisplayName(getDisplayName()).withType(Entity.DATABASE);
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
    public void setTags(List<TagLabel> tags) { }
  }

  /**
   * Handles entity updated from PUT and POST operation.
   */
  public class DatabaseUpdater extends EntityUpdater {
    final Database orig;
    final Database updated;

    public DatabaseUpdater(Database orig, Database updated, boolean patchOperation) {
      super(new DatabaseEntityInterface(orig),
              new DatabaseEntityInterface(updated), patchOperation, dao.relationshipDAO(), null);

      this.orig = orig;
      this.updated = updated;
    }

    public void updateAll() throws IOException {
      super.updateAll();
//      updateService();
    }

    public void store() throws IOException {
      updated.setVersion(getNewVersion(orig.getVersion()));
      DatabaseRepository.this.store(updated, true);
    }
  }
}
