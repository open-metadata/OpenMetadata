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

import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import org.openmetadata.service.util.AsciiTable;

public final class DbTuneReport {

  private static final NumberFormat ROW_FORMAT = NumberFormat.getInstance(Locale.ROOT);
  private static final long KB = 1024L;
  private static final long MB = KB * 1024L;
  private static final long GB = MB * 1024L;

  private DbTuneReport() {}

  public static String render(final DbTuneResult result) {
    StringBuilder out = new StringBuilder();
    out.append("Database engine: ").append(result.engine());
    if (result.engineVersion() != null && !result.engineVersion().isBlank()) {
      out.append(" ").append(result.engineVersion());
    }
    out.append('\n').append('\n');
    appendServerParams(out, result.serverParams());
    appendTableRecommendations(out, result.tableRecommendations());
    appendNextSteps(out, result.actionableRecommendations().size());
    return out.toString();
  }

  private static void appendServerParams(
      final StringBuilder out, final List<ServerParamCheck> checks) {
    out.append("=== Server-level parameter compliance ===\n");
    if (checks.isEmpty()) {
      out.append("(no parameter-group checks for this engine)\n\n");
      return;
    }
    List<String> headers = List.of("Parameter", "Current", "Recommended", "Status", "Note");
    List<List<String>> rows =
        checks.stream()
            .map(
                c ->
                    List.of(
                        nullToBlank(c.parameter()),
                        nullToBlank(c.currentValue()),
                        nullToBlank(c.recommendedValue()),
                        nullToBlank(c.status()),
                        nullToBlank(c.note())))
            .toList();
    out.append(new AsciiTable(headers, rows, true, "", "(empty)").render());
    out.append('\n');
    out.append(
        "These cannot be applied by this tool — change them in your DB parameter group / RDS console.\n\n");
  }

  private static void appendTableRecommendations(
      final StringBuilder out, final List<TableRecommendation> recs) {
    out.append("=== Per-table recommendations (").append(recs.size()).append(" tables) ===\n");
    if (recs.isEmpty()) {
      out.append("(no recommendations — none of the tracked tables exist on this database)\n\n");
      return;
    }
    List<String> headers =
        List.of("Table", "Rows", "Size", "Current", "Recommended", "Action", "Reason");
    List<List<String>> rows =
        recs.stream()
            .map(
                r ->
                    List.of(
                        r.tableName(),
                        ROW_FORMAT.format(r.rowCount()),
                        formatBytes(r.totalBytes()),
                        formatSettings(r.currentSettings()),
                        formatSettings(r.recommendedSettings()),
                        r.action().name(),
                        nullToBlank(r.reason())))
            .toList();
    out.append(new AsciiTable(headers, rows, true, "", "(empty)").render());
    out.append('\n');
  }

  private static void appendNextSteps(final StringBuilder out, final int actionableCount) {
    if (actionableCount == 0) {
      out.append("All tracked tables already match their recommended settings — nothing to do.\n");
      return;
    }
    out.append("Next steps:\n");
    out.append(
        "  ./openmetadata-ops.sh db-tune --apply --analyze    # apply + refresh planner stats\n");
    out.append(
        "  ./openmetadata-ops.sh db-tune --apply              # apply only; run analyze-tables later\n");
  }

  static String formatSettings(final Map<String, String> settings) {
    if (settings == null || settings.isEmpty()) {
      return "(default)";
    }
    return settings.entrySet().stream()
        .sorted(Map.Entry.comparingByKey())
        .map(e -> e.getKey() + "=" + e.getValue())
        .collect(Collectors.joining(", "));
  }

  static String formatBytes(final long bytes) {
    if (bytes <= 0) {
      return "0 B";
    }
    if (bytes >= GB) {
      return String.format(Locale.ROOT, "%.1f GB", bytes / (double) GB);
    }
    if (bytes >= MB) {
      return String.format(Locale.ROOT, "%.0f MB", bytes / (double) MB);
    }
    if (bytes >= KB) {
      return String.format(Locale.ROOT, "%.0f KB", bytes / (double) KB);
    }
    return bytes + " B";
  }

  private static String nullToBlank(final String value) {
    return value == null ? "" : value;
  }

  /** Concatenates each recommendation's ALTER statement, one per line, terminated by a semicolon. */
  public static String renderAlterStatements(
      final AutoTuner tuner, final List<TableRecommendation> recommendations) {
    List<String> lines = new ArrayList<>(recommendations.size());
    for (TableRecommendation rec : recommendations) {
      lines.add(tuner.buildAlterStatement(rec) + ";");
    }
    return String.join("\n", lines);
  }
}
