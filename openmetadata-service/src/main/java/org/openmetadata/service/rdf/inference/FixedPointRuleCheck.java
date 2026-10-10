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

package org.openmetadata.service.rdf.inference;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Stream;
import org.apache.jena.graph.Node;
import org.apache.jena.graph.Triple;
import org.apache.jena.query.Query;
import org.apache.jena.sparql.algebra.walker.Walker;
import org.apache.jena.sparql.core.TriplePath;
import org.apache.jena.sparql.core.Var;
import org.apache.jena.sparql.expr.E_Bound;
import org.apache.jena.sparql.expr.E_NotExists;
import org.apache.jena.sparql.expr.E_Now;
import org.apache.jena.sparql.expr.Expr;
import org.apache.jena.sparql.expr.ExprFunction;
import org.apache.jena.sparql.expr.ExprFunction0;
import org.apache.jena.sparql.expr.ExprFunction1;
import org.apache.jena.sparql.expr.ExprFunction2;
import org.apache.jena.sparql.expr.ExprFunction3;
import org.apache.jena.sparql.expr.ExprFunctionN;
import org.apache.jena.sparql.expr.ExprFunctionOp;
import org.apache.jena.sparql.expr.ExprVisitorBase;
import org.apache.jena.sparql.expr.Unstable;
import org.apache.jena.sparql.syntax.ElementAssign;
import org.apache.jena.sparql.syntax.ElementBind;
import org.apache.jena.sparql.syntax.ElementData;
import org.apache.jena.sparql.syntax.ElementFilter;
import org.apache.jena.sparql.syntax.ElementMinus;
import org.apache.jena.sparql.syntax.ElementNamedGraph;
import org.apache.jena.sparql.syntax.ElementOptional;
import org.apache.jena.sparql.syntax.ElementPathBlock;
import org.apache.jena.sparql.syntax.ElementSubQuery;
import org.apache.jena.sparql.syntax.ElementTriplesBlock;
import org.apache.jena.sparql.syntax.ElementVisitorBase;
import org.apache.jena.sparql.syntax.ElementWalker;

/**
 * Accepts only positive, finite CONSTRUCT rules, so repeating them until nothing new is derived
 * terminates and does not depend on rule order. Negation could retract a fact another pass derived,
 * and minted terms (blank nodes, computed IRIs, nondeterministic values) would grow forever.
 */
final class FixedPointRuleCheck {
  private FixedPointRuleCheck() {}

  static List<String> check(final Query query) {
    final PatternInspector inspector = new PatternInspector();
    ElementWalker.walk(query.getQueryPattern(), inspector);
    final List<String> errors = new ArrayList<>(inspector.errors);
    errors.addAll(templateErrors(query.getConstructTemplate().getTriples(), inspector.boundVars));
    return List.copyOf(errors);
  }

  private static List<String> templateErrors(
      final List<Triple> template, final Set<Var> patternVars) {
    final List<String> errors = new ArrayList<>();
    final List<Node> nodes =
        template.stream()
            .flatMap(
                triple -> Stream.of(triple.getSubject(), triple.getPredicate(), triple.getObject()))
            .toList();
    if (nodes.stream().anyMatch(Node::isBlank)) {
      errors.add(
          "CONSTRUCT template must not contain blank nodes; each pass would create new nodes");
    }
    nodes.stream()
        .filter(Node::isVariable)
        .map(Var::alloc)
        .filter(variable -> !patternVars.contains(variable))
        .distinct()
        .forEach(
            variable ->
                errors.add(
                    ("CONSTRUCT template variable ?%s must be bound by a triple pattern or VALUES; "
                            + "computed values would let the rule create new terms on every pass")
                        .formatted(variable.getVarName())));
    return errors;
  }

  private static final class PatternInspector extends ElementVisitorBase {
    private final Set<String> errors = new LinkedHashSet<>();
    private final Set<Var> boundVars = new HashSet<>();
    private final ExpressionInspector expressions = new ExpressionInspector(errors);

    @Override
    public void visit(final ElementPathBlock element) {
      element.getPattern().getList().forEach(this::bindPathVariables);
    }

    @Override
    public void visit(final ElementTriplesBlock element) {
      element.getPattern().getList().forEach(this::bindTripleVariables);
    }

    @Override
    public void visit(final ElementNamedGraph element) {
      bindIfVariable(element.getGraphNameNode());
    }

    @Override
    public void visit(final ElementData element) {
      boundVars.addAll(element.getVars());
    }

    @Override
    public void visit(final ElementFilter element) {
      Walker.walk(element.getExpr(), expressions);
    }

    @Override
    public void visit(final ElementBind element) {
      Walker.walk(element.getExpr(), expressions);
    }

    @Override
    public void visit(final ElementAssign element) {
      Walker.walk(element.getExpr(), expressions);
    }

    @Override
    public void visit(final ElementOptional element) {
      errors.add("OPTIONAL is not allowed; rules must only add facts as their inputs grow");
    }

    @Override
    public void visit(final ElementMinus element) {
      errors.add("MINUS is not allowed; rules must only add facts as their inputs grow");
    }

    @Override
    public void visit(final ElementSubQuery element) {
      errors.add(
          "Nested subqueries are not allowed; they can aggregate or limit results, which a fixed point"
              + " cannot repeat safely");
    }

    private void bindPathVariables(final TriplePath path) {
      bindIfVariable(path.getSubject());
      bindIfVariable(path.getObject());
      if (path.isTriple()) {
        bindIfVariable(path.getPredicate());
      }
    }

    private void bindTripleVariables(final Triple triple) {
      bindIfVariable(triple.getSubject());
      bindIfVariable(triple.getPredicate());
      bindIfVariable(triple.getObject());
    }

    private void bindIfVariable(final Node node) {
      if (node != null && node.isVariable()) {
        boundVars.add(Var.alloc(node));
      }
    }
  }

  private static final class ExpressionInspector extends ExprVisitorBase {
    private final Set<String> errors;

    private ExpressionInspector(final Set<String> errors) {
      this.errors = errors;
    }

    @Override
    public void visit(final ExprFunction0 function) {
      inspect(function);
    }

    @Override
    public void visit(final ExprFunction1 function) {
      inspect(function);
    }

    @Override
    public void visit(final ExprFunction2 function) {
      inspect(function);
    }

    @Override
    public void visit(final ExprFunction3 function) {
      inspect(function);
    }

    @Override
    public void visit(final ExprFunctionN function) {
      inspect(function);
    }

    @Override
    public void visit(final ExprFunctionOp function) {
      inspect(function);
    }

    private void inspect(final ExprFunction function) {
      if (function instanceof E_NotExists) {
        errors.add("NOT EXISTS is not allowed; rules must only add facts as their inputs grow");
      } else if (function instanceof E_Bound) {
        errors.add("BOUND is not allowed; testing for missing values makes a rule non-monotone");
      } else if (isNondeterministic(function)) {
        errors.add(
            "Function %s is nondeterministic and not allowed; every pass must see the same values"
                .formatted(function.getFunctionSymbol().getSymbol().toUpperCase(Locale.ROOT)));
      }
    }

    private static boolean isNondeterministic(final Expr function) {
      return function instanceof Unstable || function instanceof E_Now;
    }
  }
}
