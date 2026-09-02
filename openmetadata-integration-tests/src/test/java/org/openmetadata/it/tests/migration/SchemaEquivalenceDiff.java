/*
 *  Copyright 2021 Collate
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
package org.openmetadata.it.tests.migration;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.openmetadata.it.tests.migration.BaselineScratchSupport.ScratchDatabase;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * Structural + content comparison of two databases in the same container: tables, columns,
 * indexes, foreign keys, check constraints, sequences, and the full row content of seeded tables
 * (with volatile values — UUIDs, timestamps, epoch millis — masked, since Java data migrations
 * generate them at install time).
 */
class SchemaEquivalenceDiff {

  private static final Pattern UUID_PATTERN =
      Pattern.compile(
          "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");
  private static final Pattern ISO_TIMESTAMP_PATTERN =
      Pattern.compile("\\d{4}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?");
  private static final Pattern EPOCH_MILLIS_PATTERN = Pattern.compile("\\b1[6-9]\\d{11}\\b");
  private static final int MAX_REPORTED_LINES = 40;

  /**
   * Rows here are created by the application at startup, not by migrations, so they are compared
   * for schema but not for content. Each entry names the code that creates them:
   *
   * <ul>
   *   <li>{@code openmetadata_settings} — {@code SettingsCache.createDefaultConfiguration}
   *   <li>{@code index_mapping_versions} — stamped by the search index-creation path; freezing
   *       these would actively lie about which mapping version an index is on
   *   <li>{@code di_chart_entity} — {@code DataInsightSystemChartResource.initialize}, from the
   *       maintained {@code json/data/dataInsight/custom} seed resources
   *   <li>{@code policy_entity}, {@code role_entity}, {@code workflow_definition_entity},
   *       {@code event_subscription_entity}, {@code doc_store}, {@code task_form_schema} —
   *       {@code initSeedDataFromResources} on the matching resource
   * </ul>
   */
  private static final Set<String> APPLICATION_SEEDED_TABLES =
      Set.of(
          "openmetadata_settings",
          "index_mapping_versions",
          "di_chart_entity",
          "policy_entity",
          "role_entity",
          "workflow_definition_entity",
          "event_subscription_entity",
          "doc_store",
          "task_form_schema");

  private final ScratchDatabase reference;
  private final ScratchDatabase candidate;
  private final ConnectionType connectionType;
  private final Map<String, String> facetDifferences = new LinkedHashMap<>();

  SchemaEquivalenceDiff(
      ScratchDatabase reference, ScratchDatabase candidate, ConnectionType connectionType) {
    this.reference = reference;
    this.candidate = candidate;
    this.connectionType = connectionType;
  }

  boolean isEquivalent() {
    compareFacet("tables", this::describeTables);
    compareFacet("columns", this::describeColumns);
    compareFacet("indexes", this::describeIndexes);
    compareFacet("foreign-keys", this::describeForeignKeys);
    compareFacet("check-constraints", this::describeCheckConstraints);
    compareFacet("sequences", this::describeSequences);
    compareFacet("row-content", this::describeRowContent);
    return facetDifferences.isEmpty();
  }

  String report() {
    StringBuilder result = new StringBuilder("Baseline install diverges from chain install:\n");
    facetDifferences.forEach(
        (facet, difference) ->
            result.append("== ").append(facet).append(" ==\n").append(difference));
    return result.toString();
  }

  private void compareFacet(
      String name, java.util.function.Function<ScratchDatabase, List<String>> describe) {
    List<String> referenceLines = filtered(describe.apply(reference));
    List<String> candidateLines = filtered(describe.apply(candidate));
    String difference = diffLines(referenceLines, candidateLines);
    if (!difference.isEmpty()) {
      facetDifferences.put(name, difference);
    }
  }

  private List<String> filtered(List<String> lines) {
    return lines.stream()
        .filter(line -> !BaselineScratchSupport.isExcludedFromBaseline(line.split("\\|", 2)[0]))
        .map(this::maskVolatile)
        .sorted()
        .toList();
  }

