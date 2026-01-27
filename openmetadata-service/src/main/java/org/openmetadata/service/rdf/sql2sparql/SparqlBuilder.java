package org.openmetadata.service.rdf.sql2sparql;

import java.util.*;
import lombok.extern.slf4j.Slf4j;
import org.apache.calcite.sql.*;
import org.apache.calcite.sql.fun.SqlStdOperatorTable;
import org.apache.calcite.sql.util.SqlVisitor;
import org.openmetadata.service.exception.BadRequestException;

/**
 * Builds SPARQL queries from SQL AST nodes using the visitor pattern. Supports nested/structured
 * fields (votes.upVotes, changeDescription.fieldsUpdated), property paths for transitive queries,
 * and PROV-O vocabulary for lineage.
 */
@Slf4j
public class SparqlBuilder implements SqlVisitor<Void> {

  private final SqlMappingContext mappingContext;
  private final StringBuilder whereClause = new StringBuilder();
  private final StringBuilder filterClause = new StringBuilder();
  private final StringBuilder optionalClause = new StringBuilder();
  private final Map<String, String> tableAliases = new HashMap<>();
  private final Set<String> projectedVars = new LinkedHashSet<>();
  private final Set<String> usedVars = new HashSet<>();
  private final Map<String, String> nestedVarMap = new HashMap<>();

  private String currentTable;
  private String currentAlias;
  private int varCounter = 0;
  private String orderByClause = "";
  private String limitClause = "";
  private boolean useDistinct = false;

  public SparqlBuilder(SqlMappingContext mappingContext) {
    this.mappingContext = mappingContext;
  }

  public SparqlBuilder withDistinct() {
    this.useDistinct = true;
    return this;
  }

  public String build() {
    StringBuilder sparql = new StringBuilder();
    sparql.append(mappingContext.getPrefixDeclarations()).append("\n");
    sparql.append("SELECT ");
    if (useDistinct) {
      sparql.append("DISTINCT ");
    }
    if (projectedVars.isEmpty()) {
      sparql.append("*");
    } else {
      sparql.append(String.join(" ", projectedVars));
    }
    sparql.append("\nWHERE {\n");
    sparql.append(whereClause);

    if (optionalClause.length() > 0) {
      sparql.append(optionalClause);
    }

    if (filterClause.length() > 0) {
      sparql.append("\n  FILTER (").append(filterClause).append(")");
    }

    sparql.append("\n}\n");

    if (!orderByClause.isEmpty()) {
      sparql.append(orderByClause).append("\n");
    }
    if (!limitClause.isEmpty()) {
      sparql.append(limitClause).append("\n");
    }

    return sparql.toString();
  }

  @Override
  public Void visit(SqlCall call) {
    if (call instanceof SqlSelect) {
      visitSelect((SqlSelect) call);
    } else if (call instanceof SqlJoin) {
      visitJoin((SqlJoin) call);
    } else if (call.getOperator() == SqlStdOperatorTable.EQUALS) {
      visitEquals(call);
    } else if (call.getOperator() == SqlStdOperatorTable.LIKE) {
      visitLike(call);
    } else if (call.getOperator() == SqlStdOperatorTable.AND) {
      visitAnd(call);
    } else {
      LOG.warn("Unsupported SQL operator: {}", call.getOperator());
    }
    return null;
  }

  private void visitSelect(SqlSelect select) {
    if (select.getFrom() != null) {
      select.getFrom().accept(this);
    }

    SqlNodeList selectList = select.getSelectList();
    if (selectList != null) {
      for (SqlNode node : selectList) {
        if (node instanceof SqlIdentifier) {
          SqlIdentifier id = (SqlIdentifier) node;
          processProjection(id);
        }
      }
    }

    if (select.getWhere() != null) {
      select.getWhere().accept(this);
    }

    if (select.getOrderList() != null) {
      processOrderBy(select.getOrderList());
    }

    if (select.getFetch() != null) {
      processLimit(select.getFetch());
    }
  }

  private void visitJoin(SqlJoin join) {
    join.getLeft().accept(this);
    String leftTable = currentTable;
    String leftAlias = currentAlias;

    join.getRight().accept(this);
    String rightTable = currentTable;
    String rightAlias = currentAlias;

    if (join.getCondition() != null) {
      processJoinCondition(join.getCondition(), leftAlias, rightAlias);
    }
  }

