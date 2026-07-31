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
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.util.dbtune.Action;
import org.openmetadata.service.util.dbtune.AutoTuner;
import org.openmetadata.service.util.dbtune.DbTuneDiagnosis;
import org.openmetadata.service.util.dbtune.DbTuneResult;
import org.openmetadata.service.util.dbtune.Diagnostic;
import org.openmetadata.service.util.dbtune.MysqlAutoTuner;
import org.openmetadata.service.util.dbtune.MysqlDiagnostic;
import org.openmetadata.service.util.dbtune.PostgresAutoTuner;
import org.openmetadata.service.util.dbtune.PostgresDiagnostic;
import org.openmetadata.service.util.dbtune.TableRecommendation;

/**
 * End-to-end tests for {@link AutoTuner} against the live Testcontainers database.
 *
 * <p>The read-only tests ({@link #analyzeReturnsRecommendationsForKnownTables}, {@link
 * #dryRunDoesNotMutateReloptions}) run against the real catalog tables that the IT bootstrap
 * created via migrations.
 *
 * <p>Tests that exercise the write path ({@link #applyExecutesAndIsIdempotent}, {@link
 * #analyzeOneRunsOnIsolatedTable}) deliberately use a private throwaway table — never a real
 * catalog table. Reason: {@code ALTER TABLE} on a shared production table bumps MySQL's per-table
 * metadata version, which invalidates JDBC prepared-statement caches across the whole
 * Testcontainer. When that table has a {@code JSON} column (e.g. {@code entity_relationship}), the
 * driver's re-prepared metadata sometimes returns the column type as {@code VARBINARY}, and
 * subsequent {@code INSERT} statements fail with {@code "Cannot create a JSON value from a string
 * with CHARACTER SET 'binary'"}. We saw this break {@code GlossaryTermRelationsIT},
 * {@code DomainResourceIT}, and the lineage ITs in CI when an earlier version of this test applied
 * settings to {@code entity_relationship}. The recommendations themselves are sound — the IT just
 * cannot afford the side effect on a shared DB.
 *
 * <p>Sequential because {@code @BeforeEach} / {@code @AfterEach} create and drop the same isolated
 * table by name; concurrent execution would race.
 */
@Execution(ExecutionMode.SAME_THREAD)
class DbTuneIT {

  /** Table created and dropped per test — never a catalog table. Safe blast radius. */
  private static final String ISOLATED_TABLE = "dbtune_it_isolated_table";

  /** A real catalog table used only by the read-only tests to assert against the live schema. */
  private static final String READ_ONLY_PROBE_TABLE = "entity_relationship";

  @BeforeEach
  void createIsolatedTable() {
    Jdbi jdbi = TestSuiteBootstrap.getJdbi();
    ConnectionType connType = currentConnectionType();
    jdbi.useHandle(
        handle -> {
          handle.execute("DROP TABLE IF EXISTS " + quoteIdent(connType, ISOLATED_TABLE));
          if (connType == ConnectionType.POSTGRES) {
            handle.execute(
                "CREATE TABLE " + quoteIdent(connType, ISOLATED_TABLE) + " (id INT PRIMARY KEY)");
          } else {
            handle.execute(
                "CREATE TABLE "
                    + quoteIdent(connType, ISOLATED_TABLE)
                    + " (id INT PRIMARY KEY) ENGINE=InnoDB");
          }
        });
  }

  @AfterEach
  void dropIsolatedTable() {
    Jdbi jdbi = TestSuiteBootstrap.getJdbi();
    ConnectionType connType = currentConnectionType();
    jdbi.useHandle(
        handle -> handle.execute("DROP TABLE IF EXISTS " + quoteIdent(connType, ISOLATED_TABLE)));
  }

  @Test
  void analyzeReturnsRecommendationsForKnownTables() {
    AutoTuner tuner = currentTuner();
    Jdbi jdbi = TestSuiteBootstrap.getJdbi();

    DbTuneResult result = jdbi.withHandle(tuner::analyze);

    assertNotNull(result);
    assertNotNull(result.engineVersion());
    assertFalse(result.tableRecommendations().isEmpty(), "Expected at least one recommendation");
    assertTrue(
        result.tableRecommendations().stream()
            .anyMatch(r -> READ_ONLY_PROBE_TABLE.equals(r.tableName())),
        READ_ONLY_PROBE_TABLE + " should be in the recommendations");
  }

  @Test
  void applyExecutesAndIsIdempotent() {
    AutoTuner tuner = currentTuner();
    Jdbi jdbi = TestSuiteBootstrap.getJdbi();
    ConnectionType connType = currentConnectionType();
    TableRecommendation rec = recommendationForIsolatedTable(connType);

    String built = tuner.buildAlterStatement(rec);
    assertTrue(built.contains(ISOLATED_TABLE), "ALTER target table mismatch: " + built);

    jdbi.useHandle(handle -> tuner.apply(handle, rec));
    Map<String, String> after =
        jdbi.withHandle(handle -> tuner.currentSettingsForTable(handle, ISOLATED_TABLE));
    assertSettingsPersisted(rec.recommendedSettings(), after);

    // Apply a second time — must be idempotent (no exception, no value drift).
    jdbi.useHandle(handle -> tuner.apply(handle, rec));
    Map<String, String> afterSecond =
        jdbi.withHandle(handle -> tuner.currentSettingsForTable(handle, ISOLATED_TABLE));
    assertEquals(after, afterSecond, "Apply should be idempotent");
  }

