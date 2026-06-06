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

package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.jdbi3.ListFilter.escapeApostrophe;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.CreateSqlObject;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.jdbi.v3.sqlobject.customizer.BindMap;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Directory;
import org.openmetadata.schema.entity.data.File;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.entity.data.Spreadsheet;
import org.openmetadata.schema.entity.data.Worksheet;
import org.openmetadata.schema.entity.services.ApiService;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.entity.services.MetadataService;
import org.openmetadata.schema.entity.services.SearchService;
import org.openmetadata.schema.entity.services.SecurityService;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.entity.services.connections.TestConnectionDefinition;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.util.FullyQualifiedName;

public interface DataAssetServiceDAOs {
  @CreateSqlObject
  DatabaseDAO databaseDAO();

  @CreateSqlObject
  DatabaseSchemaDAO databaseSchemaDAO();

  @CreateSqlObject
  DashboardDAO dashboardDAO();

  @CreateSqlObject
  SearchIndexDAO searchIndexDAO();

  @CreateSqlObject
  DatabaseServiceDAO dbServiceDAO();

  @CreateSqlObject
  MetadataServiceDAO metadataServiceDAO();

  @CreateSqlObject
  DashboardServiceDAO dashboardServiceDAO();

  @CreateSqlObject
  StorageServiceDAO storageServiceDAO();

  @CreateSqlObject
  SearchServiceDAO searchServiceDAO();

  @CreateSqlObject
  SecurityServiceDAO securityServiceDAO();

  @CreateSqlObject
  ApiServiceDAO apiServiceDAO();

  @CreateSqlObject
  DriveServiceDAO driveServiceDAO();

  @CreateSqlObject
  ContainerDAO containerDAO();

  @CreateSqlObject
  DirectoryDAO directoryDAO();

  @CreateSqlObject
  FileDAO fileDAO();

  @CreateSqlObject
  SpreadsheetDAO spreadsheetDAO();

  @CreateSqlObject
  WorksheetDAO worksheetDAO();

  @CreateSqlObject
  TestConnectionDefinitionDAO testConnectionDefinitionDAO();

  interface DashboardDAO extends EntityDAO<Dashboard> {
    @Override
    default String getTableName() {
      return "dashboard_entity";
    }

    @Override
    default Class<Dashboard> getEntityClass() {
      return Dashboard.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }

  interface DashboardServiceDAO extends EntityDAO<DashboardService> {
    @Override
    default String getTableName() {
      return "dashboard_service_entity";
    }

    @Override
    default Class<DashboardService> getEntityClass() {
      return DashboardService.class;
    }
  }

  interface DatabaseDAO extends EntityDAO<Database> {
    @Override
    default String getTableName() {
      return "database_entity";
    }

    @Override
    default Class<Database> getEntityClass() {
      return Database.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @ConnectionAwareSqlQuery(
        value =
            "select JSON_EXTRACT(json, '$.fullyQualifiedName') from database_entity where id not in (select toId from entity_relationship where fromEntity = 'databaseService' and toEntity = 'database')",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "select json ->> 'fullyQualifiedName' from database_entity where id not in (select toId from entity_relationship where fromEntity = 'databaseService' and toEntity = 'database')",
        connectionType = POSTGRES)
    List<String> getBrokenDatabase();

    @SqlUpdate(
        value =
            "delete from database_entity where id not in (select toId from entity_relationship where fromEntity = 'databaseService' and toEntity = 'database')")
    int removeDatabase();
  }

  interface DatabaseSchemaDAO extends EntityDAO<DatabaseSchema> {
    @Override
    default String getTableName() {
      return "database_schema_entity";
    }

    @Override
    default Class<DatabaseSchema> getEntityClass() {
      return DatabaseSchema.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @ConnectionAwareSqlQuery(
        value =
            "select JSON_EXTRACT(json, '$.fullyQualifiedName') from database_schema_entity where id not in (select toId from entity_relationship where fromEntity = 'database' and toEntity = 'databaseSchema')",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "select json ->> 'fullyQualifiedName' from database_schema_entity where id not in (select toId from entity_relationship where fromEntity = 'database' and toEntity = 'databaseSchema')",
        connectionType = POSTGRES)
    List<String> getBrokenDatabaseSchemas();

    @SqlUpdate(
        value =
            "delete from database_schema_entity where id not in (select toId from entity_relationship where fromEntity = 'database' and toEntity = 'databaseSchema')")
    int removeBrokenDatabaseSchemas();
  }

  interface DatabaseServiceDAO extends EntityDAO<DatabaseService> {
    @Override
    default String getTableName() {
      return "dbservice_entity";
    }

