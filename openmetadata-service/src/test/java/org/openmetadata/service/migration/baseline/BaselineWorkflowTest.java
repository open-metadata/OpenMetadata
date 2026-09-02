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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.migration.utils.MigrationVersionUtil.BASELINE_VERSION;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.baseline.BaselineWorkflow.BaselineAction;
import org.openmetadata.service.migration.utils.MigrationHistoryTable;

/**
 * Decision-table tests for {@link BaselineWorkflow#resolveAction()} and the {@link
 * BaselineWorkflow#runIfRequired()} flow. The database boundary (existence probes, history reads,
 * execution) is replaced by a canned-state subclass; real-database coverage comes from the baseline
 * integration tests.
 */
class BaselineWorkflowTest {

  @TempDir Path baselineDir;

  private BaselineFiles baselineFiles;

  @BeforeEach
  void createBaselineFiles() throws IOException {
    Path mysqlDir = baselineDir.resolve("mysql");
    Files.createDirectories(mysqlDir);
    Files.writeString(mysqlDir.resolve(BaselineFiles.SCHEMA_FILE), "CREATE TABLE a (id int);");
    baselineFiles = new BaselineFiles(baselineDir.toString(), ConnectionType.MYSQL);
  }

  private FakeDatabaseBaselineWorkflow workflow() {
    return new FakeDatabaseBaselineWorkflow(baselineFiles);
  }

  @Test
  void emptyDatabaseRuns() {
    assertEquals(BaselineAction.RUN, workflow().resolveAction());
  }

  @Test
  void missingBaselineFilesDisables() {
    BaselineFiles absent = new BaselineFiles(baselineDir.toString(), ConnectionType.POSTGRES);
    FakeDatabaseBaselineWorkflow workflow = new FakeDatabaseBaselineWorkflow(absent);
    assertEquals(BaselineAction.DISABLED, workflow.resolveAction());
  }

  @Test
  void missingBaselineFilesFailClearlyForAnEmptyDatabase() {
    BaselineFiles absent = new BaselineFiles(baselineDir.toString(), ConnectionType.POSTGRES);
    FakeDatabaseBaselineWorkflow workflow = new FakeDatabaseBaselineWorkflow(absent);

    IllegalStateException failure =
        assertThrows(IllegalStateException.class, workflow::runIfRequired);

    assertTrue(failure.getMessage().contains("Baseline files not found at"));
    assertTrue(failure.getMessage().contains(absent.directoryPath()));
    assertTrue(failure.getMessage().contains("migrationConfiguration.baselinePath"));
    assertFalse(workflow.executed);
  }

  @Test
  void missingBaselineFilesAreAllowedForAnExistingDatabase() {
    BaselineFiles absent = new BaselineFiles(baselineDir.toString(), ConnectionType.POSTGRES);
    FakeDatabaseBaselineWorkflow workflow = new FakeDatabaseBaselineWorkflow(absent);
    workflow.existingTables.add(MigrationHistoryTable.SERVER_CHANGE_LOG);
    workflow.historyVersions = List.of("2.0.0");

    workflow.runIfRequired();

    assertFalse(workflow.executed);
    assertFalse(workflow.wiped);
  }

  @Test
  void existingMigrationHistorySkips() {
    FakeDatabaseBaselineWorkflow workflow = workflow();
    workflow.existingTables.add(MigrationHistoryTable.SERVER_CHANGE_LOG);
    workflow.historyVersions = List.of("1.13.4", "2.0.0");
    assertEquals(BaselineAction.SKIP, workflow.resolveAction());
  }

  @Test
  void flywayEraDatabaseSkipsSoTheGateCanReject() {
    FakeDatabaseBaselineWorkflow workflow = workflow();
    workflow.existingTables.add(BaselineWorkflow.FLYWAY_HISTORY_TABLE);
    assertEquals(BaselineAction.SKIP, workflow.resolveAction());
  }

  @Test
  void entityTablesWithoutHistoryAborts() {
    FakeDatabaseBaselineWorkflow workflow = workflow();
    workflow.existingTables.add(BaselineWorkflow.SENTINEL_ENTITY_TABLE);
    assertEquals(BaselineAction.ABORT, workflow.resolveAction());
  }

  @Test
  void emptyHistoryTableWithEntityTablesAborts() {
    FakeDatabaseBaselineWorkflow workflow = workflow();
    workflow.existingTables.add(MigrationHistoryTable.SERVER_CHANGE_LOG);
    workflow.existingTables.add(BaselineWorkflow.SENTINEL_ENTITY_TABLE);
    workflow.historyVersions = List.of();
    assertEquals(BaselineAction.ABORT, workflow.resolveAction());
  }

  @Test
  void emptyHistoryTableAloneRuns() {
    FakeDatabaseBaselineWorkflow workflow = workflow();
    workflow.existingTables.add(MigrationHistoryTable.SERVER_CHANGE_LOG);
    workflow.historyVersions = List.of();
    assertEquals(BaselineAction.RUN, workflow.resolveAction());
  }

  @Test
  void startedBaselineOnlyRowResumes() {
    FakeDatabaseBaselineWorkflow workflow = workflow();
    workflow.existingTables.add(MigrationHistoryTable.SERVER_CHANGE_LOG);
    workflow.historyVersions = List.of(BASELINE_VERSION);
    workflow.baselineStarted = true;
    assertEquals(BaselineAction.RESUME, workflow.resolveAction());
  }

