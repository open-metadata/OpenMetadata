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
import java.util.stream.Collectors;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.util.dbtune.PostgresTuningCatalog.Profile;

public final class PostgresAutoTuner implements AutoTuner {

  private static final List<String> RELOPTION_KEYS =
      List.of(
          PostgresTuningCatalog.AUTOVACUUM_VACUUM_SCALE_FACTOR,
          PostgresTuningCatalog.AUTOVACUUM_ANALYZE_SCALE_FACTOR,
          PostgresTuningCatalog.AUTOVACUUM_VACUUM_COST_LIMIT,
          PostgresTuningCatalog.AUTOVACUUM_VACUUM_COST_DELAY);

  @Override
  public DbTuneResult analyze(final Handle handle) {
    String version = readVersion(handle);
    List<ServerParamCheck> serverParams = readServerParams(handle);
    List<TableStats> stats = loadTableStats(handle);
    List<TableRecommendation> recs = stats.stream().map(this::recommend).toList();
    return new DbTuneResult("PostgreSQL", version, serverParams, recs);
  }

  @Override
  public TableRecommendation recommend(final TableStats stats) {
    Profile profile = PostgresTuningCatalog.profileFor(stats.tableName());
    if (profile == null) {
      return skip(stats, "Table is not in the dbtune catalog");
    }
    if (stats.rowCount() < profile.rowThreshold()) {
      return skip(
          stats,
          String.format(
              Locale.ROOT,
              "Row count %d below threshold %d",
              stats.rowCount(),
              profile.rowThreshold()));
    }
    return decideAction(stats, profile);
  }

  private TableRecommendation decideAction(final TableStats stats, final Profile profile) {
    Map<String, String> recommended = profile.settings();
    Map<String, String> current = stats.currentSettings();
    if (settingsMatch(current, recommended)) {
      return new TableRecommendation(
          stats.tableName(),
          Action.OK,
          stats.rowCount(),
          stats.totalBytes(),
          current,
          recommended,
          "Already matches recommended settings");
    }
    Action action = chooseAction(current, profile);
    return new TableRecommendation(
        stats.tableName(),
        action,
        stats.rowCount(),
        stats.totalBytes(),
        current,
        recommended,
        profile.reason());
  }

  private Action chooseAction(final Map<String, String> current, final Profile profile) {
    if (current.isEmpty()) {
      return profile.relax() ? Action.RELAX : Action.APPLY;
    }
    return profile.relax() ? Action.RELAX : Action.TIGHTEN;
  }

  @Override
  public void apply(final Handle handle, final TableRecommendation recommendation) {
    if (!recommendation.action().isActionable()) {
      return;
    }
    handle.execute(buildAlterStatement(recommendation));
  }

  @Override
  public void analyzeOne(final Handle handle, final String tableName) {
    handle.execute("ANALYZE " + quoteIdent(tableName));
  }

  @Override
  public String buildAlterStatement(final TableRecommendation recommendation) {
    String settings =
        recommendation.recommendedSettings().entrySet().stream()
            .sorted(Map.Entry.comparingByKey())
            .map(e -> e.getKey() + " = " + e.getValue())
            .collect(Collectors.joining(", "));
    return "ALTER TABLE " + quoteIdent(recommendation.tableName()) + " SET (" + settings + ")";
  }

  // ---- DB I/O ----

  String readVersion(final Handle handle) {
    return handle.createQuery("SHOW server_version").mapTo(String.class).findOne().orElse("");
  }

  List<TableStats> loadTableStats(final Handle handle) {
    List<TableStats> result = new ArrayList<>();
    for (String tableName : PostgresTuningCatalog.tableNames()) {
      TableStats stats = loadTableStats(handle, tableName);
      if (stats != null) {
        result.add(stats);
      }
    }
    return result;
  }

  TableStats loadTableStats(final Handle handle, final String tableName) {
    return handle
        .createQuery(
            "SELECT c.reltuples::bigint AS rows, "
                + "  pg_relation_size(c.oid) AS heap_bytes, "
                + "  pg_indexes_size(c.oid) AS idx_bytes, "
                + "  COALESCE(c.reloptions, ARRAY[]::text[]) AS opts "
                + "FROM pg_class c "
                + "JOIN pg_namespace n ON n.oid = c.relnamespace "
                + "WHERE c.relkind = 'r' "
                + "  AND n.nspname = ANY (current_schemas(false)) "
                + "  AND c.relname = :name")
        .bind("name", tableName)
        .map(
            (rs, ctx) -> {
              long rows = rs.getLong("rows");
              long heap = rs.getLong("heap_bytes");
              long idx = rs.getLong("idx_bytes");
              String[] opts = (String[]) rs.getArray("opts").getArray();
              return new TableStats(tableName, Math.max(rows, 0), heap, idx, parseReloptions(opts));
            })
        .findOne()
        .orElse(null);
  }

