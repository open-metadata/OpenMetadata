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

import com.fasterxml.jackson.core.JsonProcessingException;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Database;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.resources.databases.DatabaseResource;
import org.openmetadata.catalog.resources.databases.DatabaseResource.DatabaseList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUpdater3;
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
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;

public class DatabaseRepositoryHelper extends EntityRepository<Database> {
  private static final Logger LOG = LoggerFactory.getLogger(DatabaseRepositoryHelper.class);
  private static final Fields DATABASE_UPDATE_FIELDS = new Fields(DatabaseResource.FIELD_LIST, "owner");
  private static final Fields DATABASE_PATCH_FIELDS = new Fields(DatabaseResource.FIELD_LIST,
          "owner,service, usageSummary");

  public DatabaseRepositoryHelper(DatabaseRepository3 repo3) {
    super(Database.class, repo3.databaseDAO());
    this.repo3 = repo3;
  }

  private final DatabaseRepository3 repo3;

  public static String getFQN(Database database) {
    return (database.getService().getName() + "." + database.getName());
  }

  public static List<EntityReference> toEntityReference(List<Table> tables) {
    List<EntityReference> refList = new ArrayList<>();
    for (Table table : tables) {
      refList.add(EntityUtil.getEntityReference(table));
    }
    return refList;
  }

  @Transaction
  public ResultList<Database> listBefore(Fields fields, String serviceName, int limitParam, String before) throws IOException,
          GeneralSecurityException, ParseException {
    return EntityUtil.listBefore(this, Database.class, fields, serviceName, limitParam, before);
  }

  @Transaction
  public Database create(Database database) throws IOException {
    validateRelationships(database);
    return createInternal(database);
  }

