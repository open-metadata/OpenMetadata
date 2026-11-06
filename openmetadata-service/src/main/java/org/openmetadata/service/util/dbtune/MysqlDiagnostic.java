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

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;

/**
 * MySQL diagnostic. Reads from {@code sys.*}, {@code performance_schema.*}, and
 * {@code INFORMATION_SCHEMA} views; gracefully degrades if a view is missing or permissions are
 * insufficient (the operator gets a {@link DbTuneDiagnosis#notes()} entry).
 */
@Slf4j
public final class MysqlDiagnostic implements Diagnostic {

  static final double LOW_BUFFER_POOL_HIT = 0.99;
  static final int SLOW_QUERY_LIMIT = 10;
  static final int QUERY_TRUNCATE = 100;

  @Override
  public DbTuneDiagnosis diagnose(final Handle handle) {
    List<Finding> findings = new ArrayList<>();
    List<String> notes = new ArrayList<>();
    runCategory(handle, notes, "unused indexes", h -> findings.addAll(unusedIndexes(h)));
    runCategory(handle, notes, "buffer pool hit", h -> findings.addAll(bufferPoolHit(h, notes)));
    runCategory(handle, notes, "slow queries", h -> findings.addAll(slowQueries(h, notes)));
    runCategory(handle, notes, "full table scans", h -> findings.addAll(fullTableScans(h, notes)));
    return new DbTuneDiagnosis(findings, notes);
  }

  private void runCategory(
      final Handle handle,
      final List<String> notes,
      final String label,
      final java.util.function.Consumer<Handle> body) {
    try {
      body.accept(handle);
    } catch (Exception e) {
      LOG.warn("Diagnostic [{}] failed: {}", label, e.getMessage());
      notes.add(label + ": " + e.getMessage());
    }
  }

  // ---- categories ----

  List<Finding> unusedIndexes(final Handle handle) {
    return handle
        .createQuery(
            "SELECT object_schema, object_name, index_name "
                + "FROM sys.schema_unused_indexes "
                + "WHERE object_schema = DATABASE() "
                + "ORDER BY object_name "
                + "LIMIT 50")
        .map(
            (rs, ctx) ->
                new Finding(
                    DiagnosticCategory.UNUSED_INDEX,
                    Severity.WARN,
                    Map.of(
                        "table",
                        rs.getString("object_name"),
                        "index",
                        rs.getString("index_name"),
                        "size",
                        "(not in view)",
                        "scans",
                        "0")))
        .list();
  }

  List<Finding> bufferPoolHit(final Handle handle, final List<String> notes) {
    Long reads = readGlobalStatusLong(handle, "Innodb_buffer_pool_reads");
    Long requests = readGlobalStatusLong(handle, "Innodb_buffer_pool_read_requests");
    if (reads == null || requests == null || requests == 0) {
      notes.add("buffer pool hit: Innodb_buffer_pool_* counters not available");
      return List.of();
    }
    double hitRatio = 1.0 - (reads.doubleValue() / requests.doubleValue());
    if (hitRatio >= LOW_BUFFER_POOL_HIT) {
      return List.of();
    }
    return List.of(
        new Finding(
            DiagnosticCategory.LOW_BUFFER_POOL_HIT,
            Severity.INFO,
            Map.of(
                "metric",
                "innodb_buffer_pool_hit_ratio",
                "value",
                String.format(Locale.ROOT, "%.4f", hitRatio))));
  }

  List<Finding> slowQueries(final Handle handle, final List<String> notes) {
    try {
      return handle
          .createQuery(
              "SELECT digest_text, count_star AS calls, "
                  + "  ROUND(avg_timer_wait/1000000, 2) AS mean_us "
                  + "FROM performance_schema.events_statements_summary_by_digest "
                  + "WHERE schema_name = DATABASE() "
                  + "  AND digest_text IS NOT NULL "
                  + "ORDER BY avg_timer_wait DESC "
                  + "LIMIT :limit")
          .bind("limit", SLOW_QUERY_LIMIT)
          .map(
              (rs, ctx) -> {
                Map<String, String> attrs = new LinkedHashMap<>();
                attrs.put("query", truncate(rs.getString("digest_text")));
                attrs.put("calls", String.valueOf(rs.getLong("calls")));
                attrs.put(
                    "mean_ms",
                    String.format(Locale.ROOT, "%.2f", rs.getDouble("mean_us") / 1000.0));
                return new Finding(DiagnosticCategory.SLOW_QUERY, Severity.INFO, attrs);
              })
          .list();
    } catch (Exception e) {
      notes.add("slow queries: performance_schema not available (" + e.getMessage() + ")");
      return List.of();
    }
  }

  List<Finding> fullTableScans(final Handle handle, final List<String> notes) {
    try {
      return handle
          .createQuery(
              "SELECT query, exec_count, rows_examined_avg "
                  + "FROM sys.statements_with_full_table_scans "
                  + "WHERE db = DATABASE() "
                  + "ORDER BY exec_count DESC "
                  + "LIMIT 10")
          .map(
              (rs, ctx) ->
                  new Finding(
                      DiagnosticCategory.FULL_TABLE_SCAN,
                      Severity.INFO,
                      Map.of(
                          "query", truncate(rs.getString("query")),
                          "exec_count", String.valueOf(rs.getLong("exec_count")),
                          "rows_examined_avg", String.valueOf(rs.getLong("rows_examined_avg")))))
          .list();
    } catch (Exception e) {
      notes.add(
          "full table scans: sys.statements_with_full_table_scans not available ("
              + e.getMessage()
              + ")");
      return List.of();
    }
  }

  private Long readGlobalStatusLong(final Handle handle, final String name) {
    try {
      return handle
          .createQuery(
              "SELECT VARIABLE_VALUE FROM performance_schema.global_status "
                  + "WHERE VARIABLE_NAME = :n")
          .bind("n", name)
          .mapTo(Long.class)
          .findOne()
          .orElse(null);
    } catch (Exception e) {
      return null;
    }
  }

  static String truncate(final String query) {
    if (query == null) {
      return "";
    }
    String collapsed = query.replaceAll("\\s+", " ").trim();
    return collapsed.length() <= QUERY_TRUNCATE
        ? collapsed
        : collapsed.substring(0, QUERY_TRUNCATE) + "…";
  }
}