  private void visitEquals(SqlCall call) {
    SqlNode left = call.operand(0);
    SqlNode right = call.operand(1);

    if (left instanceof SqlIdentifier && right instanceof SqlLiteral) {
      SqlIdentifier id = (SqlIdentifier) left;
      SqlLiteral literal = (SqlLiteral) right;

      String columnName = extractColumnName(id);
      String tableAlias = extractTableAlias(id);

      SqlMappingContext.TableMapping tableMapping = getTableMapping(tableAlias);
      SqlMappingContext.ColumnMapping columnMapping =
          tableMapping
              .getColumnMapping(columnName)
              .orElseThrow(() -> new BadRequestException("Unknown column: " + columnName));

      String var = getOrCreateVar(tableAlias);

      if (filterClause.length() > 0) {
        filterClause.append(" && ");
      }
      filterClause
          .append("?")
          .append(var)
          .append("_")
          .append(columnName)
          .append(" = \"")
          .append(literal.toValue())
          .append("\"");
    }
  }

  private void visitLike(SqlCall call) {
    SqlNode left = call.operand(0);
    SqlNode right = call.operand(1);

    if (left instanceof SqlIdentifier && right instanceof SqlLiteral) {
      SqlIdentifier id = (SqlIdentifier) left;
      SqlLiteral literal = (SqlLiteral) right;

      String columnName = extractColumnName(id);
      String tableAlias = extractTableAlias(id);
      String pattern = literal.toValue().toString().replace("%", ".*").replace("_", ".");

      String var = getOrCreateVar(tableAlias);

      if (filterClause.length() > 0) {
        filterClause.append(" && ");
      }
      filterClause
          .append("REGEX(?")
          .append(var)
          .append("_")
          .append(columnName)
          .append(", \"")
          .append(pattern)
          .append("\", \"i\")");
    }
  }

  private void visitAnd(SqlCall call) {
    for (SqlNode operand : call.getOperandList()) {
      operand.accept(this);
    }
  }

  @Override
  public Void visit(SqlIdentifier id) {
    if (id.names.size() == 1) {
      // Table name
      String tableName = id.names.get(0).toLowerCase();
      currentTable = tableName;
      currentAlias = tableName;
      tableAliases.put(tableName, tableName);

      SqlMappingContext.TableMapping mapping =
          mappingContext
              .getTableMapping(tableName)
              .orElseThrow(() -> new BadRequestException("Unknown table: " + tableName));

      String var = getOrCreateVar(tableName);
      whereClause
          .append("  ?")
          .append(var)
          .append(" a ")
          .append(mapping.getRdfClass())
          .append(" .\n");
    }
    return null;
  }

  @Override
  public Void visit(SqlDataTypeSpec type) {
    return null;
  }

  @Override
  public Void visit(SqlDynamicParam param) {
    return null;
  }

  @Override
  public Void visit(SqlIntervalQualifier intervalQualifier) {
    return null;
  }

  @Override
  public Void visit(SqlLiteral literal) {
    return null;
  }

  @Override
  public Void visit(SqlNodeList nodeList) {
    for (SqlNode node : nodeList) {
      node.accept(this);
    }
    return null;
  }

  private void processProjection(SqlIdentifier id) {
    String columnName = extractColumnName(id);
    String tableAlias = extractTableAlias(id);

    SqlMappingContext.TableMapping tableMapping = getTableMapping(tableAlias);

    if (columnName.contains(".")) {
      processNestedProjection(tableAlias, columnName, tableMapping);
      return;
    }

    if (tableMapping.hasNestedField(columnName)) {
      processNestedProjection(tableAlias, columnName, tableMapping);
      return;
    }

    SqlMappingContext.ColumnMapping columnMapping =
        tableMapping
            .getColumnMapping(columnName)
            .orElseThrow(() -> new BadRequestException("Unknown column: " + columnName));

    String var = getOrCreateVar(tableAlias);
    String columnVar = "?" + var + "_" + columnName;

    projectedVars.add(columnVar);
    whereClause
        .append("  ?")
        .append(var)
        .append(" ")
        .append(columnMapping.getRdfProperty())
        .append(" ")
        .append(columnVar)
        .append(" .\n");
  }

