/*
 *  Copyright 2024 Collate
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
package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.migration.utils.MigrationHistoryTable;
import org.openmetadata.service.migration.utils.MigrationHistoryTable.MigrationStatus;
import org.openmetadata.service.migration.utils.MigrationVersionUtil;

class OpenMetadataOperationsRepairTest {

  private Jdbi jdbi;

  @BeforeEach
  void createHistoryTables() {
    jdbi = Jdbi.create("jdbc:h2:mem:migration-repair;DB_CLOSE_DELAY=-1");
    jdbi.useHandle(
        handle -> {
          handle.execute("DROP ALL OBJECTS");
          handle.execute(
              "CREATE TABLE SERVER_CHANGE_LOG (version VARCHAR(256) PRIMARY KEY, status VARCHAR(32))");
          handle.execute(
              "CREATE TABLE SERVER_MIGRATION_SQL_LOGS (version VARCHAR(256), checksum VARCHAR(256) PRIMARY KEY)");
        });
  }

  @Test
  void repairPreservesAnInterruptedBaselineAndClearsOtherUnfinishedSteps() {
    insertHistory(MigrationVersionUtil.BASELINE_VERSION, MigrationStatus.STARTED);
    insertHistory("2.0.1", MigrationStatus.FAILED);
    insertHistory("2.1.0", MigrationStatus.STARTED);
    insertHistory("2.1.1", MigrationStatus.COMPLETED);

    List<String> repaired = OpenMetadataOperations.repairUnfinishedMigrations(jdbi);

    assertEquals(List.of("2.0.1", "2.1.0"), repaired);
    assertEquals(List.of(MigrationVersionUtil.BASELINE_VERSION, "2.1.1"), versionsInHistoryTable());
    assertEquals(List.of(MigrationVersionUtil.BASELINE_VERSION, "2.1.1"), versionsInSqlLogTable());
  }

  private void insertHistory(String version, MigrationStatus status) {
    jdbi.useHandle(
        handle -> {
          handle
              .createUpdate(
                  "INSERT INTO "
                      + MigrationHistoryTable.SERVER_CHANGE_LOG
                      + " (version, status) VALUES (:version, :status)")
              .bind("version", version)
              .bind("status", status.name())
              .execute();
          handle
              .createUpdate(
                  "INSERT INTO "
                      + MigrationHistoryTable.SERVER_MIGRATION_SQL_LOGS
                      + " (version, checksum) VALUES (:version, :checksum)")
              .bind("version", version)
              .bind("checksum", "checksum-" + version)
              .execute();
        });
  }

  private List<String> versionsInHistoryTable() {
    return versionsIn(MigrationHistoryTable.SERVER_CHANGE_LOG);
  }

  private List<String> versionsInSqlLogTable() {
    return versionsIn(MigrationHistoryTable.SERVER_MIGRATION_SQL_LOGS);
  }

  private List<String> versionsIn(String tableName) {
    return jdbi.withHandle(
        handle ->
            handle
                .createQuery("SELECT version FROM " + tableName + " ORDER BY version")
                .mapTo(String.class)
                .list());
  }
}
