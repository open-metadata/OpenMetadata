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
package org.openmetadata.service.migration.baseline;

import static org.openmetadata.service.migration.utils.MigrationVersionUtil.BASELINE_VERSION;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.json.JSONObject;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationHistoryTable;
import org.openmetadata.service.migration.utils.MigrationHistoryTable.MigrationStatus;
import org.openmetadata.service.migration.utils.MigrationHistoryTable.MigrationType;
import org.openmetadata.service.migration.utils.MigrationHistoryTableUpgrader;

/**
 * Installs the consolidated baseline schema on an empty database, replacing the historical replay
 * of every pre-2.0 migration. Recorded in SERVER_CHANGE_LOG as a single {@code 2.0.0-baseline} row
 * ({@code migrationType=BASELINE}), written {@code STARTED} before any entity DDL and flipped to
 * {@code COMPLETED} at the end so a crash mid-baseline is recognizable and resumable.
 *
 * <p>Every database-state probe is fail-closed: probe errors propagate instead of being read as
 * "fresh database" — a connectivity blip must never route a live database into DDL execution.
 */
@Slf4j
public class BaselineWorkflow {

  /** What to do for the current database state — see {@link #resolveAction()}. */
  public enum BaselineAction {
    /** Empty database: install the baseline. */
    RUN,
    /** Only a STARTED baseline row exists: a prior baseline crashed — wipe and re-install. */
    RESUME,
    /** Real migration history (or a pre-native Flyway database) exists: not our job. */
    SKIP,
    /** Entity tables exist but there is no migration history: refuse to touch anything. */
    ABORT,
    /** No baseline files shipped: baseline installs are not available. */
    DISABLED
  }

  public static final String FLYWAY_HISTORY_TABLE = "DATABASE_CHANGE_LOG";
  static final String SENTINEL_ENTITY_TABLE = "entity_relationship";

  /**
   * Tables checked before the resume wipe. A crashed baseline install cannot have created entity
   * rows, so any row here means the database is something other than what RESUME assumes and must
   * not be dropped. Spread across unrelated entity families so a partially-populated database is
   * caught even when one particular table happens to be empty.
   */
  static final List<String> WIPE_GUARD_TABLES =
      List.of(
          "table_entity",
          "entity_relationship",
          "user_entity",
          "database_entity",
          "dbservice_entity",
          "team_entity");

  static final String COVERED_RANGE = "flyway v000-v015 + native 1.1.0-1.13.4";

  static final String INCONSISTENT_STATE_ERROR =
      "Database contains entity tables but no migration history (SERVER_CHANGE_LOG is missing or"
          + " empty). Refusing to install the baseline over it — restore the database from a"
          + " backup, or drop all tables (`./bootstrap/openmetadata-ops.sh drop-create`) for a"
          + " fresh install.";

  /** Operator-facing; asserted by the crash-resume integration test. */
  public static final String WIPE_GUARD_ERROR =
      "Refusing to resume a crashed baseline install: the database contains entity rows, which a"
          + " baseline install never creates. Restore from a backup instead.";

  private static final String TABLE_EXISTS_MYSQL =
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()"
          + " AND LOWER(table_name) = LOWER(:tableName)";
  private static final String TABLE_EXISTS_POSTGRES =
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema()"
          + " AND LOWER(table_name) = LOWER(:tableName)";

  private final Jdbi jdbi;
  private final ConnectionType connectionType;
  private final MigrationDAO migrationDAO;
  private final BaselineFiles baselineFiles;
  private final MigrationHistoryTableUpgrader historyTableUpgrader;

  public BaselineWorkflow(Jdbi jdbi, ConnectionType connectionType, BaselineFiles baselineFiles) {
    this.jdbi = jdbi;
    this.connectionType = connectionType;
    this.baselineFiles = baselineFiles;
    this.migrationDAO = jdbi.onDemand(MigrationDAO.class);
    this.historyTableUpgrader = new MigrationHistoryTableUpgrader(jdbi, connectionType);
  }

  /** Resolve what the baseline should do for the current database state. Fail-closed. */
  public BaselineAction resolveAction() {
    return baselineFiles.exists() ? resolveDatabaseAction() : BaselineAction.DISABLED;
  }

  public void runIfRequired() {
    BaselineAction action = resolveAction();
    LOG.info("[Baseline] Resolved action: {}", action);
    switch (action) {
      case RUN -> execute();
      case RESUME -> resumeAfterCrash();
      case ABORT -> throw new IllegalStateException(INCONSISTENT_STATE_ERROR);
      case DISABLED -> handleMissingBaselineFiles();
      case SKIP -> LOG.debug("[Baseline] No baseline work to do");
    }
  }

  private BaselineAction resolveDatabaseAction() {
    return !tableExists(MigrationHistoryTable.SERVER_CHANGE_LOG)
        ? resolveActionForEmptyHistory()
        : resolveActionFromHistoryRows();
  }

  private void handleMissingBaselineFiles() {
    switch (resolveDatabaseAction()) {
      case RUN, RESUME -> throw new IllegalStateException(
          "Baseline files not found at "
              + baselineFiles.directoryPath()
              + ", but the database is empty or contains an interrupted baseline install."
              + " Verify migrationConfiguration.baselinePath and the distribution contents.");
      case ABORT -> throw new IllegalStateException(INCONSISTENT_STATE_ERROR);
      case SKIP -> LOG.debug("[Baseline] Existing database does not require baseline files");
      case DISABLED -> throw new IllegalStateException("Unexpected nested disabled baseline state");
    }
  }