  private String maskVolatile(String line) {
    String result = UUID_PATTERN.matcher(line).replaceAll("<uuid>");
    result = ISO_TIMESTAMP_PATTERN.matcher(result).replaceAll("<timestamp>");
    result = EPOCH_MILLIS_PATTERN.matcher(result).replaceAll("<epoch>");
    return result;
  }

  private String diffLines(List<String> referenceLines, List<String> candidateLines) {
    StringBuilder result = new StringBuilder();
    appendMissing(
        result, "chain-only (missing from baseline install): ", referenceLines, candidateLines);
    appendMissing(
        result, "baseline-only (extra vs chain install): ", candidateLines, referenceLines);
    return result.toString();
  }

  private void appendMissing(
      StringBuilder out, String label, List<String> source, List<String> other) {
    List<String> missing = new ArrayList<>(source);
    missing.removeAll(other);
    missing.stream()
        .limit(MAX_REPORTED_LINES)
        .forEach(line -> out.append(label).append(line).append('\n'));
    if (missing.size() > MAX_REPORTED_LINES) {
      out.append(label)
          .append("... and ")
          .append(missing.size() - MAX_REPORTED_LINES)
          .append(" more\n");
    }
  }

  private List<String> describeTables(ScratchDatabase database) {
    String query =
        mysql()
            ? "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'"
            : "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'";
    return database.jdbi().withHandle(h -> h.createQuery(query).mapTo(String.class).list());
  }

  /**
   * Column order is compared as a gap-free rank, not the raw ordinal: historical DROP COLUMNs
   * leave attnum gaps on a chain-installed Postgres database that a freshly-created baseline
   * table legitimately does not reproduce.
   */
  private List<String> describeColumns(ScratchDatabase database) {
    String query =
        mysql()
            ? """
              SELECT CONCAT_WS('|', table_name, column_name,
                ROW_NUMBER() OVER (PARTITION BY table_name ORDER BY ordinal_position),
                column_type, is_nullable, IFNULL(column_default, '<none>'), extra,
                IFNULL(collation_name, '<none>'), IFNULL(generation_expression, ''))
              FROM information_schema.columns WHERE table_schema = DATABASE()
              """
            : """
              SELECT concat_ws('|', table_name, column_name,
                row_number() OVER (PARTITION BY table_name ORDER BY ordinal_position),
                data_type, coalesce(character_maximum_length::text, '-'), is_nullable,
                coalesce(column_default, '<none>'), coalesce(generation_expression, ''), udt_name)
              FROM information_schema.columns WHERE table_schema = current_schema()
              """;
    return database.jdbi().withHandle(h -> h.createQuery(query).mapTo(String.class).list());
  }

  private List<String> describeIndexes(ScratchDatabase database) {
    String query =
        mysql()
            ? """
              SELECT CONCAT_WS('|', table_name, index_name, non_unique, index_type,
                GROUP_CONCAT(column_name ORDER BY seq_in_index),
                GROUP_CONCAT(IFNULL(sub_part, '-') ORDER BY seq_in_index),
                GROUP_CONCAT(IFNULL(expression, '-') ORDER BY seq_in_index))
              FROM information_schema.statistics WHERE table_schema = DATABASE()
              GROUP BY table_name, index_name, non_unique, index_type
              """
            : """
              SELECT concat_ws('|', tablename, indexname, regexp_replace(indexdef, '\\s+', ' ', 'g'))
              FROM pg_indexes WHERE schemaname = current_schema()
              """;
    return database.jdbi().withHandle(h -> h.createQuery(query).mapTo(String.class).list());
  }

