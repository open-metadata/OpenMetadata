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

import java.util.Locale;
import org.apache.jena.graph.Node;
import org.apache.jena.graph.Triple;
import org.apache.jena.query.Query;
import org.apache.jena.query.SortCondition;
import org.apache.jena.sparql.core.TriplePath;
import org.apache.jena.sparql.expr.Expr;
import org.apache.jena.sparql.expr.ExprAggregator;
import org.apache.jena.sparql.expr.ExprFunction;
import org.apache.jena.sparql.expr.ExprFunctionOp;
import org.apache.jena.sparql.expr.ExprList;
import org.apache.jena.sparql.path.P_Alt;
import org.apache.jena.sparql.path.P_Distinct;
import org.apache.jena.sparql.path.P_FixedLength;
import org.apache.jena.sparql.path.P_Inverse;
import org.apache.jena.sparql.path.P_Link;
import org.apache.jena.sparql.path.P_Mod;
import org.apache.jena.sparql.path.P_Multi;
import org.apache.jena.sparql.path.P_NegPropSet;
import org.apache.jena.sparql.path.P_OneOrMore1;
import org.apache.jena.sparql.path.P_OneOrMoreN;
import org.apache.jena.sparql.path.P_ReverseLink;
import org.apache.jena.sparql.path.P_Seq;
import org.apache.jena.sparql.path.P_Shortest;
import org.apache.jena.sparql.path.P_ZeroOrMore1;
import org.apache.jena.sparql.path.P_ZeroOrMoreN;
import org.apache.jena.sparql.path.P_ZeroOrOne;
import org.apache.jena.sparql.path.PathVisitorBase;
import org.apache.jena.sparql.syntax.Element;
import org.apache.jena.sparql.syntax.ElementAssign;
import org.apache.jena.sparql.syntax.ElementBind;
import org.apache.jena.sparql.syntax.ElementDataset;
import org.apache.jena.sparql.syntax.ElementFilter;
import org.apache.jena.sparql.syntax.ElementNamedGraph;
import org.apache.jena.sparql.syntax.ElementPathBlock;
import org.apache.jena.sparql.syntax.ElementService;
import org.apache.jena.sparql.syntax.ElementSubQuery;
import org.apache.jena.sparql.syntax.ElementTriplesBlock;
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
      rejectJavaScheme(function.getFunctionIRI());
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

  @Override
  public void visit(final ElementPathBlock element) {
    element.patternElts().forEachRemaining(this::inspectTriplePath);
  }

  @Override
  public void visit(final ElementTriplesBlock element) {
    element.getPattern().getList().forEach(this::inspectTriple);
  }

  private void inspectTriplePath(final TriplePath triplePath) {
    if (triplePath.isTriple()) {
      inspectTriple(triplePath.asTriple());
    } else {
      triplePath.getPath().visit(new JavaSchemePathRejector());
    }
  }

  private void inspectTriple(final Triple triple) {
    rejectJavaScheme(triple.getPredicate());
  }

  private static void rejectJavaScheme(final Node node) {
    if (node != null && node.isURI()) {
      rejectJavaScheme(node.getURI());
    }
  }

  private static void rejectJavaScheme(final String iri) {
    if (iri != null && iri.toLowerCase(Locale.ROOT).startsWith("java:")) {
      throw new AgentSparqlException(
          AgentSparqlErrorCode.QUERY_FORM_NOT_ALLOWED, "java: extension calls are not allowed");
    }
  }

  /** Rejects java:-scheme predicate leaves anywhere inside a property path. */
  private static final class JavaSchemePathRejector extends PathVisitorBase {
    @Override
    public void visit(final P_Link link) {
      rejectJavaScheme(link.getNode());
    }

    @Override
    public void visit(final P_ReverseLink link) {
      rejectJavaScheme(link.getNode());
    }

    @Override
    public void visit(final P_NegPropSet props) {
      props.getFwdNodes().forEach(AgentSparqlQueryInspector::rejectJavaScheme);
      props.getBwdNodes().forEach(AgentSparqlQueryInspector::rejectJavaScheme);
    }

    @Override
    public void visit(final P_Inverse inverse) {
      inverse.getSubPath().visit(this);
    }

    @Override
    public void visit(final P_Mod mod) {
      mod.getSubPath().visit(this);
    }

    @Override
    public void visit(final P_FixedLength fixed) {
      fixed.getSubPath().visit(this);
    }

    @Override
    public void visit(final P_Distinct distinct) {
      distinct.getSubPath().visit(this);
    }

    @Override
    public void visit(final P_Multi multi) {
      multi.getSubPath().visit(this);
    }

    @Override
    public void visit(final P_ZeroOrOne zeroOrOne) {
      zeroOrOne.getSubPath().visit(this);
    }

    @Override
    public void visit(final P_ZeroOrMore1 zeroOrMore) {
      zeroOrMore.getSubPath().visit(this);
    }

    @Override
    public void visit(final P_ZeroOrMoreN zeroOrMore) {
      zeroOrMore.getSubPath().visit(this);
    }

    @Override
    public void visit(final P_OneOrMore1 oneOrMore) {
      oneOrMore.getSubPath().visit(this);
    }

    @Override
    public void visit(final P_OneOrMoreN oneOrMore) {
      oneOrMore.getSubPath().visit(this);
    }

    @Override
    public void visit(final P_Shortest shortest) {
      shortest.getSubPath().visit(this);
    }

    @Override
    public void visit(final P_Seq seq) {
      seq.getLeft().visit(this);
      seq.getRight().visit(this);
    }

    @Override
    public void visit(final P_Alt alt) {
      alt.getLeft().visit(this);
      alt.getRight().visit(this);
    }
  }

  private static AgentSparqlException graphSelection(final String message) {
    return new AgentSparqlException(AgentSparqlErrorCode.GRAPH_SELECTION_NOT_ALLOWED, message);
  }
}