    @Override
    default Class<DatabaseService> getEntityClass() {
      return DatabaseService.class;
    }
  }

  interface MetadataServiceDAO extends EntityDAO<MetadataService> {
    @Override
    default String getTableName() {
      return "metadata_service_entity";
    }

    @Override
    default Class<MetadataService> getEntityClass() {
      return MetadataService.class;
    }
  }

  interface TestConnectionDefinitionDAO extends EntityDAO<TestConnectionDefinition> {
    @Override
    default String getTableName() {
      return "test_connection_definition";
    }

    @Override
    default Class<TestConnectionDefinition> getEntityClass() {
      return TestConnectionDefinition.class;
    }
  }

  interface StorageServiceDAO extends EntityDAO<StorageService> {
    @Override
    default String getTableName() {
      return "storage_service_entity";
    }

    @Override
    default Class<StorageService> getEntityClass() {
      return StorageService.class;
    }
  }

  interface ContainerDAO extends EntityDAO<Container> {
    @Override
    default String getTableName() {
      return "storage_container_entity";
    }

    @Override
    default Class<Container> getEntityClass() {
      return Container.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @Override
    default List<String> listBefore(
        ListFilter filter, int limit, String beforeName, String beforeId) {

      boolean root = Boolean.parseBoolean(filter.getQueryParam("root"));
      String condition = filter.getCondition();

      // By default, root will be false. We won't filter the results then
      if (!root) {
        return EntityDAO.super.listBefore(filter, limit, beforeName, beforeId);
      }

      // Distinct method name (listRootBefore) is required: a same-signature `listBefore`
      // here would override EntityDAO's default `listBefore(String, Map, String, int,
      // String, String)` and make every non-root list call also pick up the depth check,
      // silently filtering out child containers from generic `?service=...` listings.
      return listRootBefore(
          getTableName(), rootListingParams(filter), condition, limit, beforeName, beforeId);
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, String afterName, String afterId) {
      boolean root = Boolean.parseBoolean(filter.getQueryParam("root"));
      String condition = filter.getCondition();

      if (!root) {
        return EntityDAO.super.listAfter(filter, limit, afterName, afterId);
      }

      return listRootAfter(
          getTableName(), rootListingParams(filter), condition, limit, afterName, afterId);
    }

    @Override
    default int listCount(ListFilter filter) {
      boolean root = Boolean.parseBoolean(filter.getQueryParam("root"));
      String condition = filter.getCondition();

      if (!root) {
        return EntityDAO.super.listCount(filter);
      }

      return listRootCount(
          getTableName(), getNameHashColumn(), rootListingParams(filter), condition);
    }

    /**
     * Build the bind map the listRoot SQL expects. The depth predicate
     * ({@code fqnHash NOT LIKE :serviceHashChild}) needs the {@code serviceHashChild}
     * bind to be set on every call, but {@link ListFilter#getServiceCondition} only
     * adds it when {@code ?service=} is present. For the {@code ?root=true} case
     * <em>without</em> a service filter — "all root containers across all services" —
     * we default the bind to {@code %.%.%}, which excludes any fqnHash with two or more
     * separators (everything strictly below the immediate level). Index usage is naturally
     * weaker here since the prefix LIKE is also absent, but no-service root listings are
     * rare and the result is at most one row per service.
     */
    private static java.util.Map<String, Object> rootListingParams(ListFilter filter) {
      java.util.Map<String, Object> params = new java.util.HashMap<>(filter.getQueryParams());
      params.putIfAbsent("serviceHashChild", "%.%.%");
      return params;
    }

    // Root-only listing (?root=true) returns containers that are direct children of the
    // service — i.e. one segment below the service in the FQN tree.
    //
    // Earlier implementations relied on `entity_relationship` as the source of truth ("a
    // container is a root iff no inbound CONTAINS edge exists"). That broke under two
    // separate failure modes:
    //   1. Connectors (and bulk imports) that create deeply-nested containers without
    //      writing the parent CONTAINS edge — those orphans satisfy "no inbound edge" and
    //      surface at the service root, even though their FQN is many segments deep. The
    //      breadcrumb UI (which reads the FQN) and the listing (which reads the relationship)
    //      disagreed about where the container lived.
    //   2. The NOT EXISTS anti-join needed a composite (fromEntity, toEntity, relation, toId)
    //      index to be cheap; under pgjdbc generic plans the planner often chose the
    //      ORDER BY index instead, falling back to a full-table scan and making the count
    //      query 1-2s on a service with hundreds of thousands of containers.
    //
    // The FQN is the canonical hierarchy in OpenMetadata (it's set unconditionally at write
    // time and is what the breadcrumb UI consumes). `fqnHash` is built by joining
    // fixed-width MD5 segments with '.', so depth follows from the count of separators —
    // a direct child of the service has a fqnHash matching `<serviceHash>.<32hex>` and
    // contains no further '.'. We express "not a direct child" as `fqnHash LIKE
    // <serviceHash>.%.%` and reject those rows. ListFilter.getFqnPrefixCondition binds
    // both `:serviceHash` (already used by the prefix LIKE in <sqlCondition>) and
    // `:serviceHashChild` (the `.%.%` companion) so the SQL just plugs them in.
    @SqlQuery(
        value =
            "SELECT json FROM ("
                + "SELECT name, id, ce.json FROM <table> ce "
                + "<sqlCondition> AND "
                + "ce.fqnHash NOT LIKE :serviceHashChild AND "
                + "(name < :beforeName OR (name = :beforeName AND id < :beforeId)) "
                + "ORDER BY name DESC, id DESC "
                + "LIMIT :limit"
                + ") last_rows_subquery ORDER BY name, id")
    List<String> listRootBefore(
        @Define("table") String table,
        @BindMap Map<String, ?> params,
        @Define("sqlCondition") String sqlCondition,
        @Bind("limit") int limit,
        @Bind("beforeName") String beforeName,
        @Bind("beforeId") String beforeId);

    @SqlQuery(
        value =
            "SELECT ce.json FROM <table> ce "
                + "<sqlCondition> AND "
                + "ce.fqnHash NOT LIKE :serviceHashChild AND "
                + "(name > :afterName OR (name = :afterName AND id > :afterId)) "
                + "ORDER BY name, id "
                + "LIMIT :limit")
    List<String> listRootAfter(
        @Define("table") String table,
        @BindMap Map<String, ?> params,
        @Define("sqlCondition") String sqlCondition,
        @Bind("limit") int limit,
        @Bind("afterName") String afterName,
        @Bind("afterId") String afterId);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(<nameHashColumn>) FROM <table> ce "
                + "<sqlCondition> AND ce.fqnHash NOT LIKE :serviceHashChild",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(*) FROM <table> ce "
                + "<sqlCondition> AND ce.fqnHash NOT LIKE :serviceHashChild",
        connectionType = POSTGRES)
    int listRootCount(
        @Define("table") String table,
        @Define("nameHashColumn") String nameHashColumn,
        @BindMap Map<String, ?> params,
        @Define("sqlCondition") String mysqlCond);

