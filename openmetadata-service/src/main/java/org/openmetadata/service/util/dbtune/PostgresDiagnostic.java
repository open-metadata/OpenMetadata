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
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;

/**
 * Postgres diagnostic. Each finding category is queried in its own try block so that a missing
 * extension or a stat view permission issue surfaces as a {@link DbTuneDiagnosis#notes()} entry
 * rather than aborting the whole run.
 *
 * <p>Thresholds are baked in for v1; if operators want them tunable later they become CLI flags.
 */
@Slf4j
public final class PostgresDiagnostic implements Diagnostic {

  static final long UNUSED_INDEX_SIZE_BYTES = 10L * 1024 * 1024;
  static final double DEAD_TUPLE_RATIO = 0.2;
  static final long DEAD_TUPLE_MIN_LIVE_ROWS = 10_000;
  static final double LOW_CACHE_HIT_RATIO = 0.9;
  static final long LOW_CACHE_HIT_MIN_READS = 1_000;
  static final int STALE_STATS_DAYS = 14;
  static final long STALE_STATS_MIN_LIVE_ROWS = 1_000;
  static final long SEQ_SCAN_RATIO = 10;
  static final long SEQ_SCAN_MIN = 1_000;
  static final int SLOW_QUERY_LIMIT = 10;
  static final long SLOW_QUERY_MIN_CALLS = 100;
  static final int QUERY_TRUNCATE = 100;

