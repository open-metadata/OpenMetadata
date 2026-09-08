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
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.tests.migration.BaselineScratchSupport.GlobalState;
import org.openmetadata.it.tests.migration.BaselineScratchSupport.ScratchDatabase;
import org.openmetadata.service.migration.utils.MigrationHistoryTable.MigrationStatus;
import org.openmetadata.service.migration.utils.MigrationHistoryTable.MigrationType;
import org.openmetadata.service.migration.utils.MigrationVersionUtil;

/**
 * What a fresh install of this release actually leaves behind: one baseline step standing in for
 * all pre-2.0 history, then the live versions applied incrementally on top — with no trace of the
 * migrations the baseline replaced, even though their directories are still on disk and were
 * offered to the runner.
 */
@Isolated
class BaselineFreshInstallIT {

  private static final Set<String> EXPECTED_HISTORY =
      new TreeSet<>(List.of(MigrationVersionUtil.BASELINE_VERSION, "2.0.0", "2.0.1", "2.1.0"));

  @Test
  void freshInstallRecordsBaselineThenLiveVersionsOnly() {
    GlobalState globals = BaselineScratchSupport.captureGlobals();
    try {
      ScratchDatabase database =
          BaselineScratchSupport.createScratchDatabase("baseline_fresh_install");
      installWithFullMigrationTree(database, false);

      Map<String, String[]> history = readHistory(database);
      assertEquals(
          EXPECTED_HISTORY,
          history.keySet(),
          "Fresh install should record exactly the baseline plus the live versions");
      assertEquals(MigrationType.BASELINE.name(), history.get("2.0.0-baseline")[0]);
      assertEquals(MigrationType.NATIVE.name(), history.get("2.0.0")[0]);
      assertEquals(MigrationType.NATIVE.name(), history.get("2.0.1")[0]);
      assertEquals(MigrationType.NATIVE.name(), history.get("2.1.0")[0]);
      history
          .values()
          .forEach(row -> assertEquals(MigrationStatus.COMPLETED.name(), row[1], "step status"));
      assertNoPreTwoZeroStatementsRecorded(database);

      // A second run has nothing left to do, and --force must not resurrect the replaced chain.
      installWithFullMigrationTree(database, false);
      installWithFullMigrationTree(database, true);
      assertEquals(
          EXPECTED_HISTORY,
          readHistory(database).keySet(),
          "Re-running (including with force) must not add pre-2.0 history");
      assertNoPreTwoZeroStatementsRecorded(database);
    } finally {
      BaselineScratchSupport.restoreGlobals(globals);
    }
  }

  /** Deliberately points at the real tree, so every pre-2.0 directory is available to be run. */
  private void installWithFullMigrationTree(ScratchDatabase database, boolean force) {
    BaselineScratchSupport.runMigrations(database, BaselineScratchSupport.realNativePath(), force);
  }

  private Map<String, String[]> readHistory(ScratchDatabase database) {
    Map<String, String[]> result = new TreeMap<>();
    database
        .jdbi()
        .useHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT version, migrationType, status FROM SERVER_CHANGE_LOG ORDER BY version")
                    .map(
                        (rs, ctx) ->
                            new String[] {
                              rs.getString("version"),
                              rs.getString("migrationType"),
                              rs.getString("status")
                            })
                    .list()
                    .forEach(row -> result.put(row[0], new String[] {row[1], row[2]})));
    return result;
  }

  /**
   * The statement log is what makes re-runs cheap; a pre-2.0 version appearing here would mean the
   * floor leaked and statements the baseline already applied were executed again.
   */
  private void assertNoPreTwoZeroStatementsRecorded(ScratchDatabase database) {
    List<String> versions =
        database
            .jdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery("SELECT DISTINCT version FROM SERVER_MIGRATION_SQL_LOGS")
                        .mapTo(String.class)
                        .list());
    List<String> preTwoZero =
        versions.stream().filter(MigrationVersionUtil::isBelowMinimum).sorted().toList();
    assertTrue(preTwoZero.isEmpty(), "Statements recorded for pre-2.0 versions: " + preTwoZero);
  }
}
