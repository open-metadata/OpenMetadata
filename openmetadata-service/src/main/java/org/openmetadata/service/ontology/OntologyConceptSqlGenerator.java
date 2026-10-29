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

package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.openmetadata.schema.api.data.OntologyConceptQueryDialect;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Builds the SELECT a concept's table bindings describe, with one JOIN per search-around hop. It
 * reads no database: callers pass the bound tables the reader may view
 * (ADR:2026-10-21-ontology-live-data-execution-is-a-collate-extension).
 */
public final class OntologyConceptSqlGenerator {
  public static final int ROW_LIMIT = 50;

  private static final Pattern PLAIN_IDENTIFIER = Pattern.compile("[a-z_][a-z0-9_]*");
  private static final Set<String> RESERVED =
      Set.of(
          "all",
          "and",
          "any",
          "as",
          "asc",
          "between",
          "by",
          "case",
          "check",
          "column",
          "create",
          "cross",
          "current",
          "date",
          "default",
          "delete",
          "desc",
          "distinct",
          "drop",
          "else",
          "end",
          "exists",
          "false",
          "for",
          "foreign",
          "from",
          "full",
          "grant",
          "group",
          "having",
          "in",
          "inner",
          "insert",
          "interval",
          "into",
          "is",
          "join",
          "key",
          "left",
          "like",
          "limit",
          "natural",
          "not",
          "null",
          "of",
          "offset",
          "on",
          "or",
          "order",
          "outer",
          "partition",
          "primary",
          "range",
          "references",
          "right",
          "row",
          "rows",
          "select",
          "set",
          "table",
          "then",
          "time",
          "timestamp",
          "to",
          "true",
          "union",
          "unique",
          "update",
          "user",
          "using",
          "values",
          "when",
          "where",
          "window",
          "with");
  private static final Map<String, OntologyConceptQueryDialect> DIALECTS =
      Map.ofEntries(
          Map.entry("BigQuery", OntologyConceptQueryDialect.BIGQUERY),
          Map.entry("Snowflake", OntologyConceptQueryDialect.SNOWFLAKE),
          Map.entry("Mysql", OntologyConceptQueryDialect.MYSQL),
          Map.entry("MariaDB", OntologyConceptQueryDialect.MYSQL),
          Map.entry("SingleStore", OntologyConceptQueryDialect.MYSQL),
          Map.entry("Doris", OntologyConceptQueryDialect.MYSQL),
          Map.entry("StarRocks", OntologyConceptQueryDialect.MYSQL),
          Map.entry("Clickhouse", OntologyConceptQueryDialect.MYSQL),
          Map.entry("Databricks", OntologyConceptQueryDialect.SPARK),
          Map.entry("UnityCatalog", OntologyConceptQueryDialect.SPARK),
          Map.entry("Hive", OntologyConceptQueryDialect.SPARK),
          Map.entry("Impala", OntologyConceptQueryDialect.SPARK),
          Map.entry("Mssql", OntologyConceptQueryDialect.TSQL),
          Map.entry("AzureSQL", OntologyConceptQueryDialect.TSQL),
          Map.entry("Synapse", OntologyConceptQueryDialect.TSQL),
          Map.entry("MicrosoftFabric", OntologyConceptQueryDialect.TSQL));

  /**
   * One table bound to one concept, as that concept binds it.
   *
   * @param columns every bound column path, in binding order
   * @param objectColumns the column each object property is bound to, a foreign key to the target
   *     concept's identifier column
   * @param identifier the column bound to the concept's identifier property, or empty
   */
  public record BoundTable(
      String fullyQualifiedName,
      String serviceType,
      List<List<String>> columns,
      Map<UUID, List<String>> objectColumns,
      List<String> identifier,
      List<TableConstraint> constraints) {}

  /** A concept and the tables it binds that the reader may view, in asset id order. */
  public record BoundConcept(String label, List<BoundTable> tables) {}

  public record Hop(UUID property, String label, BoundConcept target) {}

  public record Generated(
      String sql,
      OntologyConceptQueryDialect dialect,
      String service,
      String serviceType,
      List<String> tables) {}

  private record ColumnPair(List<String> left, List<String> right) {}

  private record Join(BoundTable table, List<ColumnPair> on, String label) {}

  private OntologyConceptSqlGenerator() {}

