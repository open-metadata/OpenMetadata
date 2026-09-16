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

package org.openmetadata.service.rdf.agent;

import org.apache.jena.query.Query;
import org.apache.jena.query.SortCondition;
import org.apache.jena.sparql.expr.Expr;
import org.apache.jena.sparql.expr.ExprAggregator;
import org.apache.jena.sparql.expr.ExprFunction;
import org.apache.jena.sparql.expr.ExprFunctionOp;
import org.apache.jena.sparql.expr.ExprList;
import org.apache.jena.sparql.syntax.Element;
import org.apache.jena.sparql.syntax.ElementAssign;
import org.apache.jena.sparql.syntax.ElementBind;
import org.apache.jena.sparql.syntax.ElementDataset;
import org.apache.jena.sparql.syntax.ElementFilter;
import org.apache.jena.sparql.syntax.ElementNamedGraph;
import org.apache.jena.sparql.syntax.ElementService;
import org.apache.jena.sparql.syntax.ElementSubQuery;
import org.apache.jena.sparql.syntax.ElementUnfold;
import org.apache.jena.sparql.syntax.ElementVisitorBase;
import org.apache.jena.sparql.syntax.ElementWalker;
import org.openmetadata.schema.api.rdf.AgentSparqlErrorCode;

/**
 * Walks every place a graph pattern can hide: the WHERE clause, subqueries, and EXISTS / NOT EXISTS
 * inside FILTER, BIND, projection, GROUP BY, HAVING, and ORDER BY expressions. {@link
 * ElementWalker} does not descend into subqueries or expressions, so both are followed explicitly.
 */
final class AgentSparqlQueryInspector extends ElementVisitorBase {

  private AgentSparqlQueryInspector() {}

  static void inspect(final Query query) {
    new AgentSparqlQueryInspector().inspectQuery(query);
  }

  private void inspectQuery(final Query query) {
    if (query.hasDatasetDescription()) {
      throw graphSelection("FROM and FROM NAMED are not allowed");
    }
    inspectElement(query.getQueryPattern());
    query.getProject().getExprs().values().forEach(this::inspectExpr);
    query.getGroupBy().getExprs().values().forEach(this::inspectExpr);
    query.getHavingExprs().forEach(this::inspectExpr);
    query.getAggregators().forEach(this::inspectExpr);
    if (query.hasOrderBy()) {
      query.getOrderBy().stream().map(SortCondition::getExpression).forEach(this::inspectExpr);
    }
  }

  private void inspectElement(final Element element) {
    if (element != null) {
      ElementWalker.walk(element, this);
    }
  }

  private void inspectExpr(final Expr expr) {
    if (expr instanceof ExprFunctionOp patternExpr) {
      inspectElement(patternExpr.getElement());
    }
    if (expr instanceof ExprAggregator aggregatorExpr) {
      inspectExprs(aggregatorExpr.getAggregator().getExprList());
    }
    if (expr instanceof ExprFunction function) {
      function.getArgs().forEach(this::inspectExpr);
    }
  }

  private void inspectExprs(final ExprList exprs) {
    if (exprs != null) {
      exprs.forEach(this::inspectExpr);
    }
  }

  @Override
  public void visit(final ElementNamedGraph element) {
    throw graphSelection("GRAPH is not allowed");
  }

  @Override
  public void visit(final ElementDataset element) {
    throw graphSelection("Dataset selection is not allowed");
  }

  @Override
  public void visit(final ElementService element) {
    throw new AgentSparqlException(
        AgentSparqlErrorCode.FEDERATION_NOT_ALLOWED, "SERVICE federation is not allowed");
  }

  @Override
  public void visit(final ElementSubQuery element) {
    inspectQuery(element.getQuery());
  }

  @Override
  public void visit(final ElementFilter element) {
    inspectExpr(element.getExpr());
  }

  @Override
  public void visit(final ElementBind element) {
    inspectExpr(element.getExpr());
  }

  @Override
  public void visit(final ElementAssign element) {
    inspectExpr(element.getExpr());
  }

  @Override
  public void visit(final ElementUnfold element) {
    inspectExpr(element.getExpr());
  }

  private static AgentSparqlException graphSelection(final String message) {
    return new AgentSparqlException(AgentSparqlErrorCode.GRAPH_SELECTION_NOT_ALLOWED, message);
  }
}