  @Test
  void completedBaselineOnlyRowSkips() {
    FakeDatabaseBaselineWorkflow workflow = workflow();
    workflow.existingTables.add(MigrationHistoryTable.SERVER_CHANGE_LOG);
    workflow.historyVersions = List.of(BASELINE_VERSION);
    workflow.baselineStarted = false;
    assertEquals(BaselineAction.SKIP, workflow.resolveAction());
  }

  @Test
  void probeErrorsPropagateAndNeverResolveToRun() {
    FakeDatabaseBaselineWorkflow workflow = workflow();
    workflow.probeFailure = new IllegalStateException("database unreachable");
    assertThrows(IllegalStateException.class, workflow::resolveAction);
  }

  @Test
  void runExecutesWithoutWiping() {
    FakeDatabaseBaselineWorkflow workflow = workflow();
    workflow.runIfRequired();
    assertTrue(workflow.executed);
    assertFalse(workflow.wiped);
  }

  @Test
  void resumeWipesBeforeExecuting() {
    FakeDatabaseBaselineWorkflow workflow = workflow();
    workflow.existingTables.add(MigrationHistoryTable.SERVER_CHANGE_LOG);
    workflow.historyVersions = List.of(BASELINE_VERSION);
    workflow.baselineStarted = true;
    workflow.runIfRequired();
    assertTrue(workflow.wiped);
    assertTrue(workflow.executed);
    assertTrue(workflow.wipeHappenedBeforeExecute);
  }

  @Test
  void resumeRefusesToWipeWhenEntityRowsExist() {
    FakeDatabaseBaselineWorkflow workflow = workflow();
    workflow.existingTables.add(MigrationHistoryTable.SERVER_CHANGE_LOG);
    workflow.existingTables.add(BaselineWorkflow.WIPE_GUARD_TABLES.getFirst());
    workflow.historyVersions = List.of(BASELINE_VERSION);
    workflow.baselineStarted = true;
    workflow.guardTableRows = 42;
    IllegalStateException failure =
        assertThrows(IllegalStateException.class, workflow::runIfRequired);
    assertTrue(failure.getMessage().startsWith(BaselineWorkflow.WIPE_GUARD_ERROR));
    assertFalse(workflow.wiped);
    assertFalse(workflow.executed);
  }

  /** The guard must not depend on which entity table happens to hold the rows. */
  @Test
  void resumeRefusesWhenRowsAreOnlyInALaterGuardTable() {
    FakeDatabaseBaselineWorkflow workflow = workflow();
    workflow.existingTables.add(MigrationHistoryTable.SERVER_CHANGE_LOG);
    workflow.existingTables.add(BaselineWorkflow.WIPE_GUARD_TABLES.getLast());
    workflow.historyVersions = List.of(BASELINE_VERSION);
    workflow.baselineStarted = true;
    workflow.guardTableRows = 7;
    assertThrows(IllegalStateException.class, workflow::runIfRequired);
    assertFalse(workflow.wiped);
  }

  @Test
  void abortStateThrowsWithGuidance() {
    FakeDatabaseBaselineWorkflow workflow = workflow();
    workflow.existingTables.add(BaselineWorkflow.SENTINEL_ENTITY_TABLE);
    IllegalStateException failure =
        assertThrows(IllegalStateException.class, workflow::runIfRequired);
    assertEquals(BaselineWorkflow.INCONSISTENT_STATE_ERROR, failure.getMessage());
  }

  @Test
  void skipDoesNothing() {
    FakeDatabaseBaselineWorkflow skipping = workflow();
    skipping.existingTables.add(MigrationHistoryTable.SERVER_CHANGE_LOG);
    skipping.historyVersions = List.of("1.13.4");
    skipping.runIfRequired();
    assertFalse(skipping.executed);
    assertFalse(skipping.wiped);
  }

  /** Canned-state stand-in for the database boundary; execution is recorded, not performed. */
  private static class FakeDatabaseBaselineWorkflow extends BaselineWorkflow {
    final Set<String> existingTables = new java.util.HashSet<>();
    List<String> historyVersions = List.of();
    boolean baselineStarted;
    int guardTableRows;
    RuntimeException probeFailure;
    boolean executed;
    boolean wiped;
    boolean wipeHappenedBeforeExecute;

    FakeDatabaseBaselineWorkflow(BaselineFiles baselineFiles) {
      super(mockJdbi(), ConnectionType.MYSQL, baselineFiles);
    }

    private static Jdbi mockJdbi() {
      Jdbi jdbi = mock(Jdbi.class);
      when(jdbi.onDemand(MigrationDAO.class)).thenReturn(mock(MigrationDAO.class));
      return jdbi;
    }

    @Override
    boolean tableExists(String tableName) {
      failIfProbeBroken();
      return existingTables.contains(tableName);
    }

    @Override
    List<String> fetchHistoryVersions() {
      failIfProbeBroken();
      return historyVersions;
    }

    @Override
    boolean isBaselineRowStarted() {
      return baselineStarted;
    }

    @Override
    int countRows(String tableName) {
      return guardTableRows;
    }

    @Override
    void execute() {
      wipeHappenedBeforeExecute = wiped && !executed;
      executed = true;
    }

    @Override
    void wipeAllTables() {
      wiped = true;
    }

    private void failIfProbeBroken() {
      if (probeFailure != null) {
        throw probeFailure;
      }
    }
  }
}