  public static Generated generate(final BoundConcept root, final List<Hop> hops) {
    final BoundTable first = rootTable(root);
    final List<Join> joins = joins(first, hops);
    final BoundTable last = joins.isEmpty() ? first : joins.getLast().table();
    final OntologyConceptQueryDialect dialect = dialectOf(first.serviceType());
    final List<String> tables = new ArrayList<>(List.of(first.fullyQualifiedName()));
    joins.forEach(join -> tables.add(join.table().fullyQualifiedName()));
    return new Generated(
        sql(new Quoter(dialect), first, joins, last),
        dialect,
        serviceOf(first),
        first.serviceType(),
        List.copyOf(tables));
  }

  public static OntologyConceptQueryDialect dialectOf(final String serviceType) {
    return DIALECTS.getOrDefault(serviceType, OntologyConceptQueryDialect.ANSI);
  }

  private static BoundTable rootTable(final BoundConcept root) {
    final List<BoundTable> tables = listOrEmpty(root.tables());
    if (tables.isEmpty()) {
      throw new BadRequestException(
          String.format("Concept %s has no bound table you can view", root.label()));
    }
    return tables.stream()
        .filter(table -> !table.columns().isEmpty())
        .findFirst()
        .orElse(tables.getFirst());
  }

  private static List<Join> joins(final BoundTable first, final List<Hop> hops) {
    final List<Join> joins = new ArrayList<>();
    BoundTable previous = first;
    for (int index = 0; index < hops.size(); index++) {
      final Join join = join(previous, hops.get(index), index + 1, serviceOf(first));
      joins.add(join);
      previous = join.table();
    }
    return joins;
  }

  private static Join join(
      final BoundTable previous, final Hop hop, final int position, final String service) {
    final BoundConcept target = hop.target();
    if (listOrEmpty(target.tables()).isEmpty()) {
      throw new BadRequestException(
          String.format(
              "Hop %d (%s) reaches concept %s, which has no bound table you can view",
              position, hop.label(), target.label()));
    }
    final List<BoundTable> candidates =
        target.tables().stream().filter(table -> service.equals(serviceOf(table))).toList();
    return firstJoin(candidates, table -> foreignKeyPairs(previous, table), hop)
        .or(
            () ->
                firstJoin(candidates, table -> bindingPairs(previous, table, hop.property()), hop))
        .orElseThrow(
            () ->
                new BadRequestException(
                    String.format(
                        "Hop %d (%s): no foreign key or object-property binding joins %s to a table bound to %s",
                        position, hop.label(), previous.fullyQualifiedName(), target.label())));
  }

  private static Optional<Join> firstJoin(
      final List<BoundTable> candidates,
      final Function<BoundTable, List<ColumnPair>> pairs,
      final Hop hop) {
    for (final BoundTable candidate : candidates) {
      final List<ColumnPair> on = pairs.apply(candidate);
      if (!on.isEmpty()) {
        return Optional.of(new Join(candidate, on, hop.label()));
      }
    }
    return Optional.empty();
  }

  private static List<ColumnPair> foreignKeyPairs(final BoundTable from, final BoundTable to) {
    final List<ColumnPair> outgoing = referencing(from, to, false);
    return outgoing.isEmpty() ? referencing(to, from, true) : outgoing;
  }

  private static List<ColumnPair> referencing(
      final BoundTable owner, final BoundTable referred, final boolean reversed) {
    return listOrEmpty(owner.constraints()).stream()
        .filter(
            constraint ->
                constraint.getConstraintType() == TableConstraint.ConstraintType.FOREIGN_KEY)
        .filter(constraint -> refersTo(constraint, referred.fullyQualifiedName()))
        .findFirst()
        .map(constraint -> pairs(constraint, reversed))
        .orElse(List.of());
  }

  private static boolean refersTo(final TableConstraint constraint, final String table) {
    final List<String> referred = listOrEmpty(constraint.getReferredColumns());
    return !referred.isEmpty()
        && referred.size() == listOrEmpty(constraint.getColumns()).size()
        && referred.stream().allMatch(column -> table.equals(tableOf(column)));
  }

  private static String tableOf(final String column) {
    return FullyQualifiedName.split(column).length < 5
        ? ""
        : FullyQualifiedName.getTableFQN(column);
  }

