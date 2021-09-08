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

import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Database;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.jdbi3.DatabaseServiceRepository.DatabaseServiceDAO;
import org.openmetadata.catalog.jdbi3.TableRepository.TableDAO;
import org.openmetadata.catalog.jdbi3.TeamRepository.TeamDAO;
import org.openmetadata.catalog.jdbi3.UsageRepository.UsageDAO;
import org.openmetadata.catalog.jdbi3.UserRepository.UserDAO;
import org.openmetadata.catalog.resources.databases.DatabaseResource;
import org.openmetadata.catalog.resources.databases.DatabaseResource.DatabaseList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.common.utils.CipherText;
import org.skife.jdbi.v2.sqlobject.Bind;
import org.skife.jdbi.v2.sqlobject.CreateSqlObject;
import org.skife.jdbi.v2.sqlobject.SqlQuery;
import org.skife.jdbi.v2.sqlobject.SqlUpdate;
import org.skife.jdbi.v2.sqlobject.Transaction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.json.JsonPatch;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;

public abstract class DatabaseRepository {
  private static final Logger LOG = LoggerFactory.getLogger(DatabaseRepository.class);
  private static final Fields DATABASE_UPDATE_FIELDS = new Fields(DatabaseResource.FIELD_LIST, "owner");
  private static final Fields DATABASE_PATCH_FIELDS = new Fields(DatabaseResource.FIELD_LIST,
          "owner,service, usageSummary");

  public static String getFQN(EntityReference service, Database database) {
    return (service.getName() + "." + database.getName());
  }

  public static List<EntityReference> toEntityReference(List<Table> tables) {
    List<EntityReference> refList = new ArrayList<>();
    for (Table table : tables) {
      refList.add(EntityUtil.getEntityReference(table));
    }
    return refList;
  }

  @CreateSqlObject
  abstract DatabaseDAO databaseDAO();

  @CreateSqlObject
  abstract EntityRelationshipDAO relationshipDAO();

  @CreateSqlObject
  abstract TableDAO tableDAO();

  @CreateSqlObject
  abstract UserDAO userDAO();

  @CreateSqlObject
  abstract TeamDAO teamDAO();

  @CreateSqlObject
  abstract DatabaseServiceDAO dbServiceDAO();

  @CreateSqlObject
  abstract UsageDAO usageDAO();

  @Transaction
  public DatabaseList listAfter(Fields fields, String serviceName, int limitParam, String after) throws IOException,
          GeneralSecurityException {
    // forward scrolling, if after == null then first page is being asked being asked
    List<String> jsons = databaseDAO().listAfter(serviceName, limitParam + 1, after == null ? "" :
            CipherText.instance().decrypt(after));

    List<Database> databases = new ArrayList<>();
    for (String json : jsons) {
      databases.add(setFields(JsonUtils.readValue(json, Database.class), fields));
    }
    int total = databaseDAO().listCount(serviceName);

    String beforeCursor, afterCursor = null;
    beforeCursor = after == null ? null : databases.get(0).getFullyQualifiedName();
    if (databases.size() > limitParam) {
      databases.remove(limitParam);
      afterCursor = databases.get(limitParam - 1).getFullyQualifiedName();
    }
    return new DatabaseList(databases, beforeCursor, afterCursor, total);
  }

  @Transaction
  public DatabaseList listBefore(Fields fields, String serviceName, int limitParam, String before) throws IOException,
          GeneralSecurityException {
    // Reverse scrolling - Get one extra result used for computing before cursor
    List<String> jsons = databaseDAO().listBefore(serviceName, limitParam + 1, CipherText.instance().decrypt(before));
    List<Database> databases = new ArrayList<>();
    for (String json : jsons) {
      databases.add(setFields(JsonUtils.readValue(json, Database.class), fields));
    }
    int total = databaseDAO().listCount(serviceName);

    String beforeCursor = null, afterCursor;
    if (databases.size() > limitParam) { // If extra result exists, then previous page exists - return before cursor
      databases.remove(0);
      beforeCursor = databases.get(0).getFullyQualifiedName();
    }
    afterCursor = databases.get(databases.size() - 1).getFullyQualifiedName();
    return new DatabaseList(databases, beforeCursor, afterCursor, total);
  }

  @Transaction
  public Database get(String id, Fields fields) throws IOException {
    return setFields(validateDatabase(id), fields);
  }

