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

import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.util.JsonUtils;

import java.io.IOException;
import java.util.List;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;

public interface EntityDAO<T> {
  // TODO javadoc
  String getTableName();
  Class<T> getEntityClass();

  @SqlUpdate("INSERT INTO <table> (json) VALUES (:json)")
  void insert(@Define("table") String table, @Bind("json") String json);

  @SqlUpdate("UPDATE <table> SET  json = :json WHERE id = :id")
  void update(@Define("table") String table, @Bind("id") String id, @Bind("json") String json);

  @SqlQuery("SELECT json FROM <table> WHERE id = :id")
  String findById(@Define("table") String table, @Bind("id") String id);

  String findByName(String table, String name);
  int listCount(String table, String databaseFQN); // TODO check this
  List<String> listBefore(String table, String parentFQN, int limit, String before);
  List<String> listAfter(String table, String parentFQN, int limit, String after);
  boolean exists(String table, String id);
  int delete(String table, String id);

  default void insert(String json) {
    insert(getTableName(), json);
  }

  default void update(String id, String json) {
    update(getTableName(), id, json);
  }

  default T findEntityById(String id) throws IOException {
    Class<T> clz = getEntityClass();
    String json = findById(getTableName(), id);
    T entity = null;
    if (json != null) {
      entity = JsonUtils.readValue(json, clz);
    }
    if (entity == null) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(clz.getSimpleName(), id));
    }
    return entity;
  }

  default T findEntityByName(String fqn) throws IOException {
    Class<T> clz = getEntityClass();
    String json = findByName(getTableName(), fqn);
    T entity = null;
    if (json != null) {
      entity = JsonUtils.readValue(json, clz);
    }
    if (entity == null) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(clz.getSimpleName(), fqn));
    }
    return entity;
  }

  default String findJsonById(String fqn) throws IOException {
    return findById(getTableName(), fqn);
  }

  default String findJsonByFqn(String fqn) throws IOException {
    return findByName(getTableName(), fqn);
  }

  default int listCount(String databaseFQN) {
    return listCount(getTableName(), databaseFQN);
  }

  default List<String> listBefore(String parentFQN, int limit, String before) {
    return listBefore(getTableName(), parentFQN, limit, before);
  }

  default List<String> listAfter(String databaseFQN, int limit, String after) {
    return listAfter(getTableName(), databaseFQN, limit, after);
  }

  default boolean exists(String id) {
    return exists(getTableName(), id);
  }

  default int delete(String id) {
    int rowsDeleted = delete(getTableName(), id);
    if (rowsDeleted <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(getEntityClass().getSimpleName(), id));
    }
    return rowsDeleted;
  }
}