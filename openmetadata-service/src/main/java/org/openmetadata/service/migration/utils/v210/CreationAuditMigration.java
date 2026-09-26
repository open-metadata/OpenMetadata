/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.migration.utils.v210;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.util.EntityUtil;

/**
 * Backfills the {@code createdAt}/{@code createdBy} audit fields introduced in 2.1.0.
 *
 * <p>An entity's oldest stored version carries the {@code updatedAt}/{@code updatedBy} recorded when
 * it was first created, so that row is the accurate source. Entities whose version history has been
 * pruned — or that were never updated — fall back to their own current values.
 *
 * <p>Both passes only touch rows where {@code createdAt} is still absent, so re-running the
 * migration is a no-op.
 */
@Slf4j
public final class CreationAuditMigration {

  /** An entity type that declares the creation-audit fields, paired with its storage table. */
  public record AuditedEntity(String entityType, String tableName) {}

  private static final List<AuditedEntity> AUDITED_ENTITIES =
      List.of(
          new AuditedEntity(Entity.TABLE, "table_entity"),
          new AuditedEntity(Entity.DATABASE, "database_entity"),
          new AuditedEntity(Entity.DATABASE_SCHEMA, "database_schema_entity"),
          new AuditedEntity(Entity.DASHBOARD, "dashboard_entity"),
          new AuditedEntity(Entity.CHART, "chart_entity"),
          new AuditedEntity(Entity.DASHBOARD_DATA_MODEL, "dashboard_data_model_entity"),
          new AuditedEntity(Entity.PIPELINE, "pipeline_entity"),
          new AuditedEntity(Entity.TOPIC, "topic_entity"),
          new AuditedEntity(Entity.MLMODEL, "ml_model_entity"),
          new AuditedEntity(Entity.CONTAINER, "storage_container_entity"),
          new AuditedEntity(Entity.METRIC, "metric_entity"),
          new AuditedEntity(Entity.QUERY, "query_entity"),
          new AuditedEntity(Entity.USER, "user_entity"),
          new AuditedEntity(Entity.TEAM, "team_entity"),
          new AuditedEntity(Entity.ROLE, "role_entity"));

  private static final String VERSION_PREFIX_BIND = "versionPrefix";

  private CreationAuditMigration() {}

  public static void backfillCreationAudit(
      final Handle handle, final ConnectionType connectionType) {
    int total = 0;
    for (final AuditedEntity entity : AUDITED_ENTITIES) {
      total += backfillEntity(handle, connectionType, entity);
    }
    LOG.info("Backfilled creation audit fields on {} rows across {} entity types", total, size());
  }

  static List<AuditedEntity> auditedEntities() {
    return AUDITED_ENTITIES;
  }

  private static int size() {
    return AUDITED_ENTITIES.size();
  }

  private static int backfillEntity(
      final Handle handle, final ConnectionType connectionType, final AuditedEntity entity) {
    final int fromHistory = backfillFromOldestVersion(handle, connectionType, entity);
    final int fromCurrent = backfillFromCurrentState(handle, connectionType, entity);
    LOG.info(
        "{}: creation audit backfilled from version history for {} rows, from current state for {} rows",
        entity.tableName(),
        fromHistory,
        fromCurrent);
    return fromHistory + fromCurrent;
  }

  private static int backfillFromOldestVersion(
      final Handle handle, final ConnectionType connectionType, final AuditedEntity entity) {
    return handle
        .createUpdate(oldestVersionSql(connectionType, entity.tableName()))
        .bind(VERSION_PREFIX_BIND, EntityUtil.getVersionExtensionPrefix(entity.entityType()) + ".%")
        .execute();
  }

  private static int backfillFromCurrentState(
      final Handle handle, final ConnectionType connectionType, final AuditedEntity entity) {
    return handle.createUpdate(currentStateSql(connectionType, entity.tableName())).execute();
  }