  private void assertSettingsPersisted(
      final Map<String, String> expected, final Map<String, String> actual) {
    for (Map.Entry<String, String> e : expected.entrySet()) {
      String key = e.getKey();
      // Postgres lowercases reloption keys; MySQL uppercases STATS_*. Look up case-insensitively.
      String got =
          actual.entrySet().stream()
              .filter(a -> a.getKey().equalsIgnoreCase(key))
              .map(Map.Entry::getValue)
              .findFirst()
              .orElse(null);
      assertNotNull(got, "Missing setting after apply: " + key + " (got " + actual + ")");
      assertEquals(
          Double.parseDouble(e.getValue()),
          Double.parseDouble(got),
          0.0,
          "Setting " + key + " did not take effect: expected " + e.getValue() + ", got " + got);
    }
  }

  @Test
  void analyzeOneRunsOnIsolatedTable() {
    AutoTuner tuner = currentTuner();
    Jdbi jdbi = TestSuiteBootstrap.getJdbi();

    jdbi.useHandle(handle -> tuner.analyzeOne(handle, ISOLATED_TABLE));
  }

  @Test
  void diagnoseCompletesWithoutErrorAndReturnsStructuredResult() {
    Diagnostic diagnostic = currentDiagnostic();
    Jdbi jdbi = TestSuiteBootstrap.getJdbi();

    DbTuneDiagnosis diagnosis = jdbi.withHandle(diagnostic::diagnose);

    assertNotNull(diagnosis, "diagnose() must return a non-null diagnosis");
    assertNotNull(diagnosis.findings(), "findings list must be present (empty allowed)");
    assertNotNull(diagnosis.notes(), "notes list must be present (empty allowed)");
    // On a freshly-bootstrapped IT DB we expect either:
    //   - an empty diagnosis (nothing has accumulated yet to flag), OR
    //   - notes about missing optional extensions like pg_stat_statements.
    // Either is fine — what we're really asserting is the diagnostic ran end-to-end without
    // throwing on the live schema.
  }

  @Test
  void dryRunDoesNotMutateReloptions() {
    AutoTuner tuner = currentTuner();
    Jdbi jdbi = TestSuiteBootstrap.getJdbi();

    Map<String, String> before = currentSettingsFor(tuner, jdbi, READ_ONLY_PROBE_TABLE);

    DbTuneResult result = jdbi.withHandle(tuner::analyze);
    assertNotNull(result);

    Map<String, String> after = currentSettingsFor(tuner, jdbi, READ_ONLY_PROBE_TABLE);
    assertEquals(before, after, "Analyze (dry-run) must not change table settings");
  }

  // ---- helpers ----

  private AutoTuner currentTuner() {
    return currentConnectionType() == ConnectionType.POSTGRES
        ? new PostgresAutoTuner()
        : new MysqlAutoTuner();
  }

  private Diagnostic currentDiagnostic() {
    return currentConnectionType() == ConnectionType.POSTGRES
        ? new PostgresDiagnostic()
        : new MysqlDiagnostic();
  }

  private ConnectionType currentConnectionType() {
    return "mysql".equalsIgnoreCase(System.getProperty("databaseType", "postgres"))
        ? ConnectionType.MYSQL
        : ConnectionType.POSTGRES;
  }

  /**
   * Builds a {@link TableRecommendation} pointing at {@link #ISOLATED_TABLE} with engine-appropriate
   * settings. We construct it directly rather than going through {@code analyze()} because the
   * isolated table is intentionally NOT in the static catalog — that's how we keep the apply path
   * off shared production tables.
   */
  private TableRecommendation recommendationForIsolatedTable(final ConnectionType connType) {
    Map<String, String> recommended =
        connType == ConnectionType.POSTGRES
            ? Map.of("autovacuum_vacuum_scale_factor", "0.05")
            : Map.of("STATS_PERSISTENT", "1", "STATS_AUTO_RECALC", "1");
    return new TableRecommendation(
        ISOLATED_TABLE, Action.APPLY, 0L, 0L, Map.of(), recommended, "Isolated IT test table");
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

  private static String quoteIdent(final ConnectionType connType, final String identifier) {
    if (!identifier.matches("[a-zA-Z_][a-zA-Z0-9_]*")) {
      throw new IllegalArgumentException("Refusing unsafe identifier: " + identifier);
    }
    return connType == ConnectionType.POSTGRES ? "\"" + identifier + "\"" : "`" + identifier + "`";
  }
}
