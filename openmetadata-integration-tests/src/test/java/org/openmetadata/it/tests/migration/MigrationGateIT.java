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
package org.openmetadata.it.tests.migration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.tests.migration.BaselineScratchSupport.ScratchDatabase;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.api.MigrationWorkflow;
import org.openmetadata.service.migration.utils.MigrationHistoryTable;
import org.openmetadata.service.migration.utils.MigrationVersionUtil;

/**
 * The upgrade gate: this release refuses to migrate a database that has not been through 2.0.
 *
 * <p>Each case fabricates just the migration history a given database age would have, rather than
 * running the chain to get there — the gate reads nothing else, and a 1.13 install takes minutes to
 * reproduce for a check that is decided by one row.
 */
@Isolated
class MigrationGateIT {

  private static final String LEGACY_HISTORY_DDL_MYSQL =
      """
      CREATE TABLE IF NOT EXISTS SERVER_CHANGE_LOG (
          installed_rank BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          version VARCHAR(256) NOT NULL,
          migrationFileName VARCHAR(256) NOT NULL,
          checksum VARCHAR(256) NOT NULL,
          installed_on TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          metrics JSON,
          PRIMARY KEY (version),
          UNIQUE KEY installed_rank (installed_rank)
      )""";
  private static final String LEGACY_HISTORY_DDL_POSTGRES =
      """
      CREATE TABLE IF NOT EXISTS SERVER_CHANGE_LOG (
          installed_rank SERIAL,
          version VARCHAR(256) PRIMARY KEY,
          migrationFileName VARCHAR(256) NOT NULL,
          checksum VARCHAR(256) NOT NULL,
          installed_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metrics JSONB
      )""";

  @Test
  void refusesToMigrateAPreTwoZeroDatabase() {
    ScratchDatabase database = databaseWithLegacyHistory("gate_pre_two_zero", "1.13.4");
    IllegalStateException failure =
        assertThrows(IllegalStateException.class, () -> loadMigrations(database, false));
    assertTrue(
        failure.getMessage().contains(MigrationVersionUtil.MINIMUM_SUPPORTED_MIGRATION_VERSION),
        "Gate message should name the required version: " + failure.getMessage());
  }

  @Test
  void forceDoesNotBypassTheGate() {
    ScratchDatabase database = databaseWithLegacyHistory("gate_force", "1.13.4");
    assertThrows(IllegalStateException.class, () -> loadMigrations(database, true));
  }

  @Test
  void refusesToMigrateAFlywayEraDatabase() {
    ScratchDatabase database = BaselineScratchSupport.createScratchDatabase("gate_flyway_era");
    database.jdbi().useHandle(handle -> handle.execute(legacyHistoryDdl()));
    database
        .jdbi()
        .useHandle(
            handle ->
                handle.execute(
                    "CREATE TABLE IF NOT EXISTS "
                        + quoted("DATABASE_CHANGE_LOG")
                        + " (version VARCHAR(64))"));
    assertThrows(IllegalStateException.class, () -> loadMigrations(database, false));
  }

  @Test
  void allowsADatabaseAlreadyOnTwoZero() {
    ScratchDatabase database = databaseWithLegacyHistory("gate_two_zero", "2.0.0");
    List<String> pending = loadMigrations(database, false);
    assertTrue(pending.contains("2.1.0"), "2.1.0 should still be pending, got " + pending);
  }

  /**
   * A database carrying only the baseline row is a fresh 2.1 install, not an old one: the gate must
   * let it through even though nothing resembling a released version has been applied.
   */
  @Test
  void allowsABaselineOnlyDatabase() {
    ScratchDatabase database = BaselineScratchSupport.createScratchDatabase("gate_baseline_only");
    database.jdbi().useHandle(handle -> handle.execute(legacyHistoryDdl()));
    insertHistoryRow(database.jdbi(), MigrationVersionUtil.BASELINE_VERSION);
    List<String> pending = loadMigrations(database, false);
    assertTrue(pending.contains("2.0.0"), "2.0.0 should be pending, got " + pending);
  }

  /** Pre-2.0 versions must never be offered once the baseline stands in for them. */
  @Test
  void baselineManagedDatabaseNeverSeesPreTwoZeroVersions() {
    ScratchDatabase database =
        BaselineScratchSupport.createScratchDatabase("gate_floor_under_force");
    database.jdbi().useHandle(handle -> handle.execute(legacyHistoryDdl()));
    insertHistoryRow(database.jdbi(), MigrationVersionUtil.BASELINE_VERSION);
    List<String> pending = loadMigrations(database, true);
    List<String> preTwoZero =
        pending.stream().filter(MigrationVersionUtil::isBelowMinimum).toList();
    assertEquals(List.of(), preTwoZero, "Force must not replay migrations the baseline covers");
  }

  private ScratchDatabase databaseWithLegacyHistory(String name, String version) {
    ScratchDatabase database = BaselineScratchSupport.createScratchDatabase(name);
    database.jdbi().useHandle(handle -> handle.execute(legacyHistoryDdl()));
    insertHistoryRow(database.jdbi(), version);
    return database;
  }

  private void insertHistoryRow(Jdbi jdbi, String version) {
    jdbi.useHandle(
        handle ->
            handle
                .createUpdate(
                    "INSERT INTO "
                        + MigrationHistoryTable.SERVER_CHANGE_LOG
                        + " (version, migrationFileName, checksum) VALUES (:version, :file, :checksum)")
                .bind("version", version)
                .bind("file", "test")
                .bind("checksum", "test")
                .execute());
  }

  /**
   * Deliberately the pre-upgrade table shape: these databases predate the migrationType/status
   * columns, so this also exercises the runner reading history it has not upgraded yet.
   */
  private String legacyHistoryDdl() {
    return BaselineScratchSupport.currentConnectionType() == ConnectionType.MYSQL
        ? LEGACY_HISTORY_DDL_MYSQL
        : LEGACY_HISTORY_DDL_POSTGRES;
  }

  private String quoted(String identifier) {
    return BaselineScratchSupport.currentConnectionType() == ConnectionType.MYSQL
        ? identifier
        : "\"" + identifier + "\"";
  }

  /** Loads (never runs) migrations against the scratch database, returning the pending versions. */
  private List<String> loadMigrations(ScratchDatabase database, boolean force) {
    MigrationWorkflow workflow =
        new MigrationWorkflow(
            database.jdbi(),
            BaselineScratchSupport.realNativePath(),
            BaselineScratchSupport.currentConnectionType(),
            "",
            BaselineScratchSupport.scratchConfig(database),
            force);
    workflow.loadMigrations();
    return workflow.getPendingVersions();
  }
}