    /**
     * Lightweight projection used by paginated children listings. Pulls only the columns the
     * UI's children table needs (id, name, displayName, fqn, description) plus the soft-delete
     * flag. Skips JSON deserialization of heavy fields like {@code dataModel}, {@code tags},
     * and {@code owners} which can each carry MBs of column-schema metadata for parquet
     * containers. The service reference is restored separately by
     * {@link ContainerRepository#fetchAndSetDefaultService(java.util.List)}.
     */
    @ConnectionAwareSqlQuery(
        value =
            "SELECT id, name, "
                + "JSON_UNQUOTE(JSON_EXTRACT(json, '$.displayName')) AS displayName, "
                + "JSON_UNQUOTE(JSON_EXTRACT(json, '$.fullyQualifiedName')) AS fqn, "
                + "JSON_UNQUOTE(JSON_EXTRACT(json, '$.description')) AS description, "
                + "deleted "
                + "FROM storage_container_entity WHERE id IN (<ids>)",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT id, name, "
                + "json->>'displayName' AS displayName, "
                + "json->>'fullyQualifiedName' AS fqn, "
                + "json->>'description' AS description, "
                + "deleted "
                + "FROM storage_container_entity WHERE id IN (<ids>)",
        connectionType = POSTGRES)
    @RegisterRowMapper(ContainerSummaryRowMapper.class)
    List<Container> findContainerSummaryRows(@BindList("ids") List<String> ids);

    default List<Container> findContainerSummariesByIds(List<UUID> ids) {
      if (ids == null || ids.isEmpty()) {
        return List.of();
      }
      List<String> idStrings = ids.stream().map(UUID::toString).distinct().toList();
      int maxChunkSize = 30000;
      if (idStrings.size() <= maxChunkSize) {
        return findContainerSummaryRows(idStrings);
      }
      List<Container> all = new ArrayList<>(idStrings.size());
      for (int i = 0; i < idStrings.size(); i += maxChunkSize) {
        List<String> chunk = idStrings.subList(i, Math.min(i + maxChunkSize, idStrings.size()));
        all.addAll(findContainerSummaryRows(chunk));
      }
      return all;
    }