  /** Rules for a database with no migration history rows (table missing or empty). */
  private BaselineAction resolveActionForEmptyHistory() {
    BaselineAction result = BaselineAction.RUN;
    if (tableExists(FLYWAY_HISTORY_TABLE)) {
      // Pre-native-era database: the upgrade gate rejects it with a proper message.
      result = BaselineAction.SKIP;
    } else if (tableExists(SENTINEL_ENTITY_TABLE)) {
      result = BaselineAction.ABORT;
    }
    return result;
  }

  private BaselineAction resolveActionFromHistoryRows() {
    List<String> versions = fetchHistoryVersions();
    BaselineAction result;
    if (versions.isEmpty()) {
      result = resolveActionForEmptyHistory();
    } else if (versions.equals(List.of(BASELINE_VERSION))) {
      result = isBaselineRowStarted() ? BaselineAction.RESUME : BaselineAction.SKIP;
    } else {
      result = BaselineAction.SKIP;
    }
    return result;
  }

  void execute() {
    LOG.info("[Baseline] Installing baseline schema from {}", baselineFiles.directoryPath());
    try (Handle handle = jdbi.open()) {
      ensureTrackingTables(handle);
      markBaseline(MigrationStatus.STARTED, 0);
      int statementCount = executeStatements(handle, baselineFiles.schemaStatements(), "schema");
      markBaseline(MigrationStatus.COMPLETED, statementCount);
      LOG.info("[Baseline] Baseline install completed: {} statements", statementCount);
    }
  }

  void resumeAfterCrash() {
    LOG.warn("[Baseline] Resuming a crashed baseline install: wiping and re-installing");
    assertResumeWipeIsSafe();
    wipeAllTables();
    execute();
  }

  private void ensureTrackingTables(Handle handle) {
    handle.execute(MigrationHistoryTable.createServerChangeLogDdl(connectionType));
    handle.execute(MigrationHistoryTable.createSqlLogsDdl());
  }

  private void markBaseline(MigrationStatus status, int statementCount) {
    JSONObject metrics = new JSONObject();
    metrics.put("coveredRange", COVERED_RANGE);
    metrics.put("statements", statementCount);
    migrationDAO.upsertServerMigrationWithStatus(
        BASELINE_VERSION,
        baselineFiles.directoryPath(),
        baselineFiles.contentChecksum(),
        metrics.toString(),
        MigrationType.BASELINE.name(),
        status.name());
  }

  private int executeStatements(Handle handle, List<String> statements, String fileKind) {
    LOG.info("[Baseline] Executing {} {} statements", statements.size(), fileKind);
    for (String statement : statements) {
      handle.execute(statement);
    }
    return statements.size();
  }

  private void assertResumeWipeIsSafe() {
    String populated = firstPopulatedGuardTable();
    if (populated != null) {
      throw new IllegalStateException(WIPE_GUARD_ERROR + " (found rows in " + populated + ")");
    }
  }

  private String firstPopulatedGuardTable() {
    String result = null;
    for (String table : WIPE_GUARD_TABLES) {
      if (result == null && tableExists(table) && countRows(table) > 0) {
        result = table;
      }
    }
    return result;
  }

  /** Adapted from OpenMetadataOperations.dropAllTables — only reachable for a crashed baseline. */
  void wipeAllTables() {
    try (Handle handle = jdbi.open()) {
      if (connectionType == ConnectionType.MYSQL) {
        handle.execute("SET FOREIGN_KEY_CHECKS = 0");
        listAllTables(handle).forEach(table -> handle.execute("DROP TABLE IF EXISTS " + table));
        handle.execute("SET FOREIGN_KEY_CHECKS = 1");
      } else {
        listAllTables(handle)
            .forEach(table -> handle.execute("DROP TABLE IF EXISTS \"" + table + "\" CASCADE"));
      }
    }
  }

  private List<String> listAllTables(Handle handle) {
    String query =
        connectionType == ConnectionType.MYSQL
            ? "SHOW TABLES"
            : "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()";
    return handle.createQuery(query).mapTo(String.class).list();
  }

  boolean tableExists(String tableName) {
    boolean result;
    try (Handle handle = jdbi.open()) {
      String query =
          connectionType == ConnectionType.MYSQL ? TABLE_EXISTS_MYSQL : TABLE_EXISTS_POSTGRES;
      Integer count =
          handle.createQuery(query).bind("tableName", tableName).mapTo(Integer.class).one();
      result = count != null && count > 0;
    }
    return result;
  }

  List<String> fetchHistoryVersions() {
    return migrationDAO.getMigrationVersions();
  }

  /**
   * A history table predating the status column cannot express a mid-flight step, so a baseline row
   * on one is necessarily a completed install. Checking before querying keeps the probe honest —
   * inferring schema from a failed query would be the same fail-open reasoning this class avoids
   * everywhere else.
   */
  boolean isBaselineRowStarted() {
    boolean result = false;
    if (historyTableUpgrader.hasStepColumns()) {
      String status = migrationDAO.getServerMigrationStatus(BASELINE_VERSION);
      result = MigrationStatus.STARTED.name().equals(status);
    }
    return result;
  }

  int countRows(String tableName) {
    int result;
    try (Handle handle = jdbi.open()) {
      result = handle.createQuery("SELECT COUNT(*) FROM " + tableName).mapTo(Integer.class).one();
    }
    return result;
  }
}
