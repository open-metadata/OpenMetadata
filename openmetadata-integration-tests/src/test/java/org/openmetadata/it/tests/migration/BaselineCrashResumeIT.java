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
import java.util.Locale;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.tests.migration.BaselineScratchSupport.ScratchDatabase;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.baseline.BaselineFiles;
import org.openmetadata.service.migration.baseline.BaselineWorkflow;
import org.openmetadata.service.migration.baseline.BaselineWorkflow.BaselineAction;
import org.openmetadata.service.migration.utils.MigrationHistoryTable;
import org.openmetadata.service.migration.utils.MigrationHistoryTable.MigrationStatus;
import org.openmetadata.service.migration.utils.MigrationVersionUtil;

/**
 * A baseline install that dies partway leaves a half-built schema and a {@code STARTED} history
 * row. Recovering means dropping what was created and starting over, so these exercise the one
 * code path in the migration runner that destroys data — against a real database rather than the
 * canned-state fake the unit tests use.
 */
@Isolated
class BaselineCrashResumeIT {

  /** Enough statements to leave tables behind, few enough to leave the schema incomplete. */
  private static final int STATEMENTS_BEFORE_CRASH = 25;

  @Test
  void resumeWipesTheHalfBuiltSchemaAndCompletes() {
    ScratchDatabase database = BaselineScratchSupport.createScratchDatabase("baseline_crash");
    BaselineWorkflow workflow = crashedBaseline(database);

    assertEquals(
        BaselineAction.RESUME, workflow.resolveAction(), "a STARTED baseline row means RESUME");
    workflow.runIfRequired();

    assertEquals(
        MigrationStatus.COMPLETED.name(),
        baselineRowStatus(database),
        "resume should finish the install");
    assertEquals(
        List.of(MigrationVersionUtil.BASELINE_VERSION),
        historyVersions(database),
        "resume must not duplicate the baseline row");
    assertTrue(
        tableCount(database) > STATEMENTS_BEFORE_CRASH,
        "the full schema should be present, not just the pre-crash fragment");
    assertEquals(
        BaselineAction.SKIP, workflow.resolveAction(), "a completed baseline is not re-run");
  }

  /**
   * The wipe is only safe because a crashed baseline cannot have produced entity rows. If any are
   * present the database is something else — an operator pointing at the wrong one, a restore gone
   * sideways — and dropping every table would destroy it.
   */
  @Test
  void resumeRefusesToWipeADatabaseThatHasEntityRows() {
    ScratchDatabase database = BaselineScratchSupport.createScratchDatabase("baseline_crash_guard");
    BaselineWorkflow workflow = crashedBaseline(database);
    createGuardTable(database);
    insertEntityRelationshipRow(database);

    IllegalStateException failure =
        assertThrows(IllegalStateException.class, workflow::runIfRequired);
    assertTrue(
        failure.getMessage().startsWith(BaselineWorkflow.WIPE_GUARD_ERROR),
        "should refuse with the wipe-guard message, got: " + failure.getMessage());
    assertTrue(tableExists(database, "entity_relationship"), "nothing should have been dropped");
    assertEquals(MigrationStatus.STARTED.name(), baselineRowStatus(database));
  }

  /** Installs part of the baseline and marks it STARTED, the state a crash would leave behind. */
  private BaselineWorkflow crashedBaseline(ScratchDatabase database) {
    ConnectionType connectionType = BaselineScratchSupport.currentConnectionType();
    BaselineFiles baselineFiles =
        new BaselineFiles(
            BaselineScratchSupport.committedBaselineRoot().toString(), connectionType);
    BaselineWorkflow workflow =
        new BaselineWorkflow(database.jdbi(), connectionType, baselineFiles);

    List<String> statements = baselineFiles.schemaStatements();
    database
        .jdbi()
        .useHandle(
            handle -> {
              handle.execute(MigrationHistoryTable.createServerChangeLogDdl(connectionType));
              handle.execute(MigrationHistoryTable.createSqlLogsDdl());
              statements.stream().limit(STATEMENTS_BEFORE_CRASH).forEach(handle::execute);
              handle
                  .createUpdate(
                      "INSERT INTO SERVER_CHANGE_LOG"
                          + " (version, migrationFileName, checksum, migrationType, status)"
                          + " VALUES (:version, 'baseline', 'crash', 'BASELINE', 'STARTED')")
                  .bind("version", MigrationVersionUtil.BASELINE_VERSION)
                  .execute();
            });
    return workflow;
  }

  /** The guard table is not guaranteed to be inside the pre-crash fragment, so create it. */
  private void createGuardTable(ScratchDatabase database) {
    BaselineFiles baselineFiles =
        new BaselineFiles(
            BaselineScratchSupport.committedBaselineRoot().toString(),
            BaselineScratchSupport.currentConnectionType());
    String createStatement =
        baselineFiles.schemaStatements().stream()
            .filter(statement -> statement.toLowerCase(Locale.ROOT).contains("create table"))
            .filter(statement -> statement.toLowerCase(Locale.ROOT).contains("entity_relationship"))
            .findFirst()
            .orElseThrow(() -> new IllegalStateException("baseline has no entity_relationship"));
    database.jdbi().useHandle(handle -> handle.execute(createStatement));
  }

  private void insertEntityRelationshipRow(ScratchDatabase database) {
    database
        .jdbi()
        .useHandle(
            handle ->
                handle.execute(
                    "INSERT INTO entity_relationship"
                        + " (fromId, toId, fromEntity, toEntity, relation, relationType)"
                        + " VALUES ('11111111-1111-1111-1111-111111111111',"
                        + " '22222222-2222-2222-2222-222222222222', 'table', 'database', 1, '')"));
  }

  private String baselineRowStatus(ScratchDatabase database) {
    return database
        .jdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT status FROM SERVER_CHANGE_LOG WHERE version = :version")
                    .bind("version", MigrationVersionUtil.BASELINE_VERSION)
                    .mapTo(String.class)
                    .one());
  }

  private List<String> historyVersions(ScratchDatabase database) {
    return database
        .jdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT version FROM SERVER_CHANGE_LOG ORDER BY version")
                    .mapTo(String.class)
                    .list());
  }

  private int tableCount(ScratchDatabase database) {
    String query =
        BaselineScratchSupport.currentConnectionType() == ConnectionType.MYSQL
            ? "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()"
            : "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema()";
    return database
        .jdbi()
        .withHandle(handle -> handle.createQuery(query).mapTo(Integer.class).one());
  }

  private boolean tableExists(ScratchDatabase database, String tableName) {
    String query =
        BaselineScratchSupport.currentConnectionType() == ConnectionType.MYSQL
            ? "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()"
                + " AND LOWER(table_name) = LOWER(:tableName)"
            : "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema()"
                + " AND LOWER(table_name) = LOWER(:tableName)";
    return database
            .jdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery(query)
                        .bind("tableName", tableName)
                        .mapTo(Integer.class)
                        .one())
        > 0;
  }
}
