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

package org.openmetadata.service.rdf.federation;

import java.util.function.Consumer;
import org.apache.jena.query.Query;
import org.apache.jena.query.SortCondition;
import org.apache.jena.sparql.expr.Expr;
import org.apache.jena.sparql.expr.ExprAggregator;
import org.apache.jena.sparql.expr.ExprFunction;
import org.apache.jena.sparql.expr.ExprFunctionOp;
import org.apache.jena.sparql.syntax.Element;
import org.apache.jena.sparql.syntax.ElementAssign;
import org.apache.jena.sparql.syntax.ElementBind;
import org.apache.jena.sparql.syntax.ElementExists;
import org.apache.jena.sparql.syntax.ElementFilter;
import org.apache.jena.sparql.syntax.ElementNotExists;
import org.apache.jena.sparql.syntax.ElementSubQuery;
import org.apache.jena.sparql.syntax.ElementUnfold;
import org.apache.jena.sparql.syntax.ElementVisitor;
import org.apache.jena.sparql.syntax.ElementVisitorBase;
import org.apache.jena.sparql.syntax.ElementWalker;

/**
 * Visits every graph-pattern element and every expression of a SPARQL query, including the places
 * Jena's {@link ElementWalker} does not follow: subqueries; the expressions of FILTER, BIND, LET
 * and UNFOLD; EXISTS and NOT EXISTS, both as expressions and as bare pattern elements; and the
 * projection, GROUP BY, HAVING, aggregate and ORDER BY expressions.
 *
 * <p>The engine evaluates a graph pattern wherever one of those places holds it, so every check
 * that must see each SERVICE, GRAPH or function call walks the query with this class rather than
 * following its own subset of those places.
 */
public final class SparqlQueryWalker {
  private static final Consumer<Expr> IGNORE_EXPRESSIONS = expression -> {};

  private final ElementVisitor elementVisitor;
  private final Consumer<Expr> expressionVisitor;
  private final ElementVisitor nestedPatternFollower = new NestedPatternFollower();

  private SparqlQueryWalker(
      final ElementVisitor elementVisitor, final Consumer<Expr> expressionVisitor) {
    this.elementVisitor = elementVisitor;
    this.expressionVisitor = expressionVisitor;
  }

  public static void walk(final Query query, final ElementVisitor elementVisitor) {
    walk(query, elementVisitor, IGNORE_EXPRESSIONS);
  }

  /**
   * @param elementVisitor sees every pattern element, however deeply it is nested
   * @param expressionVisitor sees every expression, each function argument as its own expression
   */
  public static void walk(
      final Query query,
      final ElementVisitor elementVisitor,
      final Consumer<Expr> expressionVisitor) {
    new SparqlQueryWalker(elementVisitor, expressionVisitor).walkQuery(query);
  }

  /** Walks a pattern that is not a query of its own, such as the WHERE clause of an update. */
  public static void walk(final Element pattern, final ElementVisitor elementVisitor) {
    new SparqlQueryWalker(elementVisitor, IGNORE_EXPRESSIONS).walkElement(pattern);
  }

  private void walkQuery(final Query query) {
    walkElement(query.getQueryPattern());
    query.getProject().getExprs().values().forEach(this::walkExpression);
    query.getGroupBy().getExprs().values().forEach(this::walkExpression);
    query.getHavingExprs().forEach(this::walkExpression);
    query.getAggregators().forEach(this::walkExpression);
    if (query.hasOrderBy()) {
      query.getOrderBy().stream().map(SortCondition::getExpression).forEach(this::walkExpression);
    }
  }

  private void walkElement(final Element element) {
    if (element != null) {
      ElementWalker.walk(element, elementVisitor, null, nestedPatternFollower);
    }
  }

  private void walkExpression(final Expr expression) {
    if (expression != null) {
      expressionVisitor.accept(expression);
      walkNestedParts(expression);
    }
  }

  private void walkNestedParts(final Expr expression) {
    switch (expression) {
      case ExprFunctionOp patternExpression -> walkElement(patternExpression.getElement());
      case ExprFunction function -> walkExpressions(function.getArgs());
      case ExprAggregator aggregate -> walkExpressions(aggregate.getAggregator().getExprList());
      default -> {}
    }
  }

  private void walkExpressions(final Iterable<Expr> expressions) {
    if (expressions != null) {
      expressions.forEach(this::walkExpression);
    }
  }

  /** Runs after the caller's visitor on each element and follows what ElementWalker skips. */
  private final class NestedPatternFollower extends ElementVisitorBase {
    @Override
    public void visit(final ElementFilter element) {
      walkExpression(element.getExpr());
    }

    @Override
    public void visit(final ElementBind element) {
      walkExpression(element.getExpr());
    }

    @Override
    public void visit(final ElementAssign element) {
      walkExpression(element.getExpr());
    }

    @Override
    public void visit(final ElementUnfold element) {
      walkExpression(element.getExpr());
    }

    @Override
    public void visit(final ElementExists element) {
      walkElement(element.getElement());
    }

    @Override
    public void visit(final ElementNotExists element) {
      walkElement(element.getElement());
    }

    @Override
    public void visit(final ElementSubQuery element) {
      walkQuery(element.getQuery());
    }
  }
}
