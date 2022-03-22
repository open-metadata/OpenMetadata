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

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.util.JsonUtils;

public interface EntityDAO<T> {
  /** Methods that need to be overridden by interfaces extending this */
  String getTableName();

  Class<T> getEntityClass();

  String getNameColumn();

  EntityReference getEntityReference(T entity);

  /** Common queries for all entities implemented here. Do not override. */
  @SqlUpdate("INSERT INTO <table> (json) VALUES (:json)")
  void insert(@Define("table") String table, @Bind("json") String json);

  @SqlUpdate("UPDATE <table> SET  json = :json WHERE id = :id")
  void update(@Define("table") String table, @Bind("id") String id, @Bind("json") String json);

  @SqlQuery("SELECT json FROM <table> WHERE id = :id <cond>")
  String findById(@Define("table") String table, @Bind("id") String id, @Define("cond") String cond);

  @SqlQuery("SELECT json FROM <table> WHERE <nameColumn> = :name <cond>")
  String findByName(
      @Define("table") String table,
      @Define("nameColumn") String nameColumn,
      @Bind("name") String name,
      @Define("cond") String cond);

  @SqlQuery("SELECT count(*) FROM <table> <cond>")
  int listCount(@Define("table") String table, @Define("nameColumn") String nameColumn, @Define("cond") String cond);

  @SqlQuery(
      "SELECT json FROM ("
          + "SELECT <nameColumn>, json FROM <table> <cond> AND "
          + "<nameColumn> < :before "
          + // Pagination by chart fullyQualifiedName
          "ORDER BY <nameColumn> DESC "
          + // Pagination ordering by chart fullyQualifiedName
          "LIMIT :limit"
          + ") last_rows_subquery ORDER BY <nameColumn>")
  List<String> listBefore(
      @Define("table") String table,
      @Define("nameColumn") String nameColumn,
      @Define("cond") String cond,
      @Bind("limit") int limit,
      @Bind("before") String before);

  @SqlQuery(
      "SELECT json FROM <table> <cond> AND " + "<nameColumn> > :after " + "ORDER BY <nameColumn> " + "LIMIT :limit")
  List<String> listAfter(
      @Define("table") String table,
      @Define("nameColumn") String nameColumn,
      @Define("cond") String cond,
      @Bind("limit") int limit,
      @Bind("after") String after);

  @SqlQuery("SELECT EXISTS (SELECT * FROM <table> WHERE id = :id)")
  boolean exists(@Define("table") String table, @Bind("id") String id);

  @SqlUpdate("DELETE FROM <table> WHERE id = :id")
  int delete(@Define("table") String table, @Bind("id") String id);

  /** Default methods that interfaces with implementation. Don't override */
  default void insert(T entity) throws JsonProcessingException {
    insert(getTableName(), JsonUtils.pojoToJson(entity));
  }

  default void update(UUID id, String json) {
    update(getTableName(), id.toString(), json);
  }

  default String getCondition(Include include) {
    if (include == null || include == Include.NON_DELETED) {
      return "AND deleted = false";
    }
    if (include == Include.DELETED) {
      return " AND deleted = true";
    }
    return "";
  }

  default T findEntityById(UUID id, Include include) throws IOException {
    Class<T> clz = getEntityClass();
    String json = findById(getTableName(), id.toString(), getCondition(include));
    T entity = null;
    if (json != null) {
      entity = JsonUtils.readValue(json, clz);
    }
    if (entity == null) {
      String entityType = Entity.getEntityTypeFromClass(clz);
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(entityType, id));
    }
    return entity;
  }

  default T findEntityById(UUID id) throws IOException {
    return findEntityById(id, Include.NON_DELETED);
  }

  default T findEntityByName(String fqn) throws IOException {
    return findEntityByName(fqn, Include.NON_DELETED);
  }

  default T findEntityByName(String fqn, Include include) throws IOException {
    Class<T> clz = getEntityClass();
    String json = findByName(getTableName(), getNameColumn(), fqn, getCondition(include));
    T entity = null;
    if (json != null) {
      entity = JsonUtils.readValue(json, clz);
    }
    if (entity == null) {
      String entityType = Entity.getEntityTypeFromClass(clz);
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(entityType, fqn));
    }
    return entity;
  }

  default EntityReference findEntityReferenceById(UUID id) throws IOException {
    return getEntityReference(findEntityById(id));
  }

  default EntityReference findEntityReferenceByName(String fqn) throws IOException {
    return getEntityReference(findEntityByName(fqn));
  }

  default EntityReference findEntityReferenceById(UUID id, Include include) throws IOException {
    return getEntityReference(findEntityById(id, include));
  }

  default EntityReference findEntityReferenceByName(String fqn, Include include) throws IOException {
    return getEntityReference(findEntityByName(fqn, include));
  }

  default String findJsonById(String id, Include include) {
    return findById(getTableName(), id, getCondition(include));
  }

  default String findJsonByFqn(String fqn, Include include) {
    return findByName(getTableName(), getNameColumn(), fqn, getCondition(include));
  }

  default int listCount(ListFilter filter) {
    return listCount(getTableName(), getNameColumn(), filter.getCondition());
  }

  default List<String> listBefore(ListFilter filter, int limit, String before) {

    return listBefore(getTableName(), getNameColumn(), filter.getCondition(), limit, before);
  }

  default List<String> listAfter(ListFilter filter, int limit, String after) {
    return listAfter(getTableName(), getNameColumn(), filter.getCondition(), limit, after);
  }

  default boolean exists(UUID id) {
    return exists(getTableName(), id.toString());
  }

  default int delete(String id) {
    int rowsDeleted = delete(getTableName(), id);
    if (rowsDeleted <= 0) {
      String entityType = Entity.getEntityTypeFromClass(getEntityClass());
      throw EntityNotFoundException.byMessage(entityNotFound(entityType, id));
    }
    return rowsDeleted;
  }
}
