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
package org.openmetadata.service.aicontext;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.apache.calcite.config.Lex;
import org.apache.calcite.sql.JoinConditionType;
import org.apache.calcite.sql.SqlCall;
import org.apache.calcite.sql.SqlIdentifier;
import org.apache.calcite.sql.SqlJoin;
import org.apache.calcite.sql.SqlKind;
import org.apache.calcite.sql.SqlNode;
import org.apache.calcite.sql.SqlNodeList;
import org.apache.calcite.sql.SqlOrderBy;
import org.apache.calcite.sql.SqlSelect;
import org.apache.calcite.sql.parser.SqlParseException;
import org.apache.calcite.sql.parser.SqlParser;
import org.apache.calcite.sql.util.SqlBasicVisitor;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.aicontext.ConceptContextBuilder.ColumnField;
import org.openmetadata.service.util.FullyQualifiedName;

/** Resolves SQL identifiers conservatively against applied tables, excluding ambiguous columns. */
@Slf4j
final class MetricColumnResolver extends SqlBasicVisitor<Void> {
  private static final int MAX_IDENTIFIERS = 1000;
  private static final int MAX_EXPRESSION_CHARS = 16000;
  private static final Set<SqlKind> SORT_MODIFIERS =
      EnumSet.of(SqlKind.DESCENDING, SqlKind.NULLS_FIRST, SqlKind.NULLS_LAST);
  private final Map<List<String>, Resolution> identifiers = new LinkedHashMap<>();
  private final Map<String, List<String>> aliases = new LinkedHashMap<>();
  private final Set<List<String>> projectionAliases = new LinkedHashSet<>();
  private int queryScopes;

  private record Resolution(String columnFqn, boolean ambiguous) {}

  static MetricColumnResolver parse(String expression) {
    MetricColumnResolver resolver = new MetricColumnResolver();
    if (!nullOrEmpty(expression) && expression.length() <= MAX_EXPRESSION_CHARS) {
      SqlNode node = parseNode(expression);
      if (node != null) {
        node.accept(resolver);
      }
    }
    return resolver;
  }

  private static SqlNode parseNode(String expression) {
    SqlNode parsed = null;
    for (Lex lex : List.of(Lex.ORACLE, Lex.MYSQL, Lex.SQL_SERVER)) {
      try {
        parsed = parser(expression, lex).parseQuery();
      } catch (SqlParseException queryError) {
        try {
          parsed = parser(expression, lex).parseExpression();
        } catch (SqlParseException expressionError) {
          LOG.debug("Metric column resolution: expression is not supported by {}", lex);
        }
      }
      if (parsed != null) {
        break;
      }
    }
    return parsed;
  }

  private static SqlParser parser(String expression, Lex lex) {
    return SqlParser.create(expression, SqlParser.config().withLex(lex).withCaseSensitive(false));
  }

  @Override
  public Void visit(SqlIdentifier identifier) {
    List<String> names = normalize(identifier.names);
    if (!identifier.isStar() && identifiers.size() < MAX_IDENTIFIERS) {
      identifiers.putIfAbsent(names, new Resolution(null, false));
    }
    return null;
  }

  @Override
  public Void visit(SqlCall call) {
    if (call instanceof SqlSelect select) {
      queryScopes++;
      collectAliases(select.getFrom());
      collectProjection(select);
      Stream.of(select.getWhere(), select.getGroup(), select.getHaving())
          .filter(Objects::nonNull)
          .forEach(node -> node.accept(this));
      visitOrderList(select.getOrderList());
    } else if (call instanceof SqlOrderBy orderBy) {
      orderBy.query.accept(this);
      visitOrderList(orderBy.orderList);
    } else if (call.getKind() == SqlKind.AS) {
      call.operand(0).accept(this);
    } else {
      super.visit(call);
    }
    return null;
  }

  private void collectProjection(SqlSelect select) {
    select.getSelectList().getList().forEach(this::collectProjectionAlias);
    select.getSelectList().accept(this);
  }

  /**
   * Only ORDER BY resolves a bare name to an output alias first; WHERE, GROUP BY and HAVING
   * resolve it to the input column, so a physical column shadowed by an alias still binds there.
   */
  private void visitOrderList(SqlNodeList orderList) {
    if (orderList != null) {
      orderList.stream()
          .filter(Objects::nonNull)
          .filter(item -> !isProjectionAlias(item))
          .forEach(item -> item.accept(this));
    }
  }