  private static List<ColumnPair> pairs(final TableConstraint constraint, final boolean reversed) {
    return IntStream.range(0, constraint.getColumns().size())
        .mapToObj(
            index -> {
              final List<String> local = List.of(constraint.getColumns().get(index));
              final List<String> remote =
                  List.of(
                      FullyQualifiedName.getColumnName(constraint.getReferredColumns().get(index)));
              return reversed ? new ColumnPair(remote, local) : new ColumnPair(local, remote);
            })
        .toList();
  }

  private static List<ColumnPair> bindingPairs(
      final BoundTable from, final BoundTable to, final UUID property) {
    final List<String> outgoing = from.objectColumns().get(property);
    if (outgoing != null && !to.identifier().isEmpty()) {
      return List.of(new ColumnPair(outgoing, to.identifier()));
    }
    final List<String> incoming = to.objectColumns().get(property);
    return incoming != null && !from.identifier().isEmpty()
        ? List.of(new ColumnPair(from.identifier(), incoming))
        : List.of();
  }

  private static String sql(
      final Quoter quoter, final BoundTable first, final List<Join> joins, final BoundTable last) {
    final String lastAlias = joins.isEmpty() ? null : alias(joins.size());
    final List<String> lines = new ArrayList<>();
    lines.add("SELECT " + selectList(quoter, last, lastAlias));
    lines.add("FROM " + tableName(quoter, first) + (joins.isEmpty() ? "" : " " + alias(0)));
    IntStream.range(0, joins.size())
        .forEach(index -> lines.add(joinLine(quoter, joins.get(index), index + 1)));
    lines.add("LIMIT " + ROW_LIMIT);
    return String.join("\n", lines);
  }

  private static String selectList(
      final Quoter quoter, final BoundTable table, final String alias) {
    final Set<List<String>> columns = new LinkedHashSet<>(table.columns());
    if (columns.isEmpty()) {
      return alias == null ? "*" : alias + ".*";
    }
    return columns.stream()
        .map(path -> quoter.column(alias, path))
        .collect(Collectors.joining(", "));
  }

  private static String joinLine(final Quoter quoter, final Join join, final int index) {
    final String on =
        join.on().stream()
            .map(
                pair ->
                    quoter.column(alias(index - 1), pair.left())
                        + " = "
                        + quoter.column(alias(index), pair.right()))
            .collect(Collectors.joining(" AND "));
    final String line =
        "JOIN " + tableName(quoter, join.table()) + " " + alias(index) + " ON " + on;
    final String label = comment(join.label());
    return label.isEmpty() ? line : line + " -- " + label;
  }

  private static String comment(final String label) {
    return label == null ? "" : label.replaceAll("\\p{Cntrl}", " ").strip();
  }

  private static String alias(final int index) {
    return "t" + index;
  }

  private static String tableName(final Quoter quoter, final BoundTable table) {
    final String[] parts = FullyQualifiedName.split(table.fullyQualifiedName());
    return quoter.identifier(FullyQualifiedName.unquoteName(parts[parts.length - 2]))
        + "."
        + quoter.identifier(FullyQualifiedName.unquoteName(parts[parts.length - 1]));
  }

  private static String serviceOf(final BoundTable table) {
    return FullyQualifiedName.unquoteName(FullyQualifiedName.split(table.fullyQualifiedName())[0]);
  }

  /** Quotes an identifier only when the dialect would otherwise misread it. */
  private record Quoter(OntologyConceptQueryDialect dialect) {
    String column(final String alias, final List<String> path) {
      final String quoted = path.stream().map(this::identifier).collect(Collectors.joining("."));
      return alias == null ? quoted : alias + "." + quoted;
    }

    String identifier(final String name) {
      if (PLAIN_IDENTIFIER.matcher(name).matches() && !RESERVED.contains(name)) {
        return name;
      }
      return switch (dialect) {
        case TSQL -> "[" + name.replace("]", "]]") + "]";
        case BIGQUERY -> "`" + name.replace("\\", "\\\\").replace("`", "\\`") + "`";
        case MYSQL, SPARK -> "`" + name.replace("`", "``") + "`";
        case ANSI, SNOWFLAKE -> "\"" + name.replace("\"", "\"\"") + "\"";
      };
    }
  }
}
