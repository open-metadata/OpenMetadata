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
package org.openmetadata.service.util.dbtune;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Heuristic-only tests — no database. Walks the {@code recommend(stats) -> recommendation} pure
 * function across the six action outcomes: SKIP for unknown table, SKIP under threshold, APPLY for
 * empty-and-tighten, OK for already-matching, TIGHTEN for partial-match, RELAX for change_event.
 * Also pins the SQL-builder format and identifier-quoting safety invariants because both feed
 * directly into ALTER TABLE statements.
 */
class PostgresAutoTunerTest {

  private final PostgresAutoTuner tuner = new PostgresAutoTuner();

  @Test
  void recommend_unknownTable_returnsSkip() {
    TableStats stats = stats("not_a_real_table", 1_000_000, Map.of());

    TableRecommendation rec = tuner.recommend(stats);

    assertEquals(Action.SKIP, rec.action());
    assertTrue(rec.reason().contains("not in the dbtune catalog"));
  }

  @Test
  void recommend_belowRowThreshold_returnsSkip() {
    TableStats stats = stats("storage_container_entity", 50, Map.of());

    TableRecommendation rec = tuner.recommend(stats);

    assertEquals(Action.SKIP, rec.action());
    assertTrue(rec.reason().contains("below threshold"));
  }

  @Test
  void recommend_largeEntityWithNoSettings_returnsApply() {
    TableStats stats = stats("storage_container_entity", 580_000, Map.of());

    TableRecommendation rec = tuner.recommend(stats);

    assertEquals(Action.APPLY, rec.action());
    assertEquals("0.01", rec.recommendedSettings().get("autovacuum_analyze_scale_factor"));
    assertEquals("0.02", rec.recommendedSettings().get("autovacuum_vacuum_scale_factor"));
  }

  @Test
  void recommend_largeEntityWithLooserSettings_returnsTighten() {
    TableStats stats =
        stats(
            "storage_container_entity",
            580_000,
            Map.of(
                "autovacuum_analyze_scale_factor", "0.1",
                "autovacuum_vacuum_scale_factor", "0.2"));

    TableRecommendation rec = tuner.recommend(stats);

    assertEquals(Action.TIGHTEN, rec.action());
  }

  @Test
  void recommend_alreadyMatching_returnsOk() {
    TableStats stats =
        stats(
            "storage_container_entity",
            580_000,
            Map.of(
                "autovacuum_analyze_scale_factor", "0.01",
                "autovacuum_vacuum_scale_factor", "0.02"));

    TableRecommendation rec = tuner.recommend(stats);

    assertEquals(Action.OK, rec.action());
  }

  @Test
  void recommend_alreadyMatchingNumericallyDifferentTextually_returnsOk() {
    TableStats stats =
        stats(
            "storage_container_entity",
            580_000,
            Map.of(
                "autovacuum_analyze_scale_factor", "0.010",
                "autovacuum_vacuum_scale_factor", "0.0200"));

    TableRecommendation rec = tuner.recommend(stats);

    assertEquals(Action.OK, rec.action(), "0.010 must equal 0.01 numerically");
  }

  @Test
  void recommend_changeEventWithNoSettings_returnsRelax() {
    TableStats stats = stats("change_event", 12_000_000, Map.of());

    TableRecommendation rec = tuner.recommend(stats);

    assertEquals(Action.RELAX, rec.action());
    assertEquals("0.1", rec.recommendedSettings().get("autovacuum_analyze_scale_factor"));
    assertEquals("0.2", rec.recommendedSettings().get("autovacuum_vacuum_scale_factor"));
  }

  @Test
  void recommend_hotTableHasZeroThreshold() {
    TableStats stats = stats("entity_relationship", 1, Map.of());

    TableRecommendation rec = tuner.recommend(stats);

    assertEquals(Action.APPLY, rec.action());
    assertEquals("4000", rec.recommendedSettings().get("autovacuum_vacuum_cost_limit"));
  }

  @Test
  void recommend_tagUsageRecommendsCostDelayZero() {
    TableStats stats = stats("tag_usage", 7_400_000, Map.of());

    TableRecommendation rec = tuner.recommend(stats);

    assertEquals(Action.APPLY, rec.action());
    assertEquals("0", rec.recommendedSettings().get("autovacuum_vacuum_cost_delay"));
  }

