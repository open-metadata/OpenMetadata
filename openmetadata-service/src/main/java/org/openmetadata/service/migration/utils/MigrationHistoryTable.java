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

import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * The migration history tables (SERVER_CHANGE_LOG and SERVER_MIGRATION_SQL_LOGS) are owned and
 * self-managed by the migration runner — their DDL lives here, not in migration SQL files, so the
 * runner can create or upgrade them before any migration bookkeeping happens.
 *
 * <p>Compared to the legacy shape (created historically by Flyway v000), SERVER_CHANGE_LOG carries
 * two extra columns so the history reads as explicit steps: {@code migrationType} — what kind of
 * step a row is — and {@code status} — whether the step is mid-flight, done, or failed.
 */
public final class MigrationHistoryTable {

  public static final String SERVER_CHANGE_LOG = "SERVER_CHANGE_LOG";
  public static final String SERVER_MIGRATION_SQL_LOGS = "SERVER_MIGRATION_SQL_LOGS";
  public static final String MIGRATION_TYPE_COLUMN = "migrationType";
  public static final String STATUS_COLUMN = "status";

  /** What kind of step a SERVER_CHANGE_LOG row records. */
  public enum MigrationType {
    /** The consolidated baseline install (single row covering all pre-2.0 history). */
    BASELINE,
    /** A native version directory under bootstrap/sql/migrations/native. */
    NATIVE,
    /** An extension (e.g. Collate) version directory. */
    EXTENSION,
    /** Legacy Flyway-era history imported from DATABASE_CHANGE_LOG. */
    FLYWAY
  }

  /** Lifecycle of a step: written STARTED before execution, finalized after. */
  public enum MigrationStatus {
    STARTED,
    COMPLETED,
    FAILED
  }

  private static final String CREATE_SERVER_CHANGE_LOG_MYSQL =
      """
      CREATE TABLE IF NOT EXISTS SERVER_CHANGE_LOG (
          installed_rank BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          version VARCHAR(256) NOT NULL,
          migrationFileName VARCHAR(256) NOT NULL,
          checksum VARCHAR(256) NOT NULL,
          installed_on TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          metrics JSON,
          migrationType VARCHAR(20) NOT NULL DEFAULT 'NATIVE',
          status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
          PRIMARY KEY (version),
          UNIQUE KEY installed_rank (installed_rank)
      )""";

  private static final String CREATE_SERVER_CHANGE_LOG_POSTGRES =
      """
      CREATE TABLE IF NOT EXISTS SERVER_CHANGE_LOG (
          installed_rank SERIAL,
          version VARCHAR(256) PRIMARY KEY,
          migrationFileName VARCHAR(256) NOT NULL,
          checksum VARCHAR(256) NOT NULL,
          installed_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metrics JSONB,
          migrationType VARCHAR(20) NOT NULL DEFAULT 'NATIVE',
          status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED'
      )""";

  private static final String CREATE_SQL_LOGS =
      """
      CREATE TABLE IF NOT EXISTS SERVER_MIGRATION_SQL_LOGS (
          version VARCHAR(256) NOT NULL,
          sqlStatement VARCHAR(10000) NOT NULL,
          checksum VARCHAR(256) PRIMARY KEY,
          executedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )""";

  private MigrationHistoryTable() {}

  public static String createServerChangeLogDdl(ConnectionType connectionType) {
    return connectionType == ConnectionType.MYSQL
        ? CREATE_SERVER_CHANGE_LOG_MYSQL
        : CREATE_SERVER_CHANGE_LOG_POSTGRES;
  }

  /**
   * Unlike the change-log DDL, this one is identical on both dialects — every type and default it
   * uses means the same thing to MySQL and PostgreSQL — so it takes no connection type.
   */
  public static String createSqlLogsDdl() {
    return CREATE_SQL_LOGS;
  }
}