  @Override
  public DbTuneDiagnosis diagnose(final Handle handle) {
    List<Finding> findings = new ArrayList<>();
    List<String> notes = new ArrayList<>();
    runCategory(handle, notes, "unused indexes", h -> findings.addAll(unusedIndexes(h)));
    runCategory(handle, notes, "dead tuples", h -> findings.addAll(highDeadTuples(h)));
    runCategory(handle, notes, "cache hit", h -> findings.addAll(lowCacheHit(h)));
    runCategory(handle, notes, "stale stats", h -> findings.addAll(staleStats(h)));
    runCategory(handle, notes, "seq scans", h -> findings.addAll(seqScanHeavy(h)));
    runCategory(handle, notes, "slow queries", h -> findings.addAll(slowQueries(h, notes)));
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
            "SELECT s.schemaname, s.relname AS table_name, s.indexrelname AS index_name, "
                + "  s.idx_scan AS scans, "
                + "  pg_relation_size(s.indexrelid) AS bytes "
                + "FROM pg_stat_user_indexes s "
                + "JOIN pg_index i ON i.indexrelid = s.indexrelid "
                + "WHERE s.idx_scan = 0 "
                + "  AND NOT i.indisunique "
                + "  AND NOT i.indisprimary "
                + "  AND pg_relation_size(s.indexrelid) > :min_bytes "
                + "ORDER BY pg_relation_size(s.indexrelid) DESC "
                + "LIMIT 50")
        .bind("min_bytes", UNUSED_INDEX_SIZE_BYTES)
        .map(
            (rs, ctx) ->
                new Finding(
                    DiagnosticCategory.UNUSED_INDEX,
                    Severity.WARN,
                    Map.of(
                        "table", rs.getString("table_name"),
                        "index", rs.getString("index_name"),
                        "size", DbTuneReport.formatBytes(rs.getLong("bytes")),
                        "scans", String.valueOf(rs.getLong("scans")))))
        .list();
  }

  List<Finding> highDeadTuples(final Handle handle) {
    return handle
        .createQuery(
            "SELECT relname AS table_name, "
                + "  n_live_tup, "
                + "  n_dead_tup, "
                + "  ROUND((n_dead_tup::numeric / GREATEST(n_live_tup, 1)) * 100, 2) AS dead_pct, "
                + "  last_autovacuum "
                + "FROM pg_stat_user_tables "
                + "WHERE n_live_tup > :min_live "
                + "  AND n_dead_tup::numeric / GREATEST(n_live_tup, 1) > :threshold "
                + "ORDER BY n_dead_tup DESC "
                + "LIMIT 25")
        .bind("min_live", DEAD_TUPLE_MIN_LIVE_ROWS)
        .bind("threshold", DEAD_TUPLE_RATIO)
        .map(
            (rs, ctx) ->
                new Finding(
                    DiagnosticCategory.HIGH_DEAD_TUPLES,
                    Severity.WARN,
                    Map.of(
                        "table", rs.getString("table_name"),
                        "live_rows", String.valueOf(rs.getLong("n_live_tup")),
                        "dead_rows", String.valueOf(rs.getLong("n_dead_tup")),
                        "dead_ratio", rs.getString("dead_pct") + "%",
                        "last_vacuum", nullSafe(rs.getString("last_autovacuum")))))
        .list();
  }

  List<Finding> lowCacheHit(final Handle handle) {
    return handle
        .createQuery(
            "SELECT relname AS table_name, "
                + "  heap_blks_read, "
                + "  heap_blks_hit, "
                + "  ROUND(heap_blks_hit::numeric / NULLIF(heap_blks_hit + heap_blks_read, 0) * 100, 2) AS hit_pct "
                + "FROM pg_statio_user_tables "
                + "WHERE heap_blks_read > :min_reads "
                + "  AND heap_blks_hit::numeric / NULLIF(heap_blks_hit + heap_blks_read, 0) < :threshold "
                + "ORDER BY heap_blks_read DESC "
                + "LIMIT 25")
        .bind("min_reads", LOW_CACHE_HIT_MIN_READS)
        .bind("threshold", LOW_CACHE_HIT_RATIO)
        .map(
            (rs, ctx) ->
                new Finding(
                    DiagnosticCategory.LOW_CACHE_HIT,
                    Severity.INFO,
                    Map.of(
                        "table", rs.getString("table_name"),
                        "heap_reads", String.valueOf(rs.getLong("heap_blks_read")),
                        "heap_hits", String.valueOf(rs.getLong("heap_blks_hit")),
                        "hit_pct", rs.getString("hit_pct") + "%")))
        .list();
  }

  List<Finding> staleStats(final Handle handle) {
    return handle
        .createQuery(
            "SELECT relname AS table_name, "
                + "  n_live_tup, "
                + "  COALESCE(last_autoanalyze, last_analyze) AS last_analyzed "
                + "FROM pg_stat_user_tables "
                + "WHERE n_live_tup > :min_live "
                + "  AND (COALESCE(last_autoanalyze, last_analyze) IS NULL "
                + "    OR COALESCE(last_autoanalyze, last_analyze) < now() - (:days || ' days')::interval) "
                + "ORDER BY n_live_tup DESC "
                + "LIMIT 25")
        .bind("min_live", STALE_STATS_MIN_LIVE_ROWS)
        .bind("days", STALE_STATS_DAYS)
        .map(
            (rs, ctx) ->
                new Finding(
                    DiagnosticCategory.STALE_STATS,
                    Severity.WARN,
                    Map.of(
                        "table", rs.getString("table_name"),
                        "live_rows", String.valueOf(rs.getLong("n_live_tup")),
                        "last_analyzed", nullSafe(rs.getString("last_analyzed")))))
        .list();
  }

  List<Finding> seqScanHeavy(final Handle handle) {
    // Includes idx_scan=0 tables — those are the *worst* candidates for a missing index, not
    // edge cases to filter out. NULLIF would silently drop them via NULL comparison.
    return handle
        .createQuery(
            "SELECT relname AS table_name, seq_scan, idx_scan "
                + "FROM pg_stat_user_tables "
                + "WHERE seq_scan > :min_seq "
                + "  AND (idx_scan = 0 OR seq_scan::numeric / idx_scan > :ratio) "
                + "ORDER BY seq_scan DESC "
                + "LIMIT 25")
        .bind("min_seq", SEQ_SCAN_MIN)
        .bind("ratio", SEQ_SCAN_RATIO)
        .map(
            (rs, ctx) ->
                new Finding(
                    DiagnosticCategory.SEQ_SCAN_HEAVY,
                    Severity.INFO,
                    Map.of(
                        "table", rs.getString("table_name"),
                        "seq_scans", String.valueOf(rs.getLong("seq_scan")),
                        "idx_scans", String.valueOf(rs.getLong("idx_scan")),
                        "ratio",
                            formatSeqIdxRatio(rs.getLong("seq_scan"), rs.getLong("idx_scan")))))
        .list();
  }

  List<Finding> slowQueries(final Handle handle, final List<String> notes) {
    if (!hasPgStatStatements(handle)) {
      notes.add("slow queries: pg_stat_statements extension not installed");
      return List.of();
    }
    return handle
        .createQuery(
            "SELECT query, calls, mean_exec_time AS mean_ms "
                + "FROM pg_stat_statements "
                + "WHERE calls > :min_calls "
                + "ORDER BY mean_exec_time DESC "
                + "LIMIT :limit")
        .bind("min_calls", SLOW_QUERY_MIN_CALLS)
        .bind("limit", SLOW_QUERY_LIMIT)
        .map(
            (rs, ctx) -> {
              Map<String, String> attrs = new LinkedHashMap<>();
              attrs.put("query", truncate(rs.getString("query")));
              attrs.put("calls", String.valueOf(rs.getLong("calls")));
              attrs.put(
                  "mean_ms", String.format(java.util.Locale.ROOT, "%.1f", rs.getDouble("mean_ms")));
              return new Finding(DiagnosticCategory.SLOW_QUERY, Severity.INFO, attrs);
            })
        .list();
  }

  private boolean hasPgStatStatements(final Handle handle) {
    return handle
        .createQuery("SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'")
        .mapTo(Integer.class)
        .findOne()
        .isPresent();
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

  /** Empty string for SQL NULL — never the literal "null" since this lands in user-facing output. */
  static String nullSafe(final String value) {
    return value == null ? "" : value;
  }

  /**
   * Formats {@code seq_scan / idx_scan} as a one-decimal ratio (e.g. {@code 7.5}) using {@code
   * double} division. Returns {@code "∞"} when {@code idx_scan == 0}.
   */
  static String formatSeqIdxRatio(final long seqScan, final long idxScan) {
    if (idxScan == 0) {
      return "∞";
    }
    return String.format(java.util.Locale.ROOT, "%.1f", (double) seqScan / idxScan);
  }
}