  @Override
  public Map<String, String> currentSettingsForTable(final Handle handle, final String tableName) {
    return handle
        .createQuery(
            "SELECT COALESCE(c.reloptions, ARRAY[]::text[]) AS opts "
                + "FROM pg_class c "
                + "JOIN pg_namespace n ON n.oid = c.relnamespace "
                + "WHERE c.relkind = 'r' "
                + "  AND n.nspname = ANY (current_schemas(false)) "
                + "  AND c.relname = :name")
        .bind("name", tableName)
        .map((rs, ctx) -> parseReloptions((String[]) rs.getArray("opts").getArray()))
        .findOne()
        .orElse(Map.of());
  }

  List<ServerParamCheck> readServerParams(final Handle handle) {
    List<ServerParamCheck> checks = new ArrayList<>();
    Map<String, String> recommendations = recommendedServerParams();
    for (Map.Entry<String, String> e : recommendations.entrySet()) {
      String name = e.getKey();
      String recommended = e.getValue();
      String current =
          handle
              .createQuery("SELECT setting FROM pg_settings WHERE name = :n")
              .bind("n", name)
              .mapTo(String.class)
              .findOne()
              .orElse(null);
      checks.add(buildServerCheck(name, current, recommended));
    }
    return checks;
  }

  // ---- helpers ----

  static Map<String, String> parseReloptions(final String[] opts) {
    if (opts == null || opts.length == 0) {
      return Map.of();
    }
    Map<String, String> out = new LinkedHashMap<>();
    for (String opt : opts) {
      int eq = opt.indexOf('=');
      if (eq > 0) {
        String key = opt.substring(0, eq).toLowerCase(Locale.ROOT);
        String value = opt.substring(eq + 1);
        if (RELOPTION_KEYS.contains(key)) {
          out.put(key, value);
        }
      }
    }
    return Map.copyOf(out);
  }

  static boolean settingsMatch(final Map<String, String> current, final Map<String, String> rec) {
    for (Map.Entry<String, String> e : rec.entrySet()) {
      String currentValue = current.get(e.getKey());
      if (currentValue == null || !numericEquals(currentValue, e.getValue())) {
        return false;
      }
    }
    return true;
  }

  private static boolean numericEquals(final String a, final String b) {
    try {
      return Double.parseDouble(a) == Double.parseDouble(b);
    } catch (NumberFormatException ex) {
      return a.equals(b);
    }
  }

  private static TableRecommendation skip(final TableStats stats, final String reason) {
    return new TableRecommendation(
        stats.tableName(),
        Action.SKIP,
        stats.rowCount(),
        stats.totalBytes(),
        stats.currentSettings(),
        Map.of(),
        reason);
  }

  static String quoteIdent(final String identifier) {
    if (!identifier.matches("[a-zA-Z_][a-zA-Z0-9_]*")) {
      throw new IllegalArgumentException(
          "Refusing to build SQL with unsafe identifier: " + identifier);
    }
    return "\"" + identifier + "\"";
  }

  /** Server-level recommendations from the production runbook. */
  static Map<String, String> recommendedServerParams() {
    Map<String, String> map = new LinkedHashMap<>();
    map.put("shared_buffers", "40% of RAM (use formula form on RDS)");
    map.put("effective_cache_size", "75% of RAM (use formula form on RDS)");
    map.put("work_mem", "131072"); // 128 MB
    map.put("maintenance_work_mem", "2097152"); // 2 GB
    map.put("random_page_cost", "1.1");
    map.put("effective_io_concurrency", "200");
    map.put("max_parallel_workers_per_gather", "4");
    map.put("autovacuum_naptime", "15");
    map.put("autovacuum_vacuum_scale_factor", "0.05");
    map.put("autovacuum_analyze_scale_factor", "0.02");
    return Map.copyOf(map);
  }

  static ServerParamCheck buildServerCheck(
      final String name, final String current, final String recommended) {
    if (current == null) {
      return new ServerParamCheck(
          name, "", recommended, ServerParamCheck.STATUS_UNKNOWN, "Parameter not visible");
    }
    if (recommended.contains("%")) {
      return new ServerParamCheck(
          name,
          current,
          recommended,
          ServerParamCheck.STATUS_UNTUNED,
          "RAM-relative; verify in RDS");
    }
    boolean ok = numericEquals(current, recommended);
    String status = ok ? ServerParamCheck.STATUS_OK : ServerParamCheck.STATUS_MISMATCH;
    return new ServerParamCheck(name, current, recommended, status, "");
  }
}