    // FQN-based direct-children page. The two binds (`:parentHash` = '<hash>.%' and
    // `:parentHashChild` = '<hash>.%.%') together select containers whose FQN is exactly one
    // segment below the parent — same shape used by the root listing in listRootAfter, just
    // without the cursor pagination. Returns the slim projection used by the children table
    // UI; the caller restores the service reference separately. `:includeDeleted` is a
    // tri-state: 'NON_DELETED' (default), 'DELETED', or 'ALL'. `:nameLike` is a LIKE pattern
    // applied to LOWER(name); callers pass '%' for "no filter" or '%<lowercased-escaped>%'
    // for a substring search. ESCAPE '!' is set explicitly so the same pattern semantics
    // hold on MySQL (default escape is '\') and PostgreSQL (default has no escape char).
    // '!' is preferred over '\' because the JDBI ColonPrefixSqlParser scans string literals
    // to skip ':' bind markers inside them, and a literal {@code '\'} confuses the scanner
    // (it treats the trailing backslash as an escape and consumes the closing quote),
    // leaving a downstream {@code :includeDeleted} bind un-substituted and the prepared
    // statement malformed.
    @ConnectionAwareSqlQuery(
        value =
            "SELECT id, name, "
                + "JSON_UNQUOTE(JSON_EXTRACT(json, '$.displayName')) AS displayName, "
                + "JSON_UNQUOTE(JSON_EXTRACT(json, '$.fullyQualifiedName')) AS fqn, "
                + "JSON_UNQUOTE(JSON_EXTRACT(json, '$.description')) AS description, "
                + "deleted "
                + "FROM storage_container_entity "
                + "WHERE fqnHash LIKE :parentHash AND fqnHash NOT LIKE :parentHashChild "
                + "  AND LOWER(name) LIKE :nameLike ESCAPE '!' "
                + "  AND (:includeDeleted = 'ALL' "
                + "       OR (:includeDeleted = 'DELETED' AND deleted = TRUE) "
                + "       OR (:includeDeleted = 'NON_DELETED' AND deleted = FALSE)) "
                + "ORDER BY name, id LIMIT :limit OFFSET :offset",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT id, name, "
                + "json->>'displayName' AS displayName, "
                + "json->>'fullyQualifiedName' AS fqn, "
                + "json->>'description' AS description, "
                + "deleted "
                + "FROM storage_container_entity "
                + "WHERE fqnHash LIKE :parentHash AND fqnHash NOT LIKE :parentHashChild "
                + "  AND LOWER(name) LIKE :nameLike ESCAPE '!' "
                + "  AND (:includeDeleted = 'ALL' "
                + "       OR (:includeDeleted = 'DELETED' AND deleted = TRUE) "
                + "       OR (:includeDeleted = 'NON_DELETED' AND deleted = FALSE)) "
                + "ORDER BY name, id LIMIT :limit OFFSET :offset",
        connectionType = POSTGRES)
    @RegisterRowMapper(ContainerSummaryRowMapper.class)
    List<Container> listDirectChildSummariesByParentHash(
        @Bind("parentHash") String parentHash,
        @Bind("parentHashChild") String parentHashChild,
        @Bind("nameLike") String nameLike,
        @Bind("includeDeleted") String includeDeleted,
        @Bind("limit") int limit,
        @Bind("offset") int offset);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(fqnHash) FROM storage_container_entity "
                + "WHERE fqnHash LIKE :parentHash AND fqnHash NOT LIKE :parentHashChild "
                + "  AND LOWER(name) LIKE :nameLike ESCAPE '!' "
                + "  AND (:includeDeleted = 'ALL' "
                + "       OR (:includeDeleted = 'DELETED' AND deleted = TRUE) "
                + "       OR (:includeDeleted = 'NON_DELETED' AND deleted = FALSE))",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(*) FROM storage_container_entity "
                + "WHERE fqnHash LIKE :parentHash AND fqnHash NOT LIKE :parentHashChild "
                + "  AND LOWER(name) LIKE :nameLike ESCAPE '!' "
                + "  AND (:includeDeleted = 'ALL' "
                + "       OR (:includeDeleted = 'DELETED' AND deleted = TRUE) "
                + "       OR (:includeDeleted = 'NON_DELETED' AND deleted = FALSE))",
        connectionType = POSTGRES)
    int countDirectChildrenByParentHash(
        @Bind("parentHash") String parentHash,
        @Bind("parentHashChild") String parentHashChild,
        @Bind("nameLike") String nameLike,
        @Bind("includeDeleted") String includeDeleted);

