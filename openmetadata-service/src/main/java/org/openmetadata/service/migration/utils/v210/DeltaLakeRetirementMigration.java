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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.IdBatches;
import org.openmetadata.service.util.EntityUtil;

/**
 * Retires the removed DeltaLake database connector
 * (ADR:2026-10-13-a-removed-connector-is-retired-in-the-first-data-migration-step). Its services,
 * their databases, schemas, tables and stored procedures, and all of their version snapshots become
 * CustomDatabase, keeping their metadata. A service's connection config is replaced with {@code
 * {"type": "CustomDatabase"}}, so the old metastore password and storage keys are not kept as
 * unmasked extra properties. Its ingestion pipelines are force-deleted through the repository,
 * which also removes their DAGs from the pipeline service; an unreachable one is logged and left.
 *
 * <p>Every retype and delete statement is keyed on {@code 'DeltaLake'} and walks its table in
 * {@link IdBatches}, so a run cut short resumes and a second run changes nothing.
 *
 * <p>The pipeline delete is the one step outside that guarantee. Its ids are read before the
 * retype, the only point a DeltaLake pipeline can be told apart, and the retype commits before the
 * deletes run, so the ids are gone from the database by then. A failing delete therefore only logs
 * rather than aborting the run; a process killed inside the delete loop leaves the remaining
 * pipelines and their DAGs behind for an operator to remove.
 */
@Slf4j
public final class DeltaLakeRetirementMigration {
  private static final String DELTA_LAKE = "DeltaLake";
  private static final String IDS_BIND = "ids";
  private static final String VERSION_PREFIX_BIND = "versionPrefix";

  /** A table whose rows carry a databaseServiceType, with the entity type of its versions. */
  private record ServiceTyped(String entityType, String table) {}

  private static final List<ServiceTyped> SERVICE_TYPED =
      List.of(
          new ServiceTyped(Entity.DATABASE_SERVICE, "dbservice_entity"),
          new ServiceTyped(Entity.DATABASE, "database_entity"),
          new ServiceTyped(Entity.DATABASE_SCHEMA, "database_schema_entity"),
          new ServiceTyped(Entity.TABLE, "table_entity"),
          new ServiceTyped(Entity.STORED_PROCEDURE, "stored_procedure_entity"));

  /** A pipeline belongs to its service only through the service's CONTAINS relationship. */
  private static final String DELTA_LAKE_PIPELINES =
      "SELECT er.toId FROM entity_relationship er "
          + "JOIN dbservice_entity dse ON er.fromId = dse.id "
          + "WHERE dse.serviceType = 'DeltaLake' AND er.fromEntity = 'databaseService' "
          + "AND er.toEntity = 'ingestionPipeline' AND er.relation = "
          + Relationship.CONTAINS.ordinal();

  private DeltaLakeRetirementMigration() {}

