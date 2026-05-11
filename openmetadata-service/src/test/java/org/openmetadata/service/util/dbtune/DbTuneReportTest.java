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
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class DbTuneReportTest {

  @Test
  void formatBytes_handlesAllScales() {
    assertEquals("0 B", DbTuneReport.formatBytes(0));
    assertEquals("512 B", DbTuneReport.formatBytes(512));
    assertEquals("2 KB", DbTuneReport.formatBytes(2048));
    assertEquals("4 MB", DbTuneReport.formatBytes(4L * 1024 * 1024));
    assertEquals("1.5 GB", DbTuneReport.formatBytes((long) (1.5 * 1024 * 1024 * 1024)));
  }

  @Test
  void formatSettings_emptyOrNullShowsDefault() {
    assertEquals("(default)", DbTuneReport.formatSettings(null));
    assertEquals("(default)", DbTuneReport.formatSettings(Map.of()));
  }

  @Test
  void formatSettings_sortsKeysAlphabetically() {
    String formatted =
        DbTuneReport.formatSettings(
            Map.of(
                "autovacuum_vacuum_scale_factor", "0.02",
                "autovacuum_analyze_scale_factor", "0.01"));

    assertEquals(
        "autovacuum_analyze_scale_factor=0.01, autovacuum_vacuum_scale_factor=0.02", formatted);
  }

  @Test
  void render_includesEngineAndAllSections() {
    DbTuneResult result =
        new DbTuneResult(
            "PostgreSQL",
            "17.2",
            List.of(
                new ServerParamCheck(
                    "shared_buffers", "16384", "40% of RAM", ServerParamCheck.STATUS_UNTUNED, "")),
            List.of(
                new TableRecommendation(
                    "storage_container_entity",
                    Action.APPLY,
                    580_000,
                    2L * 1024 * 1024 * 1024,
                    Map.of(),
                    Map.of("autovacuum_vacuum_scale_factor", "0.02"),
                    "Large entity table")));

    String report = DbTuneReport.render(result);

    assertTrue(report.contains("PostgreSQL 17.2"));
    assertTrue(report.contains("Server-level parameter compliance"));
    assertTrue(report.contains("Per-table recommendations"));
    assertTrue(report.contains("storage_container_entity"));
    assertTrue(report.contains("APPLY"));
    assertTrue(report.contains("Next steps:"));
  }

  @Test
  void render_zeroRecommendationsSuppressesAllMatchAndNextSteps() {
    DbTuneResult result = new DbTuneResult("PostgreSQL", "17.2", List.of(), List.of());

    String report = DbTuneReport.render(result);

    assertTrue(report.contains("none of the tracked tables exist"));
    assertFalse(
        report.contains("already match their recommended settings"),
        "Empty recommendations must not claim everything matches");
    assertFalse(report.contains("Next steps:"));
  }

  @Test
  void render_noActionableShowsAllGoodMessage() {
    DbTuneResult result =
        new DbTuneResult(
            "PostgreSQL",
            "17.2",
            List.of(),
            List.of(
                new TableRecommendation(
                    "storage_container_entity",
                    Action.OK,
                    580_000,
                    1_000_000L,
                    Map.of("autovacuum_vacuum_scale_factor", "0.02"),
                    Map.of("autovacuum_vacuum_scale_factor", "0.02"),
                    "ok")));

    String report = DbTuneReport.render(result);

    assertTrue(report.contains("already match their recommended settings"));
    assertFalse(report.contains("Next steps:"));
  }

  @Test
  void renderAlterStatements_emitsOneSemicolonPerStatement() {
    PostgresAutoTuner tuner = new PostgresAutoTuner();
    TableRecommendation a =
        new TableRecommendation(
            "table_entity",
            Action.APPLY,
            500_000,
            1_000_000L,
            Map.of(),
            Map.of("autovacuum_vacuum_scale_factor", "0.02"),
            "ok");
    TableRecommendation b =
        new TableRecommendation(
            "dashboard_entity",
            Action.APPLY,
            300_000,
            1_000_000L,
            Map.of(),
            Map.of("autovacuum_vacuum_scale_factor", "0.02"),
            "ok");

    String out = DbTuneReport.renderAlterStatements(tuner, List.of(a, b));

    String[] lines = out.split("\n");
    assertEquals(2, lines.length);
    assertTrue(lines[0].endsWith(";"));
    assertTrue(lines[1].endsWith(";"));
    assertTrue(lines[0].contains("table_entity"));
    assertTrue(lines[1].contains("dashboard_entity"));
  }

  @Test
  void actionableRecommendations_excludesOkAndSkip() {
    DbTuneResult result =
        new DbTuneResult(
            "PostgreSQL",
            "17",
            List.of(),
            List.of(
                rec("a", Action.APPLY),
                rec("b", Action.OK),
                rec("c", Action.SKIP),
                rec("d", Action.TIGHTEN),
                rec("e", Action.RELAX)));

    List<TableRecommendation> actionable = result.actionableRecommendations();

    assertEquals(3, actionable.size());
    assertEquals(
        List.of("a", "d", "e"), actionable.stream().map(TableRecommendation::tableName).toList());
  }

  private static TableRecommendation rec(final String name, final Action action) {
    return new TableRecommendation(name, action, 0, 0, Map.of(), Map.of(), "");
  }
}
