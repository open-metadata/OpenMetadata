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
import org.apache.jena.sparql.core.TriplePath;
import org.apache.jena.sparql.expr.E_Call;
import org.apache.jena.sparql.expr.Expr;
import org.apache.jena.sparql.expr.ExprFunction;
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
import org.apache.jena.sparql.syntax.ElementDataset;
import org.apache.jena.sparql.syntax.ElementNamedGraph;
import org.apache.jena.sparql.syntax.ElementPathBlock;
import org.apache.jena.sparql.syntax.ElementService;
import org.apache.jena.sparql.syntax.ElementSubQuery;
import org.apache.jena.sparql.syntax.ElementTriplesBlock;
import org.apache.jena.sparql.syntax.ElementVisitorBase;
import org.openmetadata.schema.api.rdf.AgentSparqlErrorCode;
import org.openmetadata.service.rdf.federation.SparqlQueryWalker;

/**
 * Rejects graph selection, SERVICE, java: extension calls, CALL and eval wherever they appear.
 * {@link SparqlQueryWalker} supplies every element and expression, including those inside
 * subqueries and inside EXISTS / NOT EXISTS in any position, so the checks here only judge what
 * they are handed.
 */
final class AgentSparqlQueryInspector extends ElementVisitorBase {

  private static final String ARQ_FUNCTION_LIBRARY = "http://jena.apache.org/ARQ/function#";
  private static final String ARQ_FUNCTION_LIBRARY_LEGACY = "http://jena.hpl.hp.com/ARQ/function#";
  private static final String JAVA_SCHEME = "java:";

  private AgentSparqlQueryInspector() {}

  static void inspect(final Query query) {
    rejectDatasetDescription(query);
    SparqlQueryWalker.walk(
        query, new AgentSparqlQueryInspector(), AgentSparqlQueryInspector::inspectExpr);
  }

  private static void rejectDatasetDescription(final Query query) {
    if (query.hasDatasetDescription()) {
      throw graphSelection("FROM and FROM NAMED are not allowed");
    }
  }

  private static void inspectExpr(final Expr expr) {
    if (expr instanceof E_Call) {
      // The function name is computed at run time and resolved through the same registry
      // that loads java: classes, so there is no fixed name to check.
      throw formNotAllowed("CALL is not allowed");
    }
    if (expr instanceof ExprFunction function) {
      rejectJavaScheme(function.getFunctionIRI());
      rejectEval(function.getFunctionIRI());
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
    rejectDatasetDescription(element.getQuery());
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
    if (iri != null && iri.toLowerCase(Locale.ROOT).startsWith(JAVA_SCHEME)) {
      throw new AgentSparqlException(
          AgentSparqlErrorCode.QUERY_FORM_NOT_ALLOWED, "java: extension calls are not allowed");
    }
  }

  private static void rejectEval(final String iri) {
    if (iri != null
        && (iri.equals(ARQ_FUNCTION_LIBRARY + "eval")
            || iri.equals(ARQ_FUNCTION_LIBRARY_LEGACY + "eval"))) {
      throw formNotAllowed("eval functions are not allowed");
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

  private static AgentSparqlException formNotAllowed(final String message) {
    return new AgentSparqlException(AgentSparqlErrorCode.QUERY_FORM_NOT_ALLOWED, message);
  }
}