  /**
   * The table name is interpolated because SQL forbids binding an identifier. It is never
   * caller-supplied — every value comes from the {@link #AUDITED_ENTITIES} constant above.
   */
  private static String oldestVersionSql(final ConnectionType connectionType, final String table) {
    return switch (connectionType) {
      case MYSQL -> "UPDATE "
          + table
          + " e JOIN ("
          + "  SELECT ee.id AS id,"
          + "         CAST(JSON_UNQUOTE(JSON_EXTRACT(ee.json, '$.updatedAt')) AS UNSIGNED) AS createdAt,"
          + "         JSON_UNQUOTE(JSON_EXTRACT(ee.json, '$.updatedBy')) AS createdBy,"
          + "         ROW_NUMBER() OVER ("
          + "           PARTITION BY ee.id"
          + "           ORDER BY CAST(JSON_UNQUOTE(JSON_EXTRACT(ee.json, '$.updatedAt')) AS UNSIGNED) ASC"
          + "         ) AS rn"
          + "  FROM entity_extension ee"
          + "  WHERE ee.extension LIKE :"
          + VERSION_PREFIX_BIND
          + "    AND JSON_EXTRACT(ee.json, '$.updatedAt') IS NOT NULL"
          + " ) v ON v.id = e.id AND v.rn = 1"
          + " SET e.json = JSON_SET(e.json, '$.createdAt', v.createdAt, '$.createdBy', COALESCE(v.createdBy, JSON_UNQUOTE(JSON_EXTRACT(e.json, '$.updatedBy'))))"
          + " WHERE "
          + mysqlCreatedAtIsAbsent("e");
      case POSTGRES -> "UPDATE "
          + table
          + " e SET json = jsonb_set("
          + "   jsonb_set(e.json, '{createdAt}', to_jsonb(v.createdAt)),"
          + "   '{createdBy}', to_jsonb(COALESCE(v.createdBy, e.json ->> 'updatedBy', '')))"
          + " FROM ("
          + "  SELECT ee.id AS id,"
          + "         (ee.json ->> 'updatedAt')::bigint AS createdAt,"
          + "         ee.json ->> 'updatedBy' AS createdBy,"
          + "         ROW_NUMBER() OVER ("
          + "           PARTITION BY ee.id"
          + "           ORDER BY (ee.json ->> 'updatedAt')::bigint ASC"
          + "         ) AS rn"
          + "  FROM entity_extension ee"
          + "  WHERE ee.extension LIKE :"
          + VERSION_PREFIX_BIND
          + "    AND ee.json ->> 'updatedAt' IS NOT NULL"
          + " ) v"
          + " WHERE v.id = e.id AND v.rn = 1 AND e.json ->> 'createdAt' IS NULL";
    };
  }

  private static String currentStateSql(final ConnectionType connectionType, final String table) {
    return switch (connectionType) {
      case MYSQL -> "UPDATE "
          + table
          + " e SET e.json = JSON_SET(e.json,"
          + "   '$.createdAt', CAST(JSON_UNQUOTE(JSON_EXTRACT(e.json, '$.updatedAt')) AS UNSIGNED),"
          + "   '$.createdBy', JSON_UNQUOTE(JSON_EXTRACT(e.json, '$.updatedBy')))"
          + " WHERE "
          + mysqlCreatedAtIsAbsent("e")
          + "   AND JSON_EXTRACT(e.json, '$.updatedAt') IS NOT NULL";
      case POSTGRES -> "UPDATE "
          + table
          + " e SET json = jsonb_set("
          + "   jsonb_set(e.json, '{createdAt}', e.json -> 'updatedAt'),"
          + "   '{createdBy}', to_jsonb(COALESCE(e.json ->> 'updatedBy', '')))"
          + " WHERE e.json ->> 'createdAt' IS NULL"
          + "   AND e.json ->> 'updatedAt' IS NOT NULL";
    };
  }

  /**
   * MySQL's JSON_EXTRACT yields SQL NULL for a missing path but a JSON null literal for an explicit
   * {@code "createdAt": null}, so both shapes have to be treated as "not backfilled yet".
   */
  private static String mysqlCreatedAtIsAbsent(final String alias) {
    return "(JSON_EXTRACT("
        + alias
        + ".json, '$.createdAt') IS NULL OR JSON_TYPE(JSON_EXTRACT("
        + alias
        + ".json, '$.createdAt')) = 'NULL')";
  }
}
