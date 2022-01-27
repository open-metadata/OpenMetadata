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
import static org.openmetadata.catalog.util.EntityUtil.toBoolean;

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

  @SqlQuery("SELECT json FROM <table> WHERE id = :id AND (deleted = :deleted OR :deleted IS NULL)")
  String findById(@Define("table") String table, @Bind("id") String id, @Bind("deleted") Boolean deleted);

  @SqlQuery("SELECT json FROM <table> WHERE <nameColumn> = :name AND (deleted = :deleted OR :deleted IS NULL)")
  String findByName(
      @Define("table") String table,
      @Define("nameColumn") String nameColumn,
      @Bind("name") String name,
      @Bind("deleted") Boolean deleted);

  @SqlQuery(
      "SELECT count(*) FROM <table> WHERE "
          + "(<nameColumn> LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL) AND "
          + "(deleted = :deleted OR :deleted IS NULL)")
  int listCount(
      @Define("table") String table,
      @Define("nameColumn") String nameColumn,
      @Bind("fqnPrefix") String fqnPrefix,
      @Bind("deleted") Boolean deleted);

  @SqlQuery(
      "SELECT json FROM ("
          + "SELECT <nameColumn>, json FROM <table> WHERE "
          + "(<nameColumn> LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL) AND "
          + // Filter by service name
          "<nameColumn> < :before AND "
          + "deleted = false "
          + // Pagination by chart fullyQualifiedName
          "ORDER BY <nameColumn> DESC "
          + // Pagination ordering by chart fullyQualifiedName
          "LIMIT :limit"
          + ") last_rows_subquery ORDER BY <nameColumn>")
  List<String> listBefore(
      @Define("table") String table,
      @Define("nameColumn") String nameColumn,
      @Bind("fqnPrefix") String fqnPrefix,
      @Bind("limit") int limit,
      @Bind("before") String before);

  @SqlQuery(
      "SELECT json FROM ("
          + "SELECT <nameColumn>, json FROM <table> WHERE "
          + "(<nameColumn> LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL) AND "
          + // Filter by service name
          "<nameColumn> < :before AND "
          + "(deleted = :deleted OR :deleted IS NULL) "
          + // Pagination by chart fullyQualifiedName
          "ORDER BY <nameColumn> DESC "
          + // Pagination ordering by chart fullyQualifiedName
          "LIMIT :limit"
          + ") last_rows_subquery ORDER BY <nameColumn>")
  List<String> listBefore(
      @Define("table") String table,
      @Define("nameColumn") String nameColumn,
      @Bind("fqnPrefix") String fqnPrefix,
      @Bind("limit") int limit,
      @Bind("before") String before,
      @Bind("deleted") Boolean deleted);

  @SqlQuery(
      "SELECT json FROM <table> WHERE "
          + "(<nameColumn> LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL) AND "
          + "<nameColumn> > :after AND "
          + "deleted = false "
          + "ORDER BY <nameColumn> "
          + "LIMIT :limit")
  List<String> listAfter(
      @Define("table") String table,
      @Define("nameColumn") String nameColumn,
      @Bind("fqnPrefix") String fqnPrefix,
      @Bind("limit") int limit,
      @Bind("after") String after);

  @SqlQuery(
      "SELECT json FROM <table> WHERE "
          + "(<nameColumn> LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL) AND "
          + "<nameColumn> > :after AND "
          + "(deleted = :deleted OR :deleted IS NULL) "
          + "ORDER BY <nameColumn> "
          + "LIMIT :limit")
  List<String> listAfter(
      @Define("table") String table,
      @Define("nameColumn") String nameColumn,
      @Bind("fqnPrefix") String fqnPrefix,
      @Bind("limit") int limit,
      @Bind("after") String after,
      @Bind("deleted") Boolean deleted);

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

  default T findEntityById(UUID id, Include include) throws IOException {
    Class<T> clz = getEntityClass();
    String json = findById(getTableName(), id.toString(), toBoolean(include));
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
    String json = findByName(getTableName(), getNameColumn(), fqn, toBoolean(include));
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

  default String findJsonById(String id, Include include) {
    return findById(getTableName(), id, toBoolean(include));
  }

  default String findJsonByFqn(String fqn, Include include) {
    return findByName(getTableName(), getNameColumn(), fqn, toBoolean(include));
  }

  default int listCount(String databaseFQN, Include include) {
    return listCount(getTableName(), getNameColumn(), databaseFQN, toBoolean(include));
  }

  default List<String> listBefore(String parentFQN, int limit, String before, Include include) {
    return listBefore(getTableName(), getNameColumn(), parentFQN, limit, before, toBoolean(include));
  }

  default List<String> listAfter(String databaseFQN, int limit, String after, Include include) {
    return listAfter(getTableName(), getNameColumn(), databaseFQN, limit, after, toBoolean(include));
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
