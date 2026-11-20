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

import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.IdBatches;

/**
 * Removes {@code databaseSchema} from saved Unity Catalog Test Connection requests. The Unity
 * Catalog connection no longer has the field
 * (ADR:2026-11-19-unity-catalog-connections-have-no-database-schema), so a request still carrying
 * it no longer loads, and Data Retention could never delete it. The 2.1.0 SQL repairs services and
 * their version snapshots. Nothing indexes a request's connection type, so {@code
 * automations_workflow}, which grows with every Test Connection, query runner and reverse
 * ingestion run, is walked in id batches (ADR:2026-10-09-data-migration-backfills-walk-ids-in-batches).
 * Idempotent: a batch without such a request changes nothing.
 */
@Slf4j
public final class UnityCatalogDatabaseSchemaMigration {
  public static final String STEP_NAME =
      "removeUnityCatalogDatabaseSchemaFromTestConnectionRequests";
  private static final String TABLE = "automations_workflow";
  private static final String IDS_BIND = "ids";

  private UnityCatalogDatabaseSchemaMigration() {}

  public static int removeFromTestConnectionRequests(
      final Handle handle, final ConnectionType connectionType) {
    final String update = updateBatch(connectionType);
    final int repaired =
        IdBatches.fold(
            handle,
            TABLE,
            0,
            (sum, batch) -> sum + handle.createUpdate(update).bindList(IDS_BIND, batch).execute());
    LOG.info(
        "Removed databaseSchema from {} saved Unity Catalog Test Connection request(s)", repaired);
    return repaired;
  }

  private static String updateBatch(final ConnectionType connectionType) {
    return switch (connectionType) {
      case MYSQL -> "UPDATE automations_workflow"
          + " SET json = JSON_REMOVE(json, '$.request.connection.config.databaseSchema')"
          + " WHERE id IN (<ids>)"
          + " AND JSON_UNQUOTE(JSON_EXTRACT(json, '$.request.connectionType')) = 'UnityCatalog'"
          + " AND JSON_CONTAINS_PATH(json, 'one', '$.request.connection.config.databaseSchema')";
      case POSTGRES -> "UPDATE automations_workflow"
          + " SET json = json #- '{request,connection,config,databaseSchema}'"
          + " WHERE id IN (<ids>)"
          + " AND json -> 'request' ->> 'connectionType' = 'UnityCatalog'"
          + " AND jsonb_exists(json -> 'request' -> 'connection' -> 'config', 'databaseSchema')";
    };
  }
}
