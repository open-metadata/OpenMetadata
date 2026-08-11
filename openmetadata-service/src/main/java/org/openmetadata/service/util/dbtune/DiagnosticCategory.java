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

import java.util.List;

/**
 * Categories of read-only diagnostic findings emitted by {@link Diagnostic#diagnose}. Each category
 * has a fixed list of attribute keys that {@link Finding#attributes} is expected to populate; the
 * report renderer dispatches column layout per category.
 */
public enum DiagnosticCategory {
  UNUSED_INDEX(
      "Unused indexes",
      "Indexes with zero scans since last stats reset; candidates for DROP after a usage review.",
      List.of("table", "index", "size", "scans")),
  HIGH_DEAD_TUPLES(
      "Tables with high dead-tuple ratio",
      "n_dead_tup / n_live_tup > 0.2 — autovacuum is falling behind on this table.",
      List.of("table", "live_rows", "dead_rows", "dead_ratio", "last_vacuum")),
  LOW_CACHE_HIT(
      "Tables with low cache hit ratio",
      "Heap reads exceed 1000 with hit ratio < 90%; suggests undersized buffers or hot seq scans.",
      List.of("table", "heap_reads", "heap_hits", "hit_pct")),
  STALE_STATS(
      "Tables with stale ANALYZE",
      "Last autoanalyze older than 14 days (or never); planner stats may be misleading.",
      List.of("table", "last_analyzed", "live_rows")),
  SEQ_SCAN_HEAVY(
      "Tables with seq-scan-heavy access",
      "seq_scan/idx_scan > 10 with > 1000 seq scans; suggests a missing index.",
      List.of("table", "seq_scans", "idx_scans", "ratio")),
  SLOW_QUERY(
      "Top slowest queries",
      "From pg_stat_statements / events_statements_summary_by_digest. Truncated to 100 chars.",
      List.of("query", "calls", "mean_ms")),
  FULL_TABLE_SCAN(
      "Queries doing full table scans",
      "From sys.statements_with_full_table_scans (MySQL).",
      List.of("query", "exec_count", "rows_examined_avg")),
  LOW_BUFFER_POOL_HIT(
      "InnoDB buffer pool hit ratio",
      "Hit ratio < 99% suggests undersized innodb_buffer_pool_size for the working set.",
      List.of("metric", "value"));

  private final String title;
  private final String description;
  private final List<String> columns;

  DiagnosticCategory(final String title, final String description, final List<String> columns) {
    this.title = title;
    this.description = description;
    this.columns = List.copyOf(columns);
  }

  public String title() {
    return title;
  }

  public String description() {
    return description;
  }

  public List<String> columns() {
    return columns;
  }
}