    /**
     * Cascade an FQN rename to every descendant container row when a parent is reassigned
     * (#24294). The generic {@link EntityDAO#updateFqn(String, String)} only rewrites the
     * top-level {@code $.fullyQualifiedName} via MySQL {@code JSON_REPLACE}, which leaves
     * nested column FQNs ({@code $.dataModel.columns[*].fullyQualifiedName}) pointing at the
     * old parent — silently breaking column lookups on MySQL. Postgres works only by accident
     * because the base impl does a global {@code REPLACE(json::text, ...)}.
     *
     * <p>This override rewrites every {@code "fullyQualifiedName": "OLD_PREFIX..."} occurrence
     * in the JSON document so column FQNs follow their container. {@code WHERE fqnHash LIKE
     * 'oldHash.%'} restricts the update to descendants — the moved row itself updates via the
     * standard {@code storeEntity} path after {@code setFullyQualifiedName} runs in memory.
     *
     * <p><b>On SQL interpolation:</b> mirrors the pre-existing {@link EntityDAO#updateFqn}
     * pattern — values are spliced into the SQL via {@link String#format} because the
     * connection-aware {@code @SqlUpdate} dispatcher takes the full statement as a single
     * {@code <mySqlUpdate>}/{@code <postgresUpdate>} bind. The values come from server-side
     * code (the FQN computed by {@code setFullyQualifiedName}, not user-supplied input), and
     * {@link ListFilter#escapeApostrophe} handles the only SQL meta-character that can appear
     * in a validated entity name. If a future code path lets arbitrary strings reach this
     * method, swap to a parameterised form with {@code @Bind} parameters.
     */
    @Override
    default void updateFqn(String oldPrefix, String newPrefix) {
      if (!getNameHashColumn().equals("fqnHash")) {
        return;
      }
      String oldHash = FullyQualifiedName.buildHash(oldPrefix);
      String newHash = FullyQualifiedName.buildHash(newPrefix);
      String mySqlUpdate =
          String.format(
              "UPDATE %s SET json = CAST(REPLACE(CAST(json AS CHAR), "
                  + "'\"fullyQualifiedName\": \"%s.', '\"fullyQualifiedName\": \"%s.') AS JSON), "
                  + "fqnHash = REPLACE(fqnHash, '%s.', '%s.') "
                  + "WHERE fqnHash LIKE '%s.%%'",
              getTableName(),
              escapeApostrophe(oldPrefix),
              escapeApostrophe(newPrefix),
              oldHash,
              newHash,
              oldHash);
      String postgresUpdate =
          String.format(
              "UPDATE %s SET json = REPLACE(json::text, "
                  + "'\"fullyQualifiedName\": \"%s.', '\"fullyQualifiedName\": \"%s.')::jsonb, "
                  + "fqnHash = REPLACE(fqnHash, '%s.', '%s.') "
                  + "WHERE fqnHash LIKE '%s.%%'",
              getTableName(),
              escapeApostrophe(oldPrefix),
              escapeApostrophe(newPrefix),
              oldHash,
              newHash,
              oldHash);
      updateFqnInternal(mySqlUpdate, postgresUpdate);
    }

    /**
     * Cheap descendant count used by the PATCH re-parent guard (#24294) to short-circuit
     * absurd subtree moves before any cascade work runs. {@code fqnHash LIKE 'oldHash.%'}
     * matches every descendant row (excluding the moved container itself) and the index on
     * {@code fqnHash} makes this an O(log n) lookup.
     */
    @SqlQuery("SELECT COUNT(*) FROM storage_container_entity WHERE fqnHash LIKE :prefixLike")
    int countDescendantsByPrefix(@Bind("prefixLike") String prefixLike);
  }

  class ContainerSummaryRowMapper implements RowMapper<Container> {
    @Override
    public Container map(ResultSet rs, StatementContext ctx) throws SQLException {
      return new Container()
          .withId(UUID.fromString(rs.getString("id")))
          .withName(rs.getString("name"))
          .withDisplayName(rs.getString("displayName"))
          .withFullyQualifiedName(rs.getString("fqn"))
          .withDescription(rs.getString("description"))
          .withDeleted(rs.getBoolean("deleted"));
    }
  }

  interface SearchServiceDAO extends EntityDAO<SearchService> {
    @Override
    default String getTableName() {
      return "search_service_entity";
    }

    @Override
    default Class<SearchService> getEntityClass() {
      return SearchService.class;
    }
  }

  interface SecurityServiceDAO extends EntityDAO<SecurityService> {
    @Override
    default String getTableName() {
      return "security_service_entity";
    }

