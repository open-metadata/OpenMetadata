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
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.type.JdbcInfo;
import org.openmetadata.catalog.type.Schedule;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.Utils;
import org.skife.jdbi.v2.sqlobject.Bind;
import org.skife.jdbi.v2.sqlobject.CreateSqlObject;
import org.skife.jdbi.v2.sqlobject.SqlQuery;
import org.skife.jdbi.v2.sqlobject.SqlUpdate;
import org.skife.jdbi.v2.sqlobject.Transaction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.List;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;


public abstract class DatabaseServiceRepository {
  private static final Logger LOG = LoggerFactory.getLogger(DatabaseServiceRepository.class);

  @CreateSqlObject
  abstract DatabaseServiceDAO dbServiceDAO();

  @CreateSqlObject
  abstract EntityRelationshipDAO relationshipDAO();

  @Transaction
  public List<DatabaseService> list(String name) throws IOException {
    return JsonUtils.readObjects(dbServiceDAO().list(name), DatabaseService.class);
  }

  @Transaction
  public DatabaseService get(String id) throws IOException {
    return EntityUtil.validate(id, dbServiceDAO().findById(id), DatabaseService.class);
  }

  @Transaction
  public DatabaseService getByName(String name) throws IOException {
    return EntityUtil.validate(name, dbServiceDAO().findByName(name), DatabaseService.class);
  }

  @Transaction
  public DatabaseService create(DatabaseService databaseService) throws JsonProcessingException {
    // Validate fields
    Utils.validateIngestionSchedule(databaseService.getIngestionSchedule());
    dbServiceDAO().insert(JsonUtils.pojoToJson(databaseService));
    return databaseService;
  }

  public DatabaseService update(String id, String description, JdbcInfo jdbc, Schedule ingestionSchedule)
          throws IOException {
    Utils.validateIngestionSchedule(ingestionSchedule);
    DatabaseService dbService = EntityUtil.validate(id, dbServiceDAO().findById(id), DatabaseService.class);
    // Update fields
    dbService.withDescription(description).withJdbc((jdbc)).withIngestionSchedule(ingestionSchedule);
    dbServiceDAO().update(id, JsonUtils.pojoToJson(dbService));
    return dbService;
  }

  @Transaction
  public void delete(String id) {
    if (dbServiceDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.DATABASE_SERVICE, id));
    }
    relationshipDAO().deleteAll(id);
  }

  public interface DatabaseServiceDAO {
    @SqlUpdate("INSERT INTO dbservice_entity (json) VALUES (:json)")
    void insert(@Bind("json") String json);

    @SqlUpdate("UPDATE dbservice_entity SET  json = :json where id = :id")
    void update(@Bind("id") String id, @Bind("json") String json);

    @SqlQuery("SELECT json FROM dbservice_entity WHERE id = :id")
    String findById(@Bind("id") String id);

    @SqlQuery("SELECT json FROM dbservice_entity WHERE name = :name")
    String findByName(@Bind("name") String name);

    @SqlQuery("SELECT json FROM dbservice_entity WHERE (name = :name OR :name is NULL)")
    List<String> list(@Bind("name") String name);

    @SqlUpdate("DELETE FROM dbservice_entity WHERE id = :id")
    int delete(@Bind("id") String id);
  }
}