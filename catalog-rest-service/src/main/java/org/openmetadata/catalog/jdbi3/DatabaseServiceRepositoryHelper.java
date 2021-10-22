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
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.type.JdbcInfo;
import org.openmetadata.catalog.type.Schedule;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.catalog.util.Utils;

import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.List;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;


public class DatabaseServiceRepositoryHelper implements EntityRepository<DatabaseService> {
  public DatabaseServiceRepositoryHelper(DatabaseServiceRepository3 repo3) { this.repo3 = repo3; }

  private final DatabaseServiceRepository3 repo3;

  @Transaction
  public List<DatabaseService> list(String name) throws IOException {
    return JsonUtils.readObjects(repo3.dbServiceDAO().list(name), DatabaseService.class);
  }

  @Transaction
  public DatabaseService get(String id) throws IOException {
    return repo3.dbServiceDAO().findEntityById(id);
  }

  @Transaction
  public DatabaseService getByName(String name) throws IOException {
    return repo3.dbServiceDAO().findEntityByName(name);
  }

  @Transaction
  public DatabaseService create(DatabaseService databaseService) throws JsonProcessingException {
    // Validate fields
    Utils.validateIngestionSchedule(databaseService.getIngestionSchedule());
    repo3.dbServiceDAO().insert(JsonUtils.pojoToJson(databaseService));
    return databaseService;
  }

  public DatabaseService update(String id, String description, JdbcInfo jdbc, Schedule ingestionSchedule)
          throws IOException {
    Utils.validateIngestionSchedule(ingestionSchedule);
    DatabaseService dbService = repo3.dbServiceDAO().findEntityById(id);
    // Update fields
    dbService.withDescription(description).withJdbc((jdbc)).withIngestionSchedule(ingestionSchedule);
    repo3.dbServiceDAO().update(id, JsonUtils.pojoToJson(dbService));
    return dbService;
  }

  @Transaction
  public void delete(String id) {
    if (repo3.dbServiceDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.DATABASE_SERVICE, id));
    }
    repo3.relationshipDAO().deleteAll(id);
  }

  @Override
  public List<String> listAfter(String fqnPrefix, int limitParam, String after) {
    return null;
  }

  @Override
  public List<String> listBefore(String fqnPrefix, int limitParam, String before) {
    return null;
  }

  @Override
  public int listCount(String fqnPrefix) {
    return 0;
  }

  @Override
  public String getFullyQualifiedName(DatabaseService entity) {
    return null;
  }

  @Override
  public DatabaseService setFields(DatabaseService entity, Fields fields) throws IOException, ParseException {
    return null;
  }

  @Override
  public ResultList<DatabaseService> getResultList(List<DatabaseService> entities, String beforeCursor, String afterCursor, int total) throws GeneralSecurityException, UnsupportedEncodingException {
    return null;
  }
}