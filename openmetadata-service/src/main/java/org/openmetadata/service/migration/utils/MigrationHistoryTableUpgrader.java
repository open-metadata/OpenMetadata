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
package org.openmetadata.service.migration.utils;

import static org.openmetadata.service.migration.utils.MigrationHistoryTable.MIGRATION_TYPE_COLUMN;
import static org.openmetadata.service.migration.utils.MigrationHistoryTable.SERVER_CHANGE_LOG;
import static org.openmetadata.service.migration.utils.MigrationHistoryTable.STATUS_COLUMN;
import static org.openmetadata.service.migration.utils.MigrationVersionUtil.BASELINE_VERSION;

import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationHistoryTable.MigrationType;

/**
 * Brings an existing SERVER_CHANGE_LOG up to the shape the runner expects, adding the
 * {@code migrationType} and {@code status} columns that turn the history from a bare list of
 * versions into a readable sequence of steps.
 *
 * <p>This lives in the runner rather than in a migration file for two reasons: the runner writes
 * history rows for every version it processes, so the columns have to exist before the first of
 * those writes (a migration could not run early enough), and the conditional "add only if missing"
 * logic belongs in Java — guarded DDL in SQL files is neither portable across both dialects nor
 * allowed by this repo's migration conventions.
 *
 * <p>Runs on the migrate path only; the server's read-only startup validation never calls it.
 */
@Slf4j
public class MigrationHistoryTableUpgrader {

  private static final String COLUMN_EXISTS_MYSQL =
      "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()"
          + " AND LOWER(table_name) = LOWER(:tableName) AND LOWER(column_name) = LOWER(:columnName)";
  private static final String COLUMN_EXISTS_POSTGRES =
      "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = current_schema()"
          + " AND LOWER(table_name) = LOWER(:tableName) AND LOWER(column_name) = LOWER(:columnName)";
  private static final String TABLE_EXISTS_MYSQL =
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()"
          + " AND LOWER(table_name) = LOWER(:tableName)";
  private static final String TABLE_EXISTS_POSTGRES =
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema()"
          + " AND LOWER(table_name) = LOWER(:tableName)";

  private static final String ADD_MIGRATION_TYPE =
      "ALTER TABLE SERVER_CHANGE_LOG ADD COLUMN migrationType VARCHAR(20) NOT NULL DEFAULT 'NATIVE'";
  private static final String ADD_STATUS =
      "ALTER TABLE SERVER_CHANGE_LOG ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED'";

  /** Flyway-era history was imported under synthetic 0.0.N versions. */
  private static final String BACKFILL_FLYWAY_TYPE =
      "UPDATE SERVER_CHANGE_LOG SET migrationType = '" + "FLYWAY' WHERE version LIKE '0.0.%'";

  /** Extension (e.g. Collate) versions carry a suffix, as in 1.12.1-collate. */
  private static final String BACKFILL_EXTENSION_TYPE =
      "UPDATE SERVER_CHANGE_LOG SET migrationType = 'EXTENSION'"
          + " WHERE version LIKE '%-%' AND version <> '"
          + BASELINE_VERSION
          + "'";

  private final Jdbi jdbi;
  private final ConnectionType connectionType;

  public MigrationHistoryTableUpgrader(Jdbi jdbi, ConnectionType connectionType) {
    this.jdbi = jdbi;
    this.connectionType = connectionType;
  }

  /** Add the step-describing columns when an older database is missing them, then classify rows. */
  public void ensureSchema() {
    if (historyTableExists()) {
      boolean addedColumns = addMissingColumns();
      if (addedColumns) {
        backfillMigrationTypes();
      }
    }
  }

  private boolean addMissingColumns() {
    boolean added = false;
    try (Handle handle = jdbi.open()) {
      if (!columnExists(handle, MIGRATION_TYPE_COLUMN)) {
        LOG.info("Adding {}.{} column", SERVER_CHANGE_LOG, MIGRATION_TYPE_COLUMN);
        handle.execute(ADD_MIGRATION_TYPE);
        added = true;
      }
      if (!columnExists(handle, STATUS_COLUMN)) {
        LOG.info("Adding {}.{} column", SERVER_CHANGE_LOG, STATUS_COLUMN);
        handle.execute(ADD_STATUS);
        added = true;
      }
    }
    return added;
  }

  /**
   * Existing rows default to {@code NATIVE}/{@code COMPLETED}; only the two classes of row that are
   * not native migrations need correcting.
   */
  private void backfillMigrationTypes() {
    try (Handle handle = jdbi.open()) {
      int flywayRows = handle.execute(BACKFILL_FLYWAY_TYPE);
      int extensionRows = handle.execute(BACKFILL_EXTENSION_TYPE);
      LOG.info(
          "Classified migration history: {} rows as {}, {} rows as {}",
          flywayRows,
          MigrationType.FLYWAY,
          extensionRows,
          MigrationType.EXTENSION);
    }
  }

  public boolean hasStepColumns() {
    boolean result = false;
    if (historyTableExists()) {
      try (Handle handle = jdbi.open()) {
        result = columnExists(handle, MIGRATION_TYPE_COLUMN) && columnExists(handle, STATUS_COLUMN);
      }
    }
    return result;
  }

  private boolean historyTableExists() {
    boolean result;
    try (Handle handle = jdbi.open()) {
      String query =
          connectionType == ConnectionType.MYSQL ? TABLE_EXISTS_MYSQL : TABLE_EXISTS_POSTGRES;
      Integer count =
          handle.createQuery(query).bind("tableName", SERVER_CHANGE_LOG).mapTo(Integer.class).one();
      result = count != null && count > 0;
    }
    return result;
  }

  private boolean columnExists(Handle handle, String columnName) {
    String query =
        connectionType == ConnectionType.MYSQL ? COLUMN_EXISTS_MYSQL : COLUMN_EXISTS_POSTGRES;
    Integer count =
        handle
            .createQuery(query)
            .bind("tableName", SERVER_CHANGE_LOG)
            .bind("columnName", columnName)
            .mapTo(Integer.class)
            .one();
    return count != null && count > 0;
  }
}
