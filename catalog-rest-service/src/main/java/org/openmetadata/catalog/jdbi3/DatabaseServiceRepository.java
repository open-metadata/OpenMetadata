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
import org.openmetadata.catalog.resources.services.database.DatabaseServiceResource.DatabaseServiceList;
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


public class DatabaseServiceRepository extends EntityRepository<DatabaseService> {
  private final CollectionDAO dao;

  public DatabaseServiceRepository(CollectionDAO dao) {
    super(DatabaseService.class, dao.dbServiceDAO());
    this.dao = dao;
  }

  @Transaction
  public DatabaseService create(DatabaseService databaseService) throws JsonProcessingException {
    // Validate fields
    Utils.validateIngestionSchedule(databaseService.getIngestionSchedule());
    dao.dbServiceDAO().insert(JsonUtils.pojoToJson(databaseService));
    return databaseService;
  }

  public DatabaseService update(String id, String description, JdbcInfo jdbc, Schedule ingestionSchedule)
          throws IOException {
    Utils.validateIngestionSchedule(ingestionSchedule);
    DatabaseService dbService = dao.dbServiceDAO().findEntityById(id);
    // Update fields
    dbService.withDescription(description).withJdbc((jdbc)).withIngestionSchedule(ingestionSchedule);
    dao.dbServiceDAO().update(id, JsonUtils.pojoToJson(dbService));
    return dbService;
  }

  @Transaction
  public void delete(String id) {
    if (dao.dbServiceDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.DATABASE_SERVICE, id));
    }
    dao.relationshipDAO().deleteAll(id);
  }

  @Override
  public String getFullyQualifiedName(DatabaseService entity) {
    return entity.getName();
  }

  @Override
  public DatabaseService setFields(DatabaseService entity, Fields fields) throws IOException, ParseException {
    return entity;
  }

  @Override
  public ResultList<DatabaseService> getResultList(List<DatabaseService> entities, String beforeCursor, String afterCursor, int total) throws GeneralSecurityException, UnsupportedEncodingException {
    return new DatabaseServiceList(entities);
  }
}