  @Transaction
  public Database getByName(String fqn, Fields fields) throws IOException {
    Database database = EntityUtil.validate(fqn, databaseDAO().findByFQN(fqn), Database.class);
    return setFields(database, fields);
  }

  @Transaction
  public Database create(Database database, EntityReference service, EntityReference owner) throws IOException {
    getService(service); // Validate service
    return createInternal(database, service, owner);
  }

  @Transaction
  public void delete(String id) {
    if (relationshipDAO().findToCount(id, Relationship.CONTAINS.ordinal(), Entity.TABLE) > 0) {
      throw new IllegalArgumentException("Database is not empty");
    }
    if (databaseDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.DATABASE, id));
    }
    relationshipDAO().deleteAll(id);
  }

  @Transaction
  public PutResponse<Database> createOrUpdate(Database updatedDB, EntityReference service, EntityReference newOwner)
          throws IOException {
    getService(service); // Validate service

    String fqn = getFQN(service, updatedDB);
    Database storedDB = JsonUtils.readValue(databaseDAO().findByFQN(fqn), Database.class);
    if (storedDB == null) {  // Database does not exist. Create a new one
      return new PutResponse<>(Status.CREATED, createInternal(updatedDB, service, newOwner));
    }
    // Update the existing database
    EntityUtil.populateOwner(userDAO(), teamDAO(), newOwner); // Validate new owner
    if (storedDB.getDescription() == null || storedDB.getDescription().isEmpty()) {
      storedDB.withDescription(updatedDB.getDescription());
    }
    databaseDAO().update(storedDB.getId().toString(), JsonUtils.pojoToJson(storedDB));

    // Update owner relationship
    setFields(storedDB, DATABASE_UPDATE_FIELDS); // First get the ownership information
    updateOwner(storedDB, storedDB.getOwner(), newOwner);

    // Service can't be changed in update since service name is part of FQN and
    // change to a different service will result in a different FQN and creation of a new database under the new service
    storedDB.setService(service);

    return new PutResponse<>(Response.Status.OK, storedDB);
  }

  @Transaction
  public Database patch(String id, JsonPatch patch) throws IOException {
    Database original = setFields(validateDatabase(id), DATABASE_PATCH_FIELDS);
    LOG.info("Database summary in original {}", original.getUsageSummary());
    Database updated = JsonUtils.applyPatch(original, patch, Database.class);
    patch(original, updated);

    // TODO disallow updating tables
    return updated;
  }

  public Database createInternal(Database database, EntityReference service, EntityReference owner) throws IOException {
    database.setFullyQualifiedName(getFQN(service, database));
    EntityUtil.populateOwner(userDAO(), teamDAO(), owner); // Validate owner

    // Query 1 - insert database into database_entity table
    databaseDAO().insert(JsonUtils.pojoToJson(database));
    setService(database, service);
    setOwner(database, owner);
    return database;
  }

  private void patch(Database original, Database updated) throws IOException {
    String databaseId = original.getId().toString();
    if (!original.getId().equals(updated.getId())) {
      throw new IllegalArgumentException(CatalogExceptionMessage.readOnlyAttribute(Entity.DATABASE, "id"));
    }
    if (!original.getName().equals(updated.getName())) {
      throw new IllegalArgumentException(CatalogExceptionMessage.readOnlyAttribute(Entity.DATABASE, "name"));
    }
    if (updated.getService() == null || !original.getService().getId().equals(updated.getService().getId())) {
      throw new IllegalArgumentException(CatalogExceptionMessage.readOnlyAttribute(Entity.DATABASE, "service"));
    }
    LOG.info("updated summary {}", updated.getUsageSummary());
    if (updated.getUsageSummary() == null || !original.getUsageSummary().equals(updated.getUsageSummary())) {
      throw new IllegalArgumentException(CatalogExceptionMessage.readOnlyAttribute(Entity.DATABASE,
              "usageSummary"));
    }
    // Validate new owner
    EntityReference newOwner = EntityUtil.populateOwner(userDAO(), teamDAO(), updated.getOwner());

    EntityReference newService = updated.getService();

    // TODO tables can't be changed
    updated.setHref(null);
    updated.setOwner(null);
    updated.setService(null);
    databaseDAO().update(databaseId, JsonUtils.pojoToJson(updated));
    updateOwner(updated, original.getOwner(), newOwner);
    updated.setService(newService);
  }

  public EntityReference getOwner(Database database) throws IOException {
    if (database == null) {
      return null;
    }
    return EntityUtil.populateOwner(database.getId(), relationshipDAO(), userDAO(), teamDAO());
  }

  private void setOwner(Database database, EntityReference owner) {
    EntityUtil.setOwner(relationshipDAO(), database.getId(), Entity.DATABASE, owner);
    database.setOwner(owner);
  }

  private void updateOwner(Database database, EntityReference origOwner, EntityReference newOwner) {
    EntityUtil.updateOwner(relationshipDAO(), origOwner, newOwner, database.getId(), Entity.DATABASE);
    database.setOwner(newOwner);
  }

  private List<Table> getTables(Database database) throws IOException {
    if (database == null) {
      return null;
    }
    String databaseId = database.getId().toString();
    List<String> tableIds = relationshipDAO().findTo(databaseId, Relationship.CONTAINS.ordinal(), Entity.TABLE);
    List<Table> tables = new ArrayList<>();
    for (String tableId : tableIds) {
      String json = tableDAO().findById(tableId);
      Table table = JsonUtils.readValue(json, Table.class);
      tables.add(table);
    }
    return tables;
  }

  private Database validateDatabase(String id) throws IOException {
    return EntityUtil.validate(id, databaseDAO().findById(id), Database.class);
  }

  private Database setFields(Database database, Fields fields) throws IOException {
    database.setOwner(fields.contains("owner") ? getOwner(database) : null);
    database.setTables(fields.contains("tables") ? toEntityReference(getTables(database)) : null);
    database.setService(fields.contains("service") ? getService(database) : null);
    database.setUsageSummary(fields.contains("usageSummary") ? EntityUtil.getLatestUsage(usageDAO(),
            database.getId()) : null);
    return database;
  }

  private EntityReference getService(Database database) throws IOException {
    return database == null ? null : getService(Objects.requireNonNull(EntityUtil.getService(relationshipDAO(),
            database.getId())));
  }

  private EntityReference getService(EntityReference service) throws IOException {
    String id = service.getId().toString();
    if (service.getType().equalsIgnoreCase(Entity.DATABASE_SERVICE)) {
      DatabaseService serviceInstance = EntityUtil.validate(id, dbServiceDAO().findById(id), DatabaseService.class);
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
      relationshipDAO().insert(service.getId().toString(), database.getId().toString(), service.getType(),
              Entity.DATABASE, Relationship.CONTAINS.ordinal());
      database.setService(service);
    }
  }

  public interface DatabaseDAO {
    @SqlUpdate("INSERT INTO database_entity (json) VALUES (:json)")
    void insert(@Bind("json") String json);

    @SqlUpdate("UPDATE database_entity SET  json = :json where id = :id")
    void update(@Bind("id") String id, @Bind("json") String json);

    @SqlQuery("SELECT json FROM database_entity WHERE fullyQualifiedName = :name")
    String findByFQN(@Bind("name") String name);

    @SqlQuery("SELECT json FROM database_entity WHERE id = :id")
    String findById(@Bind("id") String id);

    @SqlQuery("SELECT count(*) FROM database_entity WHERE " +
            "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL)")
    int listCount(@Bind("fqnPrefix") String fqnPrefix);

    @SqlQuery(
            "SELECT json FROM (" +
              "SELECT fullyQualifiedName, json FROM database_entity WHERE " +
              "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL) AND " +// Filter by service name
              "fullyQualifiedName < :before " + // Pagination by database fullyQualifiedName
              "ORDER BY fullyQualifiedName DESC " + // Pagination ordering by database fullyQualifiedName
              "LIMIT :limit" +
            ") last_rows_subquery ORDER BY fullyQualifiedName")
    List<String> listBefore(@Bind("fqnPrefix") String fqnPrefix, @Bind("limit") int limit,
                            @Bind("before") String before);

    @SqlQuery("SELECT json FROM database_entity WHERE " +
            "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL) AND " +
            "fullyQualifiedName > :after " +
            "ORDER BY fullyQualifiedName " +
            "LIMIT :limit")
    List<String> listAfter(@Bind("fqnPrefix") String fqnPrefix, @Bind("limit") int limit,
                            @Bind("after") String after);

    @SqlQuery("SELECT EXISTS (SELECT * FROM database_entity WHERE id = :id)")
    boolean exists(@Bind("id") String id);

    @SqlUpdate("DELETE FROM database_entity WHERE id = :id")
    int delete(@Bind("id") String id);
  }
}
