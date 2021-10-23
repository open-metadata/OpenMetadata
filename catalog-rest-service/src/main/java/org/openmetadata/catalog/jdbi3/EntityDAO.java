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
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.JsonUtils;

import java.io.IOException;
import java.util.List;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;

public interface EntityDAO<T> {
  /**
   * Methods that need to be overridden by interfaces extending this
   */
  String getTableName();
  Class<T> getEntityClass();
  String getNameColumn();
  EntityReference getEntityReference(T entity);

  /**
   * Common queries for all entities implemented here. Do not override.
   */
  @SqlUpdate("INSERT INTO <table> (json) VALUES (:json)")
  void insert(@Define("table") String table, @Bind("json") String json);

  @SqlUpdate("UPDATE <table> SET  json = :json WHERE id = :id")
  void update(@Define("table") String table, @Bind("id") String id, @Bind("json") String json);

  @SqlQuery("SELECT json FROM <table> WHERE id = :id")
  String findById(@Define("table") String table, @Bind("id") String id);

  @SqlQuery("SELECT json FROM <table> WHERE <nameColumn> = :name")
  String findByName(@Define("table") String table, @Define("nameColumn") String nameColumn,
                    @Bind("name") String name);

  @SqlQuery("SELECT count(*) FROM <table> WHERE " +
          "(<nameColumn> LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL)")
  int listCount(@Define("table") String table, @Define("nameColumn") String nameColumn,
                @Bind("fqnPrefix") String fqnPrefix);

  @SqlQuery(
          "SELECT json FROM (" +
                  "SELECT <nameColumn>, json FROM <table> WHERE " +
                  "(<nameColumn> LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL) AND " +// Filter by
                  // service name
                  "<nameColumn> < :before " + // Pagination by chart fullyQualifiedName
                  "ORDER BY <nameColumn> DESC " + // Pagination ordering by chart fullyQualifiedName
                  "LIMIT :limit" +
                  ") last_rows_subquery ORDER BY <nameColumn>")
  List<String> listBefore(@Define("table") String table,
                          @Define("nameColumn") String nameColumn,
                          @Bind("fqnPrefix") String fqnPrefix,
                          @Bind("limit") int limit,
                          @Bind("before") String before);

  @SqlQuery("SELECT json FROM <table> WHERE " +
          "(<nameColumn> LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL) AND " +
          "<nameColumn> > :after " +
          "ORDER BY <nameColumn> " +
          "LIMIT :limit")
  List<String> listAfter(@Define("table") String table,
                         @Define("nameColumn") String nameColumn,
                         @Bind("fqnPrefix") String fqnPrefix,
                         @Bind("limit") int limit,
                         @Bind("after") String after);

  @SqlQuery("SELECT EXISTS (SELECT * FROM <table> WHERE id = :id)")
  boolean exists(@Define("table") String table, @Bind("id") String id);

  @SqlUpdate("DELETE FROM <table> WHERE id = :id")
  int delete(@Define("table") String table, @Bind("id") String id);

  /**
   * Default methods that interfaces with implementation. Don't override
   */
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
    String json = findByName(getTableName(), getNameColumn(), fqn);
    T entity = null;
    if (json != null) {
      entity = JsonUtils.readValue(json, clz);
    }
    if (entity == null) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(clz.getSimpleName(), fqn));
    }
    return entity;
  }

  default EntityReference findEntityReferenceById(String id) throws IOException {
    return getEntityReference(findEntityById(id));
  }

  default EntityReference findEntityReferenceByName(String fqn) throws IOException {
    return getEntityReference(findEntityByName(fqn));
  }

  default String findJsonById(String fqn) throws IOException {
    return findById(getTableName(), fqn);
  }

  default String findJsonByFqn(String fqn) throws IOException {
    return findByName(getTableName(), getNameColumn(), fqn);
  }

  default int listCount(String databaseFQN) {
    return listCount(getTableName(), getNameColumn(), databaseFQN);
  }

  default List<String> listBefore(String parentFQN, int limit, String before) {
    return listBefore(getTableName(), getNameColumn(), parentFQN, limit, before);
  }

  default List<String> listAfter(String databaseFQN, int limit, String after) {
    return listAfter(getTableName(), getNameColumn(), databaseFQN, limit, after);
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