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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Heuristic-only tests for the MySQL tuner. Mirrors {@link PostgresAutoTunerTest} but pins the
 * MySQL-specific reloption keys (STATS_PERSISTENT / STATS_AUTO_RECALC / STATS_SAMPLE_PAGES) and
 * ALTER TABLE syntax (no parens, comma-separated key=value).
 */
class MysqlAutoTunerTest {

  private final MysqlAutoTuner tuner = new MysqlAutoTuner();

  @Test
  void recommend_unknownTable_returnsSkip() {
    TableStats stats = stats("not_a_real_table", 1_000_000, Map.of());

    TableRecommendation rec = tuner.recommend(stats);

    assertEquals(Action.SKIP, rec.action());
  }

  @Test
  void recommend_belowRowThreshold_returnsSkip() {
    TableStats stats = stats("storage_container_entity", 100, Map.of());

    TableRecommendation rec = tuner.recommend(stats);

    assertEquals(Action.SKIP, rec.action());
  }

  @Test
  void recommend_largeEntityWithNoSettings_returnsApply() {
    TableStats stats = stats("storage_container_entity", 580_000, Map.of());

    TableRecommendation rec = tuner.recommend(stats);

    assertEquals(Action.APPLY, rec.action());
    assertEquals("64", rec.recommendedSettings().get("STATS_SAMPLE_PAGES"));
    assertEquals("1", rec.recommendedSettings().get("STATS_PERSISTENT"));
  }

  @Test
  void recommend_hotTablesGetHigherSampling() {
    TableStats stats = stats("tag_usage", 7_400_000, Map.of());

    TableRecommendation rec = tuner.recommend(stats);

    assertEquals(Action.APPLY, rec.action());
    assertEquals("100", rec.recommendedSettings().get("STATS_SAMPLE_PAGES"));
  }

  @Test
  void recommend_alreadyMatching_returnsOk() {
    TableStats stats =
        stats(
            "storage_container_entity",
            580_000,
            Map.of(
                "STATS_PERSISTENT", "1",
                "STATS_AUTO_RECALC", "1",
                "STATS_SAMPLE_PAGES", "64"));

    TableRecommendation rec = tuner.recommend(stats);

    assertEquals(Action.OK, rec.action());
  }

  @Test
  void recommend_partialSettings_returnsTighten() {
    TableStats stats =
        stats("storage_container_entity", 580_000, Map.of("STATS_SAMPLE_PAGES", "20"));

    TableRecommendation rec = tuner.recommend(stats);

    assertEquals(Action.TIGHTEN, rec.action());
  }

  @Test
  void buildAlterStatement_usesMySqlSyntax() {
    TableRecommendation rec =
        new TableRecommendation(
            "storage_container_entity",
            Action.APPLY,
            500_000,
            1_000_000_000L,
            Map.of(),
            Map.of(
                "STATS_PERSISTENT", "1",
                "STATS_AUTO_RECALC", "1",
                "STATS_SAMPLE_PAGES", "64"),
            "ok");

    String sql = tuner.buildAlterStatement(rec);

    assertEquals(
        "ALTER TABLE `storage_container_entity` "
            + "STATS_AUTO_RECALC=1, STATS_PERSISTENT=1, STATS_SAMPLE_PAGES=64",
        sql);
  }

  @Test
  void parseCreateOptions_emptyAndBlankProduceEmptyMap() {
    assertTrue(MysqlAutoTuner.parseCreateOptions(null).isEmpty());
    assertTrue(MysqlAutoTuner.parseCreateOptions("").isEmpty());
    assertTrue(MysqlAutoTuner.parseCreateOptions("   ").isEmpty());
  }

  @Test
  void parseCreateOptions_extractsOnlyStatsKeys() {
    Map<String, String> parsed =
        MysqlAutoTuner.parseCreateOptions(
            "row_format=DYNAMIC stats_persistent=1 stats_sample_pages=64");

    assertEquals(Map.of("STATS_PERSISTENT", "1", "STATS_SAMPLE_PAGES", "64"), parsed);
  }

  @Test
  void quoteIdent_usesBacktickAndRejectsUnsafe() {
    assertEquals(
        "`storage_container_entity`", MysqlAutoTuner.quoteIdent("storage_container_entity"));
    assertThrows(IllegalArgumentException.class, () -> MysqlAutoTuner.quoteIdent("`evil`"));
    assertThrows(IllegalArgumentException.class, () -> MysqlAutoTuner.quoteIdent("foo;bar"));
  }

  @Test
  void buildServerCheck_recommendedFormulaIsUntuned() {
    ServerParamCheck check =
        MysqlAutoTuner.buildServerCheck("innodb_buffer_pool_size", "1073741824", "40-60% of RAM");

    assertEquals(ServerParamCheck.STATUS_UNTUNED, check.status());
  }

  private static TableStats stats(
      final String tableName, final long rowCount, final Map<String, String> currentSettings) {
    return new TableStats(tableName, rowCount, 1_000_000L, 500_000L, currentSettings);
  }
}