  public static void retireDeltaLakeServices(
      final Handle handle,
      final ConnectionType connectionType,
      final PipelineServiceClientInterface pipelineServiceClient) {
    final IngestionPipelineRepository repository =
        (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
    repository.setPipelineServiceClient(pipelineServiceClient);
    retire(
        handle,
        connectionType,
        id -> {
          try {
            repository.forceDelete(Entity.ADMIN_USER_NAME, id);
          } catch (EntityNotFoundException e) {
            // A CONTAINS row can outlive its pipeline; that must not stop the upgrade.
            LOG.info("DeltaLake ingestion pipeline {} is already gone", id);
          }
        });
  }

  /**
   * The pipelines are read before the retype, the only point a DeltaLake one can be told apart,
   * and deleted after it, because the delete reads the pipeline's service.
   */
  static void retire(
      final Handle handle,
      final ConnectionType connectionType,
      final Consumer<UUID> deletePipeline) {
    final List<UUID> pipelines =
        handle.createQuery(DELTA_LAKE_PIPELINES).mapTo(String.class).list().stream()
            .map(UUID::fromString)
            .toList();
    for (final ServiceTyped serviceTyped : SERVICE_TYPED) {
      final int retyped =
          IdBatches.fold(
              handle,
              serviceTyped.table(),
              0,
              (sum, batch) -> sum + retypeBatch(handle, connectionType, serviceTyped, batch));
      LOG.info("{}: retyped {} DeltaLake rows to CustomDatabase", serviceTyped.table(), retyped);
    }
    handle
        .createUpdate("DELETE FROM test_connection_definition WHERE name = :name")
        .bind("name", DELTA_LAKE)
        .execute();
    IdBatches.fold(
        handle,
        "automations_workflow",
        0,
        (sum, batch) ->
            sum
                + handle
                    .createUpdate(
                        "DELETE FROM automations_workflow WHERE id IN (<ids>) AND "
                            + isDeltaLakeWorkflow(connectionType))
                    .bindList(IDS_BIND, batch)
                    .execute());
    pipelines.forEach(pipeline -> deleteOrWarn(deletePipeline, pipeline));
    LOG.info("Deleted {} DeltaLake ingestion pipelines", pipelines.size());
  }

  /**
   * The retype has already committed by now, so a DeltaLake pipeline's id is no longer recoverable
   * from the database. Aborting on one failure would leave every later pipeline in the run
   * undeletable, so the failure is logged with the id an operator has to clean up by hand.
   */
  private static void deleteOrWarn(final Consumer<UUID> deletePipeline, final UUID pipeline) {
    try {
      deletePipeline.accept(pipeline);
    } catch (Exception e) {
      LOG.error(
          "DeltaLake ingestion pipeline {} could not be deleted; remove its DAG by hand",
          pipeline,
          e);
    }
  }

  /** Version snapshots go first: re-running after an interruption still finds their entity. */
  private static int retypeBatch(
      final Handle handle,
      final ConnectionType connectionType,
      final ServiceTyped serviceTyped,
      final List<String> batch) {
    final List<String> ids =
        handle
            .createQuery(
                "SELECT id FROM "
                    + serviceTyped.table()
                    + " WHERE id IN (<ids>) AND "
                    + isDeltaLake(connectionType))
            .bindList(IDS_BIND, batch)
            .mapTo(String.class)
            .list();
    if (nullOrEmpty(ids)) {
      return 0;
    }
    handle
        .createUpdate(
            "UPDATE entity_extension SET json = "
                + retyped(connectionType)
                + " WHERE id IN (<ids>) AND extension LIKE :versionPrefix")
        .bindList(IDS_BIND, ids)
        .bind(
            VERSION_PREFIX_BIND,
            EntityUtil.getVersionExtensionPrefix(serviceTyped.entityType()) + ".%")
        .execute();
    return handle
        .createUpdate(
            "UPDATE "
                + serviceTyped.table()
                + " SET json = "
                + retyped(connectionType)
                + " WHERE id IN (<ids>)")
        .bindList(IDS_BIND, ids)
        .execute();
  }

  private static String isDeltaLake(final ConnectionType connectionType) {
    return connectionType == ConnectionType.MYSQL
        ? "JSON_UNQUOTE(JSON_EXTRACT(json, '$.serviceType')) = 'DeltaLake'"
        : "json ->> 'serviceType' = 'DeltaLake'";
  }

  private static String isDeltaLakeWorkflow(final ConnectionType connectionType) {
    return connectionType == ConnectionType.MYSQL
        ? "JSON_UNQUOTE(JSON_EXTRACT(json, '$.request.connectionType')) = 'DeltaLake'"
        : "json -> 'request' ->> 'connectionType' = 'DeltaLake'";
  }

  /** Only a service has a connection; on any other row the config path is absent and left so. */
  private static String retyped(final ConnectionType connectionType) {
    return connectionType == ConnectionType.MYSQL
        ? "JSON_SET(json, '$.serviceType', 'CustomDatabase', "
            + "'$.connection.config', JSON_OBJECT('type', 'CustomDatabase'))"
        : "jsonb_set(jsonb_set(json, '{serviceType}', '\"CustomDatabase\"'), "
            + "'{connection,config}', '{\"type\": \"CustomDatabase\"}')";
  }
}