  @Test
  void buildAlterStatement_emitsSortedKeyValuePairs() {
    TableRecommendation rec =
        new TableRecommendation(
            "storage_container_entity",
            Action.APPLY,
            500_000,
            1_000_000_000L,
            Map.of(),
            Map.of(
                "autovacuum_analyze_scale_factor", "0.01",
                "autovacuum_vacuum_scale_factor", "0.02"),
            "ok");

    String sql = tuner.buildAlterStatement(rec);

    assertEquals(
        "ALTER TABLE \"storage_container_entity\" SET ("
            + "autovacuum_analyze_scale_factor = 0.01, "
            + "autovacuum_vacuum_scale_factor = 0.02)",
        sql);
  }

  @Test
  void parseReloptions_emptyAndNullProduceEmptyMap() {
    assertTrue(PostgresAutoTuner.parseReloptions(null).isEmpty());
    assertTrue(PostgresAutoTuner.parseReloptions(new String[0]).isEmpty());
  }

  @Test
  void parseReloptions_filtersUnknownKeysAndLowercasesNames() {
    Map<String, String> parsed =
        PostgresAutoTuner.parseReloptions(
            new String[] {"AUTOVACUUM_VACUUM_SCALE_FACTOR=0.05", "fillfactor=90"});

    assertEquals(Map.of("autovacuum_vacuum_scale_factor", "0.05"), parsed);
  }

  @Test
  void quoteIdent_rejectsSqlInjectionAttempts() {
    assertThrows(
        IllegalArgumentException.class, () -> PostgresAutoTuner.quoteIdent("foo; DROP TABLE bar"));
    assertThrows(IllegalArgumentException.class, () -> PostgresAutoTuner.quoteIdent("\"oops\""));
  }

  @Test
  void quoteIdent_acceptsValidIdentifiers() {
    assertEquals(
        "\"storage_container_entity\"", PostgresAutoTuner.quoteIdent("storage_container_entity"));
  }

  @Test
  void settingsMatch_recommendedSubsetOfCurrent_isMatch() {
    Map<String, String> rec = Map.of("a", "0.01");
    Map<String, String> current = Map.of("a", "0.01", "b", "999");

    assertTrue(PostgresAutoTuner.settingsMatch(current, rec));
  }

  @Test
  void settingsMatch_missingRecommendedKey_isNotMatch() {
    Map<String, String> rec = Map.of("a", "0.01", "b", "0.02");
    Map<String, String> current = Map.of("a", "0.01");

    assertFalse(PostgresAutoTuner.settingsMatch(current, rec));
  }

  @Test
  void buildServerCheck_recommendedFormulaIsUntuned() {
    ServerParamCheck check =
        PostgresAutoTuner.buildServerCheck("shared_buffers", "16384", "40% of RAM");

    assertEquals(ServerParamCheck.STATUS_UNTUNED, check.status());
  }

  @Test
  void buildServerCheck_currentMissingIsUnknown() {
    ServerParamCheck check = PostgresAutoTuner.buildServerCheck("missing", null, "200");

    assertEquals(ServerParamCheck.STATUS_UNKNOWN, check.status());
  }

  @Test
  void buildServerCheck_numericMatchIsOk() {
    ServerParamCheck check = PostgresAutoTuner.buildServerCheck("random_page_cost", "1.10", "1.1");

    assertEquals(ServerParamCheck.STATUS_OK, check.status());
  }

  @Test
  void buildServerCheck_numericMismatchIsLabelledMismatch() {
    ServerParamCheck check = PostgresAutoTuner.buildServerCheck("work_mem", "4096", "131072");

    assertEquals(ServerParamCheck.STATUS_MISMATCH, check.status());
  }

  @Test
  void buildServerCheck_currentHigherThanRecommendedIsAlsoMismatch() {
    // random_page_cost recommendation (1.1) is intentionally LOWER than the SSD-naive default
    // (4.0).
    // Direction-agnostic MISMATCH avoids the misleading "UNDERSIZED" label here.
    ServerParamCheck check = PostgresAutoTuner.buildServerCheck("random_page_cost", "4.0", "1.1");

    assertEquals(ServerParamCheck.STATUS_MISMATCH, check.status());
  }

  private static TableStats stats(
      final String tableName, final long rowCount, final Map<String, String> currentSettings) {
    return new TableStats(tableName, rowCount, 1_000_000L, 500_000L, currentSettings);
  }
}