  private List<String> describeForeignKeys(ScratchDatabase database) {
    String query =
        mysql()
            ? """
              SELECT CONCAT_WS('|', rc.table_name, rc.constraint_name, rc.referenced_table_name,
                rc.update_rule, rc.delete_rule,
                GROUP_CONCAT(kcu.column_name ORDER BY kcu.ordinal_position))
              FROM information_schema.referential_constraints rc
              JOIN information_schema.key_column_usage kcu
                ON kcu.constraint_name = rc.constraint_name
               AND kcu.constraint_schema = rc.constraint_schema
               AND kcu.table_name = rc.table_name
              WHERE rc.constraint_schema = DATABASE()
              GROUP BY rc.table_name, rc.constraint_name, rc.referenced_table_name,
                rc.update_rule, rc.delete_rule
              """
            : """
              SELECT concat_ws('|', tc.table_name, tc.constraint_name, ccu.table_name,
                rc.update_rule, rc.delete_rule,
                (SELECT string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position)
                   FROM information_schema.key_column_usage kcu
                  WHERE kcu.constraint_name = tc.constraint_name
                    AND kcu.constraint_schema = tc.constraint_schema))
              FROM information_schema.table_constraints tc
              JOIN information_schema.referential_constraints rc
                ON rc.constraint_name = tc.constraint_name
               AND rc.constraint_schema = tc.constraint_schema
              JOIN information_schema.constraint_column_usage ccu
                ON ccu.constraint_name = tc.constraint_name
               AND ccu.constraint_schema = tc.constraint_schema
              WHERE tc.constraint_schema = current_schema() AND tc.constraint_type = 'FOREIGN KEY'
              GROUP BY tc.table_name, tc.constraint_name, ccu.table_name, rc.update_rule,
                rc.delete_rule, tc.constraint_schema
              """;
    return database.jdbi().withHandle(h -> h.createQuery(query).mapTo(String.class).list());
  }

  private List<String> describeCheckConstraints(ScratchDatabase database) {
    String query =
        mysql()
            ? """
              SELECT CONCAT_WS('|', tc.table_name, cc.constraint_name, cc.check_clause)
              FROM information_schema.check_constraints cc
              JOIN information_schema.table_constraints tc
                ON tc.constraint_name = cc.constraint_name
               AND tc.constraint_schema = cc.constraint_schema
              WHERE cc.constraint_schema = DATABASE()
              """
            : """
              SELECT concat_ws('|', tc.table_name, cc.constraint_name,
                regexp_replace(cc.check_clause, '\\s+', ' ', 'g'))
              FROM information_schema.check_constraints cc
              JOIN information_schema.table_constraints tc
                ON tc.constraint_name = cc.constraint_name
               AND tc.constraint_schema = cc.constraint_schema
              WHERE cc.constraint_schema = current_schema()
                AND cc.constraint_name NOT LIKE '%_not_null'
              """;
    return database.jdbi().withHandle(h -> h.createQuery(query).mapTo(String.class).list());
  }

  private List<String> describeSequences(ScratchDatabase database) {
    List<String> result = List.of();
    if (!mysql()) {
      result =
          candidateSafeQuery(
              database,
              "SELECT concat_ws('|', sequence_name) FROM information_schema.sequences WHERE sequence_schema = current_schema()");
    }
    return result;
  }

  private List<String> candidateSafeQuery(ScratchDatabase database, String query) {
    return database.jdbi().withHandle(h -> h.createQuery(query).mapTo(String.class).list());
  }

  /**
   * Reuses the deterministic INSERT rendering so both sides serialize rows identically.
   *
   * <p>Tables the application populates itself at boot are out of scope — the baseline replaces the
   * migration chain, not the seeding the server does on every start, so the chain database having
   * those rows a few seconds earlier is not a divergence. Any table NOT on that list which differs
   * is a real finding: it means a pre-2.0 migration produced state nothing else recreates.
   */
  private List<String> describeRowContent(ScratchDatabase database) {
    BaselineDataDump dump = new BaselineDataDump(database, connectionType);
    List<String> tables =
        describeTables(database).stream()
            .filter(table -> !BaselineScratchSupport.isExcludedFromBaseline(table))
            .filter(table -> !APPLICATION_SEEDED_TABLES.contains(table.toLowerCase(Locale.ROOT)))
            .sorted()
            .toList();
    List<String> result = new ArrayList<>();
    for (String table : tables) {
      for (String insert : dump.render(List.of(table)).split("\n")) {
        if (!insert.isBlank()) {
          result.add(table + "|" + insert);
        }
      }
    }
    return result;
  }

  private boolean mysql() {
    return connectionType == ConnectionType.MYSQL;
  }
}