  private void processNestedProjection(
      String tableAlias, String path, SqlMappingContext.TableMapping tableMapping) {
    String[] parts = path.split("\\.", 2);
    String nestedField = parts[0];
    String subField = parts.length > 1 ? parts[1] : null;

    SqlMappingContext.NestedMapping nestedMapping =
        tableMapping
            .getNestedMapping(nestedField)
            .orElseThrow(() -> new BadRequestException("Unknown nested field: " + nestedField));

    String var = getOrCreateVar(tableAlias);
    String nestedVar = getOrCreateNestedVar(tableAlias, nestedField);

    if (!nestedVarMap.containsKey(tableAlias + "." + nestedField)) {
      whereClause
          .append("  ?")
          .append(var)
          .append(" ")
          .append(nestedMapping.getParentProperty())
          .append(" ?")
          .append(nestedVar)
          .append(" .\n");
      nestedVarMap.put(tableAlias + "." + nestedField, nestedVar);
    }

    if (subField != null) {
      SqlMappingContext.ColumnMapping fieldMapping =
          nestedMapping
              .getField(subField)
              .orElseThrow(
                  () ->
                      new BadRequestException(
                          "Unknown nested subfield: " + nestedField + "." + subField));

      String fieldVar = "?" + nestedVar + "_" + subField;
      projectedVars.add(fieldVar);
      whereClause
          .append("  ?")
          .append(nestedVar)
          .append(" ")
          .append(fieldMapping.getRdfProperty())
          .append(" ")
          .append(fieldVar)
          .append(" .\n");
    } else {
      projectedVars.add("?" + nestedVar);
    }
  }

  private String getOrCreateNestedVar(String tableAlias, String nestedField) {
    String key = tableAlias + "." + nestedField;
    if (nestedVarMap.containsKey(key)) {
      return nestedVarMap.get(key);
    }
    String var = nestedField + (++varCounter);
    nestedVarMap.put(key, var);
    return var;
  }

  private void processJoinCondition(SqlNode condition, String leftAlias, String rightAlias) {
    if (condition instanceof SqlCall) {
      SqlCall call = (SqlCall) condition;
      if (call.getOperator() == SqlStdOperatorTable.EQUALS) {
        SqlNode left = call.operand(0);
        SqlNode right = call.operand(1);

        if (left instanceof SqlIdentifier && right instanceof SqlIdentifier) {
          SqlIdentifier leftId = (SqlIdentifier) left;
          SqlIdentifier rightId = (SqlIdentifier) right;

          String leftColumn = extractColumnName(leftId);
          String rightColumn = extractColumnName(rightId);

          String leftVar = getOrCreateVar(leftAlias);
          String rightVar = getOrCreateVar(rightAlias);

          whereClause
              .append("  ?")
              .append(leftVar)
              .append(" om:")
              .append(leftColumn)
              .append(" ?")
              .append(rightVar)
              .append(" .\n");
        }
      }
    }
  }

  private void processOrderBy(SqlNodeList orderList) {
    StringBuilder orderBy = new StringBuilder("ORDER BY ");
    for (SqlNode node : orderList) {
      if (node instanceof SqlCall) {
        SqlCall call = (SqlCall) node;
        SqlNode expr = call.operand(0);
        if (expr instanceof SqlIdentifier) {
          SqlIdentifier id = (SqlIdentifier) expr;
          String columnName = extractColumnName(id);
          String tableAlias = extractTableAlias(id);
          String var = getOrCreateVar(tableAlias);

          orderBy.append("?").append(var).append("_").append(columnName).append(" ");

          if (call.getKind() == SqlKind.DESCENDING) {
            orderBy.append("DESC ");
          }
        }
      }
    }
    orderByClause = orderBy.toString().trim();
  }

  private void processLimit(SqlNode fetch) {
    if (fetch instanceof SqlLiteral) {
      SqlLiteral literal = (SqlLiteral) fetch;
      limitClause = "LIMIT " + literal.toValue();
    }
  }

  private String extractColumnName(SqlIdentifier id) {
    return id.names.get(id.names.size() - 1).toLowerCase();
  }

  private String extractTableAlias(SqlIdentifier id) {
    if (id.names.size() > 1) {
      return id.names.get(0).toLowerCase();
    }
    return currentAlias;
  }

  private SqlMappingContext.TableMapping getTableMapping(String alias) {
    String tableName = tableAliases.getOrDefault(alias, alias);
    return mappingContext
        .getTableMapping(tableName)
        .orElseThrow(() -> new BadRequestException("Unknown table: " + tableName));
  }

  private String getOrCreateVar(String tableAlias) {
    String var = "var" + tableAlias;
    if (!usedVars.contains(var)) {
      var = "var" + (++varCounter);
      usedVars.add(var);
    }
    return var;
  }
}
