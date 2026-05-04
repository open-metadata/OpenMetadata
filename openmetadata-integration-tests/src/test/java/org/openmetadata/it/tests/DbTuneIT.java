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
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.util.dbtune.AutoTuner;
import org.openmetadata.service.util.dbtune.DbTuneResult;
import org.openmetadata.service.util.dbtune.MysqlAutoTuner;
import org.openmetadata.service.util.dbtune.PostgresAutoTuner;
import org.openmetadata.service.util.dbtune.TableRecommendation;

/**
 * End-to-end tests for {@link AutoTuner} against the live Testcontainers database. The bootstrap
 * runs every migration up to the current version, so the tracked entity tables (e.g.
 * {@code storage_container_entity}) exist; we exercise the analyze → apply → analyze-one path
 * against the real schema and reset the modified reloptions / table options at the end.
 *
 * <p>Sequential because each test mutates table-level reloptions on shared production tables;
 * parallel execution would race between read-stats and apply.
 */
class DbTuneIT {

  private static final String TEST_TABLE = "storage_container_entity";

  @Test
  void analyzeReturnsRecommendationsForKnownTables() {
    AutoTuner tuner = currentTuner();
    Jdbi jdbi = TestSuiteBootstrap.getJdbi();

    DbTuneResult result = jdbi.withHandle(tuner::analyze);

    assertNotNull(result);
    assertNotNull(result.engineVersion());
    assertFalse(result.tableRecommendations().isEmpty(), "Expected at least one recommendation");
    assertTrue(
        result.tableRecommendations().stream().anyMatch(r -> TEST_TABLE.equals(r.tableName())),
        "storage_container_entity should be in the recommendations");
  }

  @Test
  void applyChangesReloptionsAndIsIdempotent() {
    AutoTuner tuner = currentTuner();
    Jdbi jdbi = TestSuiteBootstrap.getJdbi();
    ConnectionType connType = currentConnectionType();
    TableRecommendation rec = recommendationFor(tuner, jdbi, TEST_TABLE);

    try {
      jdbi.useHandle(handle -> tuner.apply(handle, rec));
      Map<String, String> after = currentSettingsFor(tuner, jdbi, TEST_TABLE);
      assertSettingsMatch(rec.recommendedSettings(), after);

      // Apply twice — must be a no-op
      jdbi.useHandle(handle -> tuner.apply(handle, rec));
      Map<String, String> afterSecond = currentSettingsFor(tuner, jdbi, TEST_TABLE);
      assertEquals(after, afterSecond, "Apply should be idempotent");
    } finally {
      resetTableSettings(jdbi, TEST_TABLE, connType, rec.recommendedSettings().keySet());
    }
  }

  @Test
  void analyzeOneRunsWithoutError() {
    AutoTuner tuner = currentTuner();
    Jdbi jdbi = TestSuiteBootstrap.getJdbi();

    jdbi.useHandle(handle -> tuner.analyzeOne(handle, TEST_TABLE));
  }

  @Test
  void dryRunDoesNotMutateReloptions() {
    AutoTuner tuner = currentTuner();
    Jdbi jdbi = TestSuiteBootstrap.getJdbi();

    Map<String, String> before = currentSettingsFor(tuner, jdbi, TEST_TABLE);

    DbTuneResult result = jdbi.withHandle(tuner::analyze);
    assertNotNull(result);

    Map<String, String> after = currentSettingsFor(tuner, jdbi, TEST_TABLE);
    assertEquals(before, after, "Analyze (dry-run) must not change table settings");
  }

  // ---- helpers ----

  private AutoTuner currentTuner() {
    return currentConnectionType() == ConnectionType.POSTGRES
        ? new PostgresAutoTuner()
        : new MysqlAutoTuner();
  }

  private ConnectionType currentConnectionType() {
    return "mysql".equalsIgnoreCase(System.getProperty("databaseType", "postgres"))
        ? ConnectionType.MYSQL
        : ConnectionType.POSTGRES;
  }

  private TableRecommendation recommendationFor(
      final AutoTuner tuner, final Jdbi jdbi, final String tableName) {
    return jdbi.withHandle(tuner::analyze).tableRecommendations().stream()
        .filter(r -> tableName.equals(r.tableName()))
        .findFirst()
        .orElseThrow(() -> new IllegalStateException("No recommendation for " + tableName));
  }

  /**
   * Re-runs analyze and projects out the {@link TableRecommendation#currentSettings()} for the
   * named table. Going through the same code path that built the original recommendation keeps the
   * assertion stable across either dialect's parsing rules.
   */
  private Map<String, String> currentSettingsFor(
      final AutoTuner tuner, final Jdbi jdbi, final String tableName) {
    return jdbi.withHandle(tuner::analyze).tableRecommendations().stream()
        .filter(r -> tableName.equals(r.tableName()))
        .findFirst()
        .map(TableRecommendation::currentSettings)
        .orElse(Map.of());
  }

  private void assertSettingsMatch(
      final Map<String, String> expected, final Map<String, String> actual) {
    for (Map.Entry<String, String> e : expected.entrySet()) {
      String got = actual.get(e.getKey());
      assertNotNull(got, "Missing setting after apply: " + e.getKey());
      assertEquals(
          Double.parseDouble(e.getValue()),
          Double.parseDouble(got),
          0.0,
          "Setting "
              + e.getKey()
              + " did not take effect (expected "
              + e.getValue()
              + ", got "
              + got
              + ")");
    }
  }

  private void resetTableSettings(
      final Jdbi jdbi,
      final String tableName,
      final ConnectionType connType,
      final Set<String> keys) {
    if (keys.isEmpty()) {
      return;
    }
    jdbi.useHandle(
        handle -> {
          if (connType == ConnectionType.POSTGRES) {
            String resetList = String.join(", ", keys);
            handle.execute("ALTER TABLE \"" + tableName + "\" RESET (" + resetList + ")");
          } else {
            String resetList =
                keys.stream().map(k -> k + "=DEFAULT").collect(Collectors.joining(", "));
            handle.execute("ALTER TABLE `" + tableName + "` " + resetList);
          }
        });
  }
}
