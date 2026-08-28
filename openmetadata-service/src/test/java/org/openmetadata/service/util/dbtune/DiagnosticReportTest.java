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

/**
 * Diagnostic-side rendering and grouping tests. Pure logic, no DB. The end-to-end DB query
 * exercise lives in {@code DbTuneIT}.
 */
class DiagnosticReportTest {

  @Test
  void findingsByCategory_groupsByEnumOrder() {
    DbTuneDiagnosis d =
        new DbTuneDiagnosis(
            List.of(
                finding(DiagnosticCategory.SLOW_QUERY, "q1"),
                finding(DiagnosticCategory.UNUSED_INDEX, "idx_a"),
                finding(DiagnosticCategory.UNUSED_INDEX, "idx_b"),
                finding(DiagnosticCategory.HIGH_DEAD_TUPLES, "tag_usage")),
            List.of());

    Map<DiagnosticCategory, List<Finding>> grouped = d.findingsByCategory();

    assertEquals(2, grouped.get(DiagnosticCategory.UNUSED_INDEX).size());
    assertEquals(1, grouped.get(DiagnosticCategory.HIGH_DEAD_TUPLES).size());
    assertEquals(1, grouped.get(DiagnosticCategory.SLOW_QUERY).size());
    // EnumMap preserves enum declaration order — UNUSED_INDEX precedes HIGH_DEAD_TUPLES precedes
    // SLOW_QUERY.
    List<DiagnosticCategory> orderedKeys = grouped.keySet().stream().toList();
    assertEquals(
        List.of(
            DiagnosticCategory.UNUSED_INDEX,
            DiagnosticCategory.HIGH_DEAD_TUPLES,
            DiagnosticCategory.SLOW_QUERY),
        orderedKeys);
  }

  @Test
  void renderDiagnosis_empty_showsCleanResultMessage() {
    DbTuneDiagnosis empty = new DbTuneDiagnosis(List.of(), List.of());

    String out = DbTuneReport.renderDiagnosis(empty);

    assertTrue(out.contains("Diagnostic findings"));
    assertTrue(out.contains("every check returned a clean result"));
  }

  @Test
  void renderDiagnosis_findingsRenderUnderCategorySections() {
    DbTuneDiagnosis d =
        new DbTuneDiagnosis(
            List.of(
                new Finding(
                    DiagnosticCategory.UNUSED_INDEX,
                    Severity.WARN,
                    Map.of(
                        "table", "tag_usage",
                        "index", "idx_unused_tag",
                        "size", "120 MB",
                        "scans", "0"))),
            List.of());

    String out = DbTuneReport.renderDiagnosis(d);

    assertTrue(out.contains("Unused indexes (1 found)"));
    assertTrue(out.contains("idx_unused_tag"));
    assertTrue(out.contains("120 MB"));
  }

  @Test
  void renderDiagnosis_notesAppendedWhenPresent() {
    DbTuneDiagnosis d =
        new DbTuneDiagnosis(
            List.of(), List.of("slow queries: pg_stat_statements extension not installed"));

    String out = DbTuneReport.renderDiagnosis(d);

    assertTrue(out.contains("Notes:"));
    assertTrue(out.contains("pg_stat_statements extension not installed"));
  }

  @Test
  void renderDiagnosis_categoriesWithoutFindingsAreSuppressed() {
    DbTuneDiagnosis d =
        new DbTuneDiagnosis(List.of(finding(DiagnosticCategory.SLOW_QUERY, "SELECT 1")), List.of());

    String out = DbTuneReport.renderDiagnosis(d);

    assertTrue(out.contains("Top slowest queries"));
    assertFalse(out.contains("Unused indexes"));
    assertFalse(out.contains("Tables with high dead-tuple ratio"));
  }

  @Test
  void truncate_collapsesWhitespaceAndAppliesLimit() {
    String long_ =
        "SELECT  *\nFROM  table_entity\nWHERE  fqnHash  LIKE  'foo%'  ORDER  BY  name  LIMIT  100";

    String t = PostgresDiagnostic.truncate(long_);

    assertFalse(t.contains("  "));
    assertFalse(t.contains("\n"));
    assertTrue(t.length() <= 101); // 100 + ellipsis
  }

  @Test
  void truncate_nullReturnsEmpty() {
    assertEquals("", PostgresDiagnostic.truncate(null));
    assertEquals("", MysqlDiagnostic.truncate(null));
  }

  @Test
  void truncate_underLimitReturnsAsIs() {
    assertEquals("SELECT 1", PostgresDiagnostic.truncate("SELECT 1"));
  }

  @Test
  void truncate_overLimitGetsEllipsis() {
    String long_ = "x".repeat(150);
    String t = PostgresDiagnostic.truncate(long_);
    assertTrue(t.endsWith("…"));
    assertEquals(101, t.length());
  }

  @Test
  void diagnosticCategory_columnsAreImmutable() {
    List<String> cols = DiagnosticCategory.UNUSED_INDEX.columns();
    org.junit.jupiter.api.Assertions.assertThrows(
        UnsupportedOperationException.class, () -> cols.add("new_col"));
  }

  @Test
  void nullSafe_returnsEmptyForNullAndUntouchedForNonNull() {
    assertEquals("", PostgresDiagnostic.nullSafe(null));
    assertEquals("", PostgresDiagnostic.nullSafe(""));
    assertEquals("2026-05-11 10:00:00", PostgresDiagnostic.nullSafe("2026-05-11 10:00:00"));
  }

  @Test
  void formatSeqIdxRatio_usesDoubleDivisionAndOneDecimal() {
    assertEquals("7.5", PostgresDiagnostic.formatSeqIdxRatio(15, 2));
    assertEquals("10.0", PostgresDiagnostic.formatSeqIdxRatio(100, 10));
    assertEquals("0.5", PostgresDiagnostic.formatSeqIdxRatio(1, 2));
  }

  @Test
  void formatSeqIdxRatio_zeroIdxScansRendersInfinity() {
    assertEquals("∞", PostgresDiagnostic.formatSeqIdxRatio(50000, 0));
  }

  private static Finding finding(final DiagnosticCategory category, final String objectName) {
    return new Finding(category, Severity.INFO, Map.of("table", objectName));
  }
}