    @Override
    default Class<SecurityService> getEntityClass() {
      return SecurityService.class;
    }
  }

  interface ApiServiceDAO extends EntityDAO<ApiService> {
    @Override
    default String getTableName() {
      return "api_service_entity";
    }

    @Override
    default Class<ApiService> getEntityClass() {
      return ApiService.class;
    }
  }

  interface DriveServiceDAO extends EntityDAO<DriveService> {
    @Override
    default String getTableName() {
      return "drive_service_entity";
    }

    @Override
    default Class<DriveService> getEntityClass() {
      return DriveService.class;
    }
  }

  interface DirectoryDAO extends EntityDAO<Directory> {
    @Override
    default String getTableName() {
      return "directory_entity";
    }

    @Override
    default Class<Directory> getEntityClass() {
      return Directory.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @Override
    default List<String> listBefore(
        ListFilter filter, int limit, String beforeName, String beforeId) {
      boolean root = Boolean.parseBoolean(filter.getQueryParam("root"));
      String condition = filter.getCondition();
      if (!root) {
        return EntityDAO.super.listBefore(filter, limit, beforeName, beforeId);
      }
      String sqlCondition = String.format("%s AND er.toId is NULL", condition);
      return listBefore(
          getTableName(), filter.getQueryParams(), sqlCondition, limit, beforeName, beforeId);
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, String afterName, String afterId) {
      boolean root = Boolean.parseBoolean(filter.getQueryParam("root"));
      String condition = filter.getCondition();
      if (!root) {
        return EntityDAO.super.listAfter(filter, limit, afterName, afterId);
      }
      String sqlCondition = String.format("%s AND er.toId is NULL", condition);
      return listAfter(
          getTableName(), filter.getQueryParams(), sqlCondition, limit, afterName, afterId);
    }

    @Override
    default int listCount(ListFilter filter) {
      boolean root = Boolean.parseBoolean(filter.getQueryParam("root"));
      String condition = filter.getCondition();
      if (!root) {
        return EntityDAO.super.listCount(filter);
      }
      String sqlCondition = String.format("%s AND er.toId is NULL", condition);
      return listCount(getTableName(), getNameHashColumn(), filter.getQueryParams(), sqlCondition);
    }

    @SqlQuery(
        value =
            "SELECT json FROM ("
                + "SELECT name,id, ce.json FROM <table> ce "
                + "LEFT JOIN ("
                + "  SELECT toId FROM entity_relationship "
                + "  WHERE fromEntity = 'directory' AND toEntity = 'directory' AND relation = 0 "
                + ") er "
                + "on ce.id = er.toId "
                + "<sqlCondition> AND "
                + "(name < :beforeName OR (name = :beforeName AND id < :beforeId))  "
                + "ORDER BY name DESC,id DESC "
                + "LIMIT :limit"
                + ") last_rows_subquery ORDER BY name,id")
    List<String> listBefore(
        @Define("table") String table,
        @BindMap Map<String, ?> params,
        @Define("sqlCondition") String sqlCondition,
        @Bind("limit") int limit,
        @Bind("beforeName") String beforeName,
        @Bind("beforeId") String beforeId);

    @SqlQuery(
        value =
            "SELECT ce.json FROM <table> ce "
                + "LEFT JOIN ("
                + "  SELECT toId FROM entity_relationship "
                + "  WHERE fromEntity = 'directory' AND toEntity = 'directory' AND relation = 0 "
                + ") er "
                + "on ce.id = er.toId "
                + "<sqlCondition> AND "
                + "(name > :afterName OR (name = :afterName AND id > :afterId))  "
                + "ORDER BY name,id "
                + "LIMIT :limit")
    List<String> listAfter(
        @Define("table") String table,
        @BindMap Map<String, ?> params,
        @Define("sqlCondition") String sqlCondition,
        @Bind("limit") int limit,
        @Bind("afterName") String afterName,
        @Bind("afterId") String afterId);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(<nameHashColumn>) FROM <table> ce "
                + "LEFT JOIN ("
                + "  SELECT toId FROM entity_relationship "
                + "  WHERE fromEntity = 'directory' AND toEntity = 'directory' AND relation = 0 "
                + ") er "
                + "on ce.id = er.toId "
                + "<sqlCondition>",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(*) FROM <table> ce "
                + "LEFT JOIN ("
                + "  SELECT toId FROM entity_relationship "
                + "  WHERE fromEntity = 'directory' AND toEntity = 'directory' AND relation = 0 "
                + ") er "
                + "on ce.id = er.toId "
                + "<sqlCondition>",
        connectionType = POSTGRES)
    int listCount(
        @Define("table") String table,
        @Define("nameHashColumn") String nameHashColumn,
        @BindMap Map<String, ?> params,
        @Define("sqlCondition") String mysqlCond);
  }