  private boolean isProjectionAlias(SqlNode item) {
    SqlNode key = item;
    while (key instanceof SqlCall call && SORT_MODIFIERS.contains(call.getKind())) {
      key = call.operand(0);
    }
    return key instanceof SqlIdentifier identifier
        && identifier.isSimple()
        && projectionAliases.contains(normalize(identifier.names));
  }

  private void collectProjectionAlias(SqlNode node) {
    if (projectionAliases.size() < MAX_IDENTIFIERS
        && node instanceof SqlCall call
        && call.getKind() == SqlKind.AS
        && call.operand(1) instanceof SqlIdentifier alias) {
      projectionAliases.add(normalize(alias.names));
    }
  }

  private void collectAliases(SqlNode node) {
    if (node instanceof SqlSelect) {
      queryScopes++;
    } else if (node instanceof SqlJoin join) {
      collectAliases(join.getLeft());
      collectAliases(join.getRight());
      visitJoinCondition(join);
    } else if (node instanceof SqlCall call && aliases.size() < MAX_IDENTIFIERS) {
      if (call.getKind() == SqlKind.AS
          && call.operand(0) instanceof SqlIdentifier table
          && call.operand(1) instanceof SqlIdentifier alias) {
        aliases.put(normalize(alias.names).getLast(), normalize(table.names));
      } else {
        call.getOperandList().stream().filter(Objects::nonNull).forEach(this::collectAliases);
      }
    }
  }

  /**
   * ON predicates name input columns just like WHERE does. Relation names never reach the visitor:
   * the join's left and right sides go through {@link #collectAliases} only. USING lists are left
   * out because they name a column on both sides, which is ambiguous by construction.
   */
  private void visitJoinCondition(SqlJoin join) {
    if (join.getConditionType() == JoinConditionType.ON && join.getCondition() != null) {
      join.getCondition().accept(this);
    }
  }

  void accept(String type, EntityInterface asset) {
    List<String> assetPath =
        normalize(
            Arrays.stream(FullyQualifiedName.split(asset.getFullyQualifiedName()))
                .map(FullyQualifiedName::unquoteName)
                .toList());
    ConceptContextBuilder.columnFields(type, asset)
        .forEach(
            field ->
                identifiers.replaceAll(
                    (names, resolution) -> resolve(assetPath, field, names, resolution)));
  }

  private Resolution resolve(
      List<String> assetPath, ColumnField field, List<String> names, Resolution current) {
    Resolution result = current;
    if (matches(assetPath, field, names) && !current.ambiguous()) {
      result =
          new Resolution(
              field.fqn(), current.columnFqn() != null && !current.columnFqn().equals(field.fqn()));
    }
    return result;
  }

  /**
   * Compares identifier components rather than dot-joined strings, so the quoted {@code
   * "amount.cents"} column and the nested {@code amount.cents} field stay distinct. Any leading
   * components beyond the column path must qualify it with a suffix of the asset's FQN.
   */
  private boolean matches(List<String> assetPath, ColumnField field, List<String> names) {
    List<String> requested = expandAlias(names);
    List<String> column = normalize(field.path());
    int qualifiers = requested.size() - column.size();
    return qualifiers >= 0
        && qualifiers <= assetPath.size()
        && requested.subList(qualifiers, requested.size()).equals(column)
        && requested
            .subList(0, qualifiers)
            .equals(assetPath.subList(assetPath.size() - qualifiers, assetPath.size()));
  }

  private List<String> expandAlias(List<String> names) {
    List<String> expanded = names;
    if (names.size() > 1 && aliases.containsKey(names.getFirst())) {
      expanded = new ArrayList<>(aliases.get(names.getFirst()));
      expanded.addAll(names.subList(1, names.size()));
    }
    return expanded;
  }

  List<String> resolvedColumns() {
    // Aliases are scoped to each SELECT. Without a SQL validator, resolving through a shared
    // alias map would guess incorrectly when a subquery shadows an outer alias.
    return queryScopes > 1
        ? List.of()
        : identifiers.values().stream()
            .filter(resolution -> !resolution.ambiguous())
            .map(Resolution::columnFqn)
            .filter(Objects::nonNull)
            .distinct()
            .toList();
  }

  private static List<String> normalize(List<String> names) {
    return names.stream().map(name -> name.toLowerCase(Locale.ROOT)).toList();
  }
}
