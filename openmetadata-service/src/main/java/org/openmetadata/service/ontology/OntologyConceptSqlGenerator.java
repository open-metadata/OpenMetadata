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
import java.util.function.BiFunction;
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
  private static final String NO_VISIBLE_TABLE =
      "has no bound table you can view among its first "
          + OntologyConceptQueryService.TABLE_BINDINGS_READ
          + " table bindings";

  private static final Pattern PLAIN_IDENTIFIER = Pattern.compile("[a-z_][a-z0-9_]*");

  /**
   * Each service type whose engine accepts the SQL generated for its dialect. Any other type is a
   * named 400 (ADR:2026-10-21-ontology-live-data-execution-is-a-collate-extension).
   */
  private static final Map<String, OntologyConceptQueryDialect> DIALECTS =
      Map.ofEntries(
          Map.entry("Postgres", OntologyConceptQueryDialect.ANSI),
          Map.entry("Timescale", OntologyConceptQueryDialect.ANSI),
          Map.entry("Redshift", OntologyConceptQueryDialect.ANSI),
          Map.entry("Trino", OntologyConceptQueryDialect.ANSI),
          Map.entry("Presto", OntologyConceptQueryDialect.ANSI),
          Map.entry("Athena", OntologyConceptQueryDialect.ANSI),
          Map.entry("Snowflake", OntologyConceptQueryDialect.SNOWFLAKE),
          Map.entry("BigQuery", OntologyConceptQueryDialect.BIGQUERY),
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
          Map.entry("Iomete", OntologyConceptQueryDialect.SPARK),
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

  /**
   * One search-around hop.
   *
   * @param inverse the live object property of the same ontology that {@code property} names as its
   *     inverse, whether or not the reader may view it, or null
   */
  public record Hop(UUID property, UUID inverse, String label, BoundConcept target) {
    /** A self-inverse names no other direction, so it never orients a join. */
    Optional<UUID> otherInverse() {
      return inverse == null || inverse.equals(property) ? Optional.empty() : Optional.of(inverse);
    }
  }

  public record Generated(
      String sql,
      OntologyConceptQueryDialect dialect,
      String service,
      String serviceType,
      List<String> tables) {}

  private record ColumnPair(List<String> left, List<String> right) {}

  private record Join(BoundTable table, List<ColumnPair> on, String label) {}

  private record Step(int position, Hop hop, BoundTable previous) {
    BadRequestException failure(final String reason, final Object... args) {
      return new BadRequestException(
          String.format("Hop %d (%s)", position, hop.label()) + String.format(reason, args));
    }
  }

  private OntologyConceptSqlGenerator() {}

  public static Generated generate(final BoundConcept root, final List<Hop> hops) {
    final BoundTable first = rootTable(root);
    final Syntax syntax = new Syntax(dialectOf(first.serviceType()));
    final List<Join> joins = joins(first, hops);
    final BoundTable last = joins.isEmpty() ? first : joins.getLast().table();
    final List<String> tables = new ArrayList<>(List.of(first.fullyQualifiedName()));
    joins.forEach(join -> tables.add(join.table().fullyQualifiedName()));
    return new Generated(
        sql(syntax, first, joins, last),
        syntax.dialect(),
        fqnParts(first, 1).getFirst(),
        first.serviceType(),
        List.copyOf(tables));
  }

  public static OntologyConceptQueryDialect dialectOf(final String serviceType) {
    final OntologyConceptQueryDialect dialect =
        serviceType == null ? null : DIALECTS.get(serviceType);
    if (dialect == null) {
      throw new BadRequestException(
          String.format("SQL generation does not support %s", serviceType));
    }
    return dialect;
  }

  private static BoundTable rootTable(final BoundConcept root) {
    final List<BoundTable> tables = listOrEmpty(root.tables());
    if (tables.isEmpty()) {
      throw new BadRequestException(String.format("Concept %s %s", root.label(), NO_VISIBLE_TABLE));
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
      final Join join = join(new Step(index + 1, hops.get(index), previous), fqnParts(first, 2));
      joins.add(join);
      previous = join.table();
    }
    return joins;
  }

  /**
   * A bound hop property follows its binding: through a foreign key on the bound column, else to
   * the other table's identifier. An unbound one whose declared inverse is bound takes the
   * converse of the join a hop over the inverse would take back. Otherwise it follows the one
   * foreign key between the tables.
   */
  private static Join join(final Step step, final List<String> database) {
    final List<BoundTable> candidates =
        candidates(step).stream().filter(table -> database.equals(fqnParts(table, 2))).toList();
    final BoundTable previous = step.previous();
    final UUID property = step.hop().property();
    final Optional<UUID> boundInverse =
        step.hop().otherInverse().filter(inverse -> isBound(previous, candidates, inverse));
    final Optional<Join> join;
    if (isBound(previous, candidates, property)) {
      join = bindingJoin(step, candidates, property, false);
    } else if (boundInverse.isPresent()) {
      join = bindingJoin(step, candidates, boundInverse.get(), true);
    } else {
      join = firstJoin(candidates, table -> onlyKeyPairs(step, table), step.hop());
    }
    return join.orElseThrow(
        () ->
            step.failure(
                ": no foreign key or object-property binding joins %s to a table bound to %s",
                step.previous().fullyQualifiedName(), step.hop().target().label()));
  }

  private static List<BoundTable> candidates(final Step step) {
    final BoundConcept target = step.hop().target();
    if (listOrEmpty(target.tables()).isEmpty()) {
      throw step.failure(" reaches concept %s, which %s", target.label(), NO_VISIBLE_TABLE);
    }
    return target.tables();
  }

  private static boolean isBound(
      final BoundTable previous, final List<BoundTable> candidates, final UUID property) {
    return previous.objectColumns().containsKey(property)
        || candidates.stream().anyMatch(table -> table.objectColumns().containsKey(property));
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

  /**
   * Follows a bound property, or takes the converse of a hop over a bound inverse from each
   * candidate back to the previous table. Every candidate's key equal to the bound column is tried
   * before any candidate's key that contains it, and both before the identifier join.
   */
  private static Optional<Join> bindingJoin(
      final Step step,
      final List<BoundTable> candidates,
      final UUID property,
      final boolean overInverse) {
    final BoundTable previous = step.previous();
    final Function<BiFunction<BoundTable, BoundTable, List<ColumnPair>>, Optional<Join>> pass =
        pairs ->
            firstJoin(
                candidates,
                table ->
                    overInverse
                        ? converse(pairs.apply(table, previous))
                        : pairs.apply(previous, table),
                step.hop());
    return pass.apply((from, to) -> equalKeyPairs(from, to, property))
        .or(() -> pass.apply((from, to) -> containingKeyPairs(step, from, to, property)))
        .or(() -> pass.apply((from, to) -> bindingPairs(from, to, property)));
  }

  /**
   * The table that binds {@code property}, {@code from} winning over {@code to} as in {@link
   * #bindingPairs}, with its bound column and its keys to the other table.
   */
  private record BoundKeys(boolean reversed, List<String> bound, List<TableConstraint> keys) {
    static Optional<BoundKeys> of(final BoundTable from, final BoundTable to, final UUID property) {
      final boolean reversed = !from.objectColumns().containsKey(property);
      final BoundTable owner = reversed ? to : from;
      return Optional.ofNullable(owner.objectColumns().get(property))
          .map(bound -> new BoundKeys(reversed, bound, foreignKeys(owner, reversed ? from : to)));
    }
  }

  private static List<ColumnPair> equalKeyPairs(
      final BoundTable from, final BoundTable to, final UUID property) {
    return BoundKeys.of(from, to, property)
        .flatMap(
            bound ->
                bound.keys().stream()
                    .filter(key -> key.getColumns().equals(bound.bound()))
                    .findFirst()
                    .map(key -> pairs(key, bound.reversed())))
        .orElse(List.of());
  }

  /** The one key that contains the bound column orients and joins on all of its columns. */
  private static List<ColumnPair> containingKeyPairs(
      final Step step, final BoundTable from, final BoundTable to, final UUID property) {
    final BoundKeys found = BoundKeys.of(from, to, property).orElse(null);
    if (found == null || found.bound().size() != 1) {
      return List.of();
    }
    final String column = found.bound().getFirst();
    final List<TableConstraint> containing =
        found.keys().stream().filter(key -> key.getColumns().contains(column)).toList();
    if (containing.size() > 1) {
      throw step.failure(
          ": %s is in several foreign keys between %s and %s",
          column,
          step.previous().fullyQualifiedName(),
          (from == step.previous() ? to : from).fullyQualifiedName());
    }
    return containing.isEmpty() ? List.of() : pairs(containing.getFirst(), found.reversed());
  }

  private static BadRequestException severalKeys(final Step step, final BoundTable candidate) {
    return step.failure(
        ": several foreign keys join %s and %s; bind the %s property to one of their columns",
        step.previous().fullyQualifiedName(), candidate.fullyQualifiedName(), step.hop().label());
  }

  private static List<ColumnPair> onlyKeyPairs(final Step step, final BoundTable candidate) {
    final List<TableConstraint> outgoing = foreignKeys(step.previous(), candidate);
    final boolean toItself =
        candidate.fullyQualifiedName().equals(step.previous().fullyQualifiedName());
    // A key from a table to itself is both outgoing and incoming; count it once.
    final List<TableConstraint> incoming =
        toItself ? List.of() : foreignKeys(candidate, step.previous());
    if (outgoing.size() + incoming.size() > 1) {
      throw severalKeys(step, candidate);
    }
    // The property and its inverse read the key in opposite directions, and neither says which.
    if (toItself && !outgoing.isEmpty() && step.hop().otherInverse().isPresent()) {
      final TableConstraint key = outgoing.getFirst();
      throw step.failure(
          ": the foreign key from %s to %s joins %s to itself in either direction;"
              + " bind the %s property or its inverse to %s%s",
          String.join(", ", key.getColumns()),
          pairs(key, false).stream()
              .map(pair -> String.join(".", pair.right()))
              .collect(Collectors.joining(", ")),
          candidate.fullyQualifiedName(),
          step.hop().label(),
          key.getColumns().size() > 1 ? "one of " : "",
          String.join(", ", key.getColumns()));
    }
    return outgoing.isEmpty()
        ? incoming.stream().findFirst().map(key -> pairs(key, true)).orElse(List.of())
        : pairs(outgoing.getFirst(), false);
  }

  private static List<TableConstraint> foreignKeys(
      final BoundTable owner, final BoundTable referred) {
    return listOrEmpty(owner.constraints()).stream()
        .filter(
            constraint ->
                constraint.getConstraintType() == TableConstraint.ConstraintType.FOREIGN_KEY)
        .filter(constraint -> refersTo(constraint, referred.fullyQualifiedName()))
        .toList();
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
                      FullyQualifiedName.unquoteName(
                          FullyQualifiedName.getColumnName(
                              constraint.getReferredColumns().get(index))));
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

  private static List<ColumnPair> converse(final List<ColumnPair> pairs) {
    return pairs.stream().map(pair -> new ColumnPair(pair.right(), pair.left())).toList();
  }

  private static String sql(
      final Syntax syntax, final BoundTable first, final List<Join> joins, final BoundTable last) {
    final String lastAlias = joins.isEmpty() ? null : alias(joins.size());
    final List<String> lines = new ArrayList<>();
    lines.add(syntax.select() + " " + selectList(syntax, last, lastAlias));
    lines.add("FROM " + tableName(syntax, first) + (joins.isEmpty() ? "" : " " + alias(0)));
    IntStream.range(0, joins.size())
        .forEach(index -> lines.add(joinLine(syntax, joins.get(index), index + 1)));
    syntax.limit().ifPresent(lines::add);
    return String.join("\n", lines);
  }

  private static String selectList(
      final Syntax syntax, final BoundTable table, final String alias) {
    final Set<List<String>> columns = new LinkedHashSet<>(table.columns());
    if (columns.isEmpty()) {
      return alias == null ? "*" : alias + ".*";
    }
    return columns.stream()
        .map(path -> syntax.column(alias, path))
        .collect(Collectors.joining(", "));
  }

  private static String joinLine(final Syntax syntax, final Join join, final int index) {
    final String on =
        join.on().stream()
            .map(
                pair ->
                    syntax.column(alias(index - 1), pair.left())
                        + " = "
                        + syntax.column(alias(index), pair.right()))
            .collect(Collectors.joining(" AND "));
    final String line =
        "JOIN " + tableName(syntax, join.table()) + " " + alias(index) + " ON " + on;
    final String label = comment(join.label());
    return label.isEmpty() ? line : line + " -- " + label;
  }

  private static String comment(final String label) {
    return label == null ? "" : label.replaceAll("\\p{Cntrl}", " ").strip();
  }

  private static String alias(final int index) {
    return "t" + index;
  }

  private static String tableName(final Syntax syntax, final BoundTable table) {
    final String[] parts = FullyQualifiedName.split(table.fullyQualifiedName());
    return syntax.identifier(FullyQualifiedName.unquoteName(parts[parts.length - 2]))
        + "."
        + syntax.identifier(FullyQualifiedName.unquoteName(parts[parts.length - 1]));
  }

  /** The first {@code count} unquoted FQN parts: 1 is the service, 2 its database too. */
  private static List<String> fqnParts(final BoundTable table, final int count) {
    return List.of(FullyQualifiedName.split(table.fullyQualifiedName())).subList(0, count).stream()
        .map(FullyQualifiedName::unquoteName)
        .toList();
  }

  private record Syntax(OntologyConceptQueryDialect dialect) {
    String select() {
      return dialect == OntologyConceptQueryDialect.TSQL ? "SELECT TOP " + ROW_LIMIT : "SELECT";
    }

    Optional<String> limit() {
      return dialect == OntologyConceptQueryDialect.TSQL
          ? Optional.empty()
          : Optional.of("LIMIT " + ROW_LIMIT);
    }

    String column(final String alias, final List<String> path) {
      final String quoted = path.stream().map(this::identifier).collect(Collectors.joining("."));
      return alias == null ? quoted : alias + "." + quoted;
    }

    /**
     * Quoting never changes how the backtick and bracket dialects resolve a name, so they quote
     * all. Snowflake's connector stores names in the case Snowflake reports, so the quoted stored
     * name always resolves to the ingested object, while an unquoted lowercase name folds to upper
     * case. The ANSI engines store and fold names in lowercase, so they quote only a name that
     * lowercase folding or a reserved word would misread.
     */
    String identifier(final String name) {
      return switch (dialect) {
        case TSQL -> "[" + name.replace("]", "]]") + "]";
        case BIGQUERY -> "`" + name.replace("\\", "\\\\").replace("`", "\\`") + "`";
        case MYSQL, SPARK -> "`" + name.replace("`", "``") + "`";
        case SNOWFLAKE -> doubleQuoted(name);
        case ANSI -> readsPlain(name) ? name : doubleQuoted(name);
      };
    }

    private static boolean readsPlain(final String name) {
      return PLAIN_IDENTIFIER.matcher(name).matches()
          && !OntologySqlReservedWords.ANSI.contains(name);
    }

    private static String doubleQuoted(final String name) {
      return "\"" + name.replace("\"", "\"\"") + "\"";
    }
  }
}