  interface FileDAO extends EntityDAO<File> {
    @Override
    default String getTableName() {
      return "file_entity";
    }

    @Override
    default Class<File> getEntityClass() {
      return File.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @Override
    default List<String> listBefore(
        ListFilter filter, int limit, String beforeName, String beforeId) {
      boolean root = Boolean.parseBoolean(filter.getQueryParam("root"));
      String condition = filter.getCondition();
      if (!root) {
        return EntityDAO.super.listBefore(filter, limit, beforeName, beforeId);
      }
      String sqlCondition = String.format("%s AND er.toId is NULL", condition);
      return listBefore(
          getTableName(), filter.getQueryParams(), sqlCondition, limit, beforeName, beforeId);
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, String afterName, String afterId) {
      boolean root = Boolean.parseBoolean(filter.getQueryParam("root"));
      String condition = filter.getCondition();
      if (!root) {
        return EntityDAO.super.listAfter(filter, limit, afterName, afterId);
      }
      String sqlCondition = String.format("%s AND er.toId is NULL", condition);
      return listAfter(
          getTableName(), filter.getQueryParams(), sqlCondition, limit, afterName, afterId);
    }

    @Override
    default int listCount(ListFilter filter) {
      boolean root = Boolean.parseBoolean(filter.getQueryParam("root"));
      String condition = filter.getCondition();
      if (!root) {
        return EntityDAO.super.listCount(filter);
      }
      String sqlCondition = String.format("%s AND er.toId is NULL", condition);
      return listCount(getTableName(), getNameHashColumn(), filter.getQueryParams(), sqlCondition);
    }

    @SqlQuery(
        value =
            "SELECT json FROM ("
                + "SELECT name,id, ce.json FROM <table> ce "
                + "LEFT JOIN ("
                + "  SELECT toId FROM entity_relationship "
                + "  WHERE fromEntity IN ('directory', 'spreadsheet') AND toEntity = 'file' AND relation = 0 "
                + ") er "
                + "on ce.id = er.toId "
                + "<sqlCondition> AND "
                + "(name < :beforeName OR (name = :beforeName AND id < :beforeId))  "
                + "ORDER BY name DESC,id DESC "
                + "LIMIT :limit"
                + ") last_rows_subquery ORDER BY name,id")
    List<String> listBefore(
        @Define("table") String table,
        @BindMap Map<String, ?> params,
        @Define("sqlCondition") String sqlCondition,
        @Bind("limit") int limit,
        @Bind("beforeName") String beforeName,
        @Bind("beforeId") String beforeId);

    @SqlQuery(
        value =
            "SELECT ce.json FROM <table> ce "
                + "LEFT JOIN ("
                + "  SELECT toId FROM entity_relationship "
                + "  WHERE fromEntity IN ('directory', 'spreadsheet') AND toEntity = 'file' AND relation = 0 "
                + ") er "
                + "on ce.id = er.toId "
                + "<sqlCondition> AND "
                + "(name > :afterName OR (name = :afterName AND id > :afterId))  "
                + "ORDER BY name,id "
                + "LIMIT :limit")
    List<String> listAfter(
        @Define("table") String table,
        @BindMap Map<String, ?> params,
        @Define("sqlCondition") String sqlCondition,
        @Bind("limit") int limit,
        @Bind("afterName") String afterName,
        @Bind("afterId") String afterId);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(<nameHashColumn>) FROM <table> ce "
                + "LEFT JOIN ("
                + "  SELECT toId FROM entity_relationship "
                + "  WHERE fromEntity IN ('directory', 'spreadsheet') AND toEntity = 'file' AND relation = 0 "
                + ") er "
                + "on ce.id = er.toId "
                + "<sqlCondition>",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(*) FROM <table> ce "
                + "LEFT JOIN ("
                + "  SELECT toId FROM entity_relationship "
                + "  WHERE fromEntity IN ('directory', 'spreadsheet') AND toEntity = 'file' AND relation = 0 "
                + ") er "
                + "on ce.id = er.toId "
                + "<sqlCondition>",
        connectionType = POSTGRES)
    int listCount(
        @Define("table") String table,
        @Define("nameHashColumn") String nameHashColumn,
        @BindMap Map<String, ?> params,
        @Define("sqlCondition") String mysqlCond);
  }

  interface SpreadsheetDAO extends EntityDAO<Spreadsheet> {
    @Override
    default String getTableName() {
      return "spreadsheet_entity";
    }