  @Transaction
  public void delete(String id) {
    if (repo3.relationshipDAO().findToCount(id, Relationship.CONTAINS.ordinal(), Entity.TABLE) > 0) {
      throw new IllegalArgumentException("Database is not empty");
    }
    if (repo3.databaseDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.DATABASE, id));
    }
    repo3.relationshipDAO().deleteAll(id);
  }

  @Transaction
  public PutResponse<Database> createOrUpdate(Database updated) throws IOException {
    validateRelationships(updated);
    Database stored = JsonUtils.readValue(repo3.databaseDAO().findJsonByFqn(updated.getFullyQualifiedName()),
                    Database.class);
    if (stored == null) {  // Database does not exist. Create a new one
      return new PutResponse<>(Status.CREATED, createInternal(updated));
    }
    setFields(stored, DATABASE_UPDATE_FIELDS);
    updated.setId(stored.getId());

    DatabaseUpdater databaseUpdater = new DatabaseUpdater(stored, updated, false);
    databaseUpdater.updateAll();
    databaseUpdater.store();
    return new PutResponse<>(Status.OK, updated);
  }

  @Transaction
  public Database patch(String id, String user, JsonPatch patch) throws IOException {
    Database original = setFields(repo3.databaseDAO().findEntityById(id), DATABASE_PATCH_FIELDS);
    LOG.info("Database summary in original {}", original.getUsageSummary());
    Database updated = JsonUtils.applyPatch(original, patch, Database.class);
    updated.withUpdatedBy(user).withUpdatedAt(new Date());
    patch(original, updated);

    // TODO disallow updating tables
    return updated;
  }

  public Database createInternal(Database database) throws IOException {
    storeDatabase(database, false);
    addRelationships(database);
    return database;
  }

  private void validateRelationships(Database database) throws IOException {
    EntityReference dbService = getService(database.getService());
    database.setService(dbService);
    database.setFullyQualifiedName(getFQN(database));
    database.setOwner(EntityUtil.populateOwner(repo3.userDAO(), repo3.teamDAO(), database.getOwner())); // Validate owner
    getService(database.getService());
  }

  private void addRelationships(Database database) throws IOException {
    setService(database, database.getService());
    setOwner(database, database.getOwner());
  }

  private void storeDatabase(Database database, boolean update) throws JsonProcessingException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = database.getOwner();
    EntityReference service = database.getService();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    database.withOwner(null).withService(null).withHref(null);

    if (update) {
      repo3.databaseDAO().update(database.getId().toString(), JsonUtils.pojoToJson(database));
    } else {
      repo3.databaseDAO().insert(JsonUtils.pojoToJson(database));
    }

    // Restore the relationships
    database.withOwner(owner).withService(service);
  }

  private void patch(Database original, Database updated) throws IOException {
    // Patch can't make changes to following fields. Ignore the changes
    updated.withFullyQualifiedName(original.getFullyQualifiedName()).withName(original.getName())
            .withService(original.getService()).withId(original.getId());
    validateRelationships(updated);
    DatabaseUpdater databaseUpdater = new DatabaseUpdater(original, updated, true);
    databaseUpdater.updateAll();
    databaseUpdater.store();
  }

  public EntityReference getOwner(Database database) throws IOException {
    return database != null ? EntityUtil.populateOwner(database.getId(), repo3.relationshipDAO(), repo3.userDAO(), repo3.teamDAO())
            : null;
  }

  private void setOwner(Database database, EntityReference owner) {
    EntityUtil.setOwner(repo3.relationshipDAO(), database.getId(), Entity.DATABASE, owner);
    database.setOwner(owner);
  }

  private List<Table> getTables(Database database) throws IOException {
    if (database == null) {
      return null;
    }
    String databaseId = database.getId().toString();
    List<String> tableIds = repo3.relationshipDAO().findTo(databaseId, Relationship.CONTAINS.ordinal(), Entity.TABLE);
    List<Table> tables = new ArrayList<>();
    for (String tableId : tableIds) {
      String json = repo3.tableDAO().findJsonById(tableId);
      Table table = JsonUtils.readValue(json, Table.class);
      tables.add(table);
    }
    return tables;
  }

  @Override
  public String getFullyQualifiedName(Database entity) {
    return entity.getFullyQualifiedName();
  }

  public Database setFields(Database database, Fields fields) throws IOException {
    database.setOwner(fields.contains("owner") ? getOwner(database) : null);
    database.setTables(fields.contains("tables") ? toEntityReference(getTables(database)) : null);
    database.setService(fields.contains("service") ? getService(database) : null);
    database.setUsageSummary(fields.contains("usageSummary") ? EntityUtil.getLatestUsage(repo3.usageDAO(),
            database.getId()) : null);
    return database;
  }

  @Override
  public ResultList<Database> getResultList(List<Database> entities, String beforeCursor, String afterCursor,
                                            int total) throws GeneralSecurityException, UnsupportedEncodingException {
    return new DatabaseList(entities, beforeCursor, afterCursor, total);
  }

  private EntityReference getService(Database database) throws IOException {
    return database == null ? null : getService(Objects.requireNonNull(EntityUtil.getService(repo3.relationshipDAO(),
            database.getId())));
  }

  private EntityReference getService(EntityReference service) throws IOException {
    String id = service.getId().toString();
    if (service.getType().equalsIgnoreCase(Entity.DATABASE_SERVICE)) {
      DatabaseService serviceInstance = repo3.dbServiceDAO().findEntityById(id);
      service.setDescription(serviceInstance.getDescription());
      service.setName(serviceInstance.getName());
    } else {
      throw new IllegalArgumentException(String.format("Invalid service type %s for the database", service.getType()));
    }
    return service;
  }

  public void setService(Database database, EntityReference service) throws IOException {
    if (service != null && database != null) {
      getService(service); // Populate service details
      repo3.relationshipDAO().insert(service.getId().toString(), database.getId().toString(), service.getType(),
              Entity.DATABASE, Relationship.CONTAINS.ordinal());
      database.setService(service);
    }
  }

  static class DatabaseEntityInterface implements EntityInterface {
    private final Database database;

    DatabaseEntityInterface(Database Database) {
      this.database = Database;
    }

    @Override
    public UUID getId() {
      return database.getId();
    }

    @Override
    public String getDescription() {
      return database.getDescription();
    }

    @Override
    public String getDisplayName() {
      return database.getDisplayName();
    }

    @Override
    public EntityReference getOwner() {
      return database.getOwner();
    }

    @Override
    public String getFullyQualifiedName() {
      return database.getFullyQualifiedName();
    }

    @Override
    public List<TagLabel> getTags() { return null; }

    @Override
    public void setDescription(String description) {
      database.setDescription(description);
    }

    @Override
    public void setDisplayName(String displayName) {
      database.setDisplayName(displayName);
    }

    @Override
    public void setTags(List<TagLabel> tags) { }
  }

  /**
   * Handles entity updated from PUT and POST operation.
   */
  public class DatabaseUpdater extends EntityUpdater3 {
    final Database orig;
    final Database updated;

    public DatabaseUpdater(Database orig, Database updated, boolean patchOperation) {
      super(new DatabaseEntityInterface(orig),
              new DatabaseEntityInterface(updated), patchOperation, repo3.relationshipDAO(), null);

      this.orig = orig;
      this.updated = updated;
    }

    public void updateAll() throws IOException {
      super.updateAll();
//      updateService();
    }

    public void store() throws IOException {
      updated.setVersion(getNewVersion(orig.getVersion()));
      storeDatabase(updated, true);
    }
  }
}
