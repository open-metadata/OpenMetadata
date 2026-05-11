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
import org.openmetadata.service.util.dbtune.MysqlTuningCatalog.Profile;

public final class MysqlAutoTuner implements AutoTuner {

  @Override
  public DbTuneResult analyze(final Handle handle) {
    String version = readVersion(handle);
    List<ServerParamCheck> serverParams = readServerParams(handle);
    List<TableStats> stats = loadTableStats(handle);
    List<TableRecommendation> recs = stats.stream().map(this::recommend).toList();
    return new DbTuneResult("MySQL", version, serverParams, recs);
  }

  @Override
  public TableRecommendation recommend(final TableStats stats) {
    Profile profile = MysqlTuningCatalog.profileFor(stats.tableName());
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
    Action action = current.isEmpty() ? Action.APPLY : Action.TIGHTEN;
    return new TableRecommendation(
        stats.tableName(),
        action,
        stats.rowCount(),
        stats.totalBytes(),
        current,
        recommended,
        profile.reason());
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
    handle.execute("ANALYZE TABLE " + quoteIdent(tableName));
  }

  @Override
  public String buildAlterStatement(final TableRecommendation recommendation) {
    String settings =
        recommendation.recommendedSettings().entrySet().stream()
            .sorted(Map.Entry.comparingByKey())
            .map(e -> e.getKey() + "=" + e.getValue())
            .collect(Collectors.joining(", "));
    return "ALTER TABLE " + quoteIdent(recommendation.tableName()) + " " + settings;
  }

  // ---- DB I/O ----

  String readVersion(final Handle handle) {
    return handle.createQuery("SELECT VERSION()").mapTo(String.class).findOne().orElse("");
  }

  List<TableStats> loadTableStats(final Handle handle) {
    List<TableStats> result = new ArrayList<>();
    for (String tableName : MysqlTuningCatalog.tableNames()) {
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
            "SELECT TABLE_ROWS AS rows_estimate, "
                + "  COALESCE(DATA_LENGTH, 0) AS heap_bytes, "
                + "  COALESCE(INDEX_LENGTH, 0) AS idx_bytes, "
                + "  COALESCE(CREATE_OPTIONS, '') AS create_opts "
                + "FROM information_schema.TABLES "
                + "WHERE TABLE_SCHEMA = DATABASE() "
                + "  AND TABLE_NAME = :name")
        .bind("name", tableName)
        .map(
            (rs, ctx) ->
                new TableStats(
                    tableName,
                    Math.max(rs.getLong("rows_estimate"), 0),
                    rs.getLong("heap_bytes"),
                    rs.getLong("idx_bytes"),
                    parseCreateOptions(rs.getString("create_opts"))))
        .findOne()
        .orElse(null);
  }

  @Override
  public Map<String, String> currentSettingsForTable(final Handle handle, final String tableName) {
    return handle
        .createQuery(
            "SELECT COALESCE(CREATE_OPTIONS, '') AS create_opts "
                + "FROM information_schema.TABLES "
                + "WHERE TABLE_SCHEMA = DATABASE() "
                + "  AND TABLE_NAME = :name")
        .bind("name", tableName)
        .mapTo(String.class)
        .findOne()
        .map(MysqlAutoTuner::parseCreateOptions)
        .orElse(Map.of());
  }

  List<ServerParamCheck> readServerParams(final Handle handle) {
    List<ServerParamCheck> checks = new ArrayList<>();
    Map<String, String> recommendations = recommendedServerParams();
    for (Map.Entry<String, String> e : recommendations.entrySet()) {
      String name = e.getKey();
      String recommended = e.getValue();
      String current = readGlobalVariable(handle, name);
      checks.add(buildServerCheck(name, current, recommended));
    }
    return checks;
  }

  // ---- helpers ----

  static Map<String, String> parseCreateOptions(final String createOptions) {
    if (createOptions == null || createOptions.isBlank()) {
      return Map.of();
    }
    Map<String, String> out = new LinkedHashMap<>();
    for (String token : createOptions.trim().split("\\s+")) {
      int eq = token.indexOf('=');
      if (eq > 0) {
        String key = token.substring(0, eq).toUpperCase(Locale.ROOT);
        String value = token.substring(eq + 1);
        if (key.startsWith("STATS_")) {
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
      return a.equalsIgnoreCase(b);
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
    return "`" + identifier + "`";
  }

  private String readGlobalVariable(final Handle handle, final String name) {
    return handle
        .createQuery(
            "SELECT VARIABLE_VALUE FROM performance_schema.global_variables "
                + "WHERE VARIABLE_NAME = :n")
        .bind("n", name.toLowerCase(Locale.ROOT))
        .mapTo(String.class)
        .findOne()
        .orElse(null);
  }

  static Map<String, String> recommendedServerParams() {
    Map<String, String> map = new LinkedHashMap<>();
    map.put("innodb_buffer_pool_size", "40-60% of RAM (use formula form on RDS)");
    map.put("innodb_io_capacity", "2000");
    map.put("innodb_io_capacity_max", "4000");
    map.put("innodb_stats_persistent_sample_pages", "64");
    map.put("sort_buffer_size", "8388608"); // 8 MB
    map.put("join_buffer_size", "4194304"); // 4 MB
    map.put("tmp_table_size", "67108864"); // 64 MB
    map.put("max_heap_table_size", "67108864"); // 64 MB
    return Map.copyOf(map);
  }

  static ServerParamCheck buildServerCheck(
      final String name, final String current, final String recommended) {
    if (current == null) {
      return new ServerParamCheck(
          name, "", recommended, ServerParamCheck.STATUS_UNKNOWN, "Variable not visible");
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