    @Override
    default Class<Spreadsheet> getEntityClass() {
      return Spreadsheet.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }

    @Override
    default List<String> listBefore(
        ListFilter filter, int limit, String beforeName, String beforeId) {
      boolean root = Boolean.parseBoolean(filter.getQueryParam("root"));
      String condition = filter.getCondition();
      if (!root) {
        return EntityDAO.super.listBefore(filter, limit, beforeName, beforeId);
      }
      String sqlCondition = String.format("%s AND er.toId is NULL", condition);
      return listBefore(
          getTableName(), filter.getQueryParams(), sqlCondition, limit, beforeName, beforeId);
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, String afterName, String afterId) {
      boolean root = Boolean.parseBoolean(filter.getQueryParam("root"));
      String condition = filter.getCondition();
      if (!root) {
        return EntityDAO.super.listAfter(filter, limit, afterName, afterId);
      }
      String sqlCondition = String.format("%s AND er.toId is NULL", condition);
      return listAfter(
          getTableName(), filter.getQueryParams(), sqlCondition, limit, afterName, afterId);
    }

    @Override
    default int listCount(ListFilter filter) {
      boolean root = Boolean.parseBoolean(filter.getQueryParam("root"));
      String condition = filter.getCondition();
      if (!root) {
        return EntityDAO.super.listCount(filter);
      }
      String sqlCondition = String.format("%s AND er.toId is NULL", condition);
      return listCount(getTableName(), getNameHashColumn(), filter.getQueryParams(), sqlCondition);
    }

    @SqlQuery(
        value =
            "SELECT json FROM ("
                + "SELECT name,id, ce.json FROM <table> ce "
                + "LEFT JOIN ("
                + "  SELECT toId FROM entity_relationship "
                + "  WHERE fromEntity = 'directory' AND toEntity = 'spreadsheet' AND relation = 0 "
                + ") er "
                + "on ce.id = er.toId "
                + "<sqlCondition> AND "
                + "(name < :beforeName OR (name = :beforeName AND id < :beforeId))  "
                + "ORDER BY name DESC,id DESC "
                + "LIMIT :limit"
                + ") last_rows_subquery ORDER BY name,id")
    List<String> listBefore(
        @Define("table") String table,
        @BindMap Map<String, ?> params,
        @Define("sqlCondition") String sqlCondition,
        @Bind("limit") int limit,
        @Bind("beforeName") String beforeName,
        @Bind("beforeId") String beforeId);

    @SqlQuery(
        value =
            "SELECT ce.json FROM <table> ce "
                + "LEFT JOIN ("
                + "  SELECT toId FROM entity_relationship "
                + "  WHERE fromEntity = 'directory' AND toEntity = 'spreadsheet' AND relation = 0 "
                + ") er "
                + "on ce.id = er.toId "
                + "<sqlCondition> AND "
                + "(name > :afterName OR (name = :afterName AND id > :afterId))  "
                + "ORDER BY name,id "
                + "LIMIT :limit")
    List<String> listAfter(
        @Define("table") String table,
        @BindMap Map<String, ?> params,
        @Define("sqlCondition") String sqlCondition,
        @Bind("limit") int limit,
        @Bind("afterName") String afterName,
        @Bind("afterId") String afterId);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(<nameHashColumn>) FROM <table> ce "
                + "LEFT JOIN ("
                + "  SELECT toId FROM entity_relationship "
                + "  WHERE fromEntity = 'directory' AND toEntity = 'spreadsheet' AND relation = 0 "
                + ") er "
                + "on ce.id = er.toId "
                + "<sqlCondition>",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(*) FROM <table> ce "
                + "LEFT JOIN ("
                + "  SELECT toId FROM entity_relationship "
                + "  WHERE fromEntity = 'directory' AND toEntity = 'spreadsheet' AND relation = 0 "
                + ") er "
                + "on ce.id = er.toId "
                + "<sqlCondition>",
        connectionType = POSTGRES)
    int listCount(
        @Define("table") String table,
        @Define("nameHashColumn") String nameHashColumn,
        @BindMap Map<String, ?> params,
        @Define("sqlCondition") String mysqlCond);
  }

  interface WorksheetDAO extends EntityDAO<Worksheet> {
    @Override
    default String getTableName() {
      return "worksheet_entity";
    }

    @Override
    default Class<Worksheet> getEntityClass() {
      return Worksheet.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }

  interface SearchIndexDAO extends EntityDAO<SearchIndex> {
    @Override
    default String getTableName() {
      return "search_index_entity";
    }

    @Override
    default Class<SearchIndex> getEntityClass() {
      return SearchIndex.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }
}
