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

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.HashSet;
import java.util.Set;
import org.apache.jena.query.QueryFactory;
import org.apache.jena.sparql.expr.ExprFunction;
import org.apache.jena.sparql.syntax.ElementNamedGraph;
import org.apache.jena.sparql.syntax.ElementVisitorBase;
import org.junit.jupiter.api.Test;

class SparqlQueryWalkerTest {

  @Test
  void handsEveryExpressionToTheExpressionVisitorIncludingNestedArguments() {
    final Set<String> functions = new HashSet<>();

    SparqlQueryWalker.walk(
        QueryFactory.create(
            """
            SELECT (SAMPLE(<urn:fn:aggregate>(?o)) AS ?a)
            WHERE {
              ?s ?p ?o
              FILTER(<urn:fn:filter>(<urn:fn:argument>(?o)))
              BIND(<urn:fn:bind>(?o) AS ?b)
            }
            GROUP BY (<urn:fn:group>(?s) AS ?g)
            HAVING (<urn:fn:having>(?g))
            ORDER BY (<urn:fn:order>(?g))
            """),
        new ElementVisitorBase(),
        expression -> {
          if (expression instanceof ExprFunction function && function.getFunctionIRI() != null) {
            functions.add(function.getFunctionIRI());
          }
        });

    assertEquals(
        Set.of(
            "urn:fn:aggregate",
            "urn:fn:filter",
            "urn:fn:argument",
            "urn:fn:bind",
            "urn:fn:group",
            "urn:fn:having",
            "urn:fn:order"),
        functions);
  }

  @Test
  void handsPatternsInsideExpressionsAndSubqueriesToTheElementVisitor() {
    final Set<String> graphs = new HashSet<>();

    SparqlQueryWalker.walk(
        QueryFactory.create(
            """
            SELECT * WHERE {
              ?s ?p ?o
              FILTER EXISTS { GRAPH <urn:graph:filter> { ?s ?p ?o } }
              EXISTS { GRAPH <urn:graph:bare> { ?s ?p ?o } }
              { SELECT (NOT EXISTS { GRAPH <urn:graph:subquery> { ?a ?b ?c } } AS ?x) WHERE { } }
            }
            ORDER BY (EXISTS { GRAPH <urn:graph:order> { ?s ?p ?o } })
            """),
        new ElementVisitorBase() {
          @Override
          public void visit(final ElementNamedGraph element) {
            graphs.add(element.getGraphNameNode().getURI());
          }
        });

    assertEquals(
        Set.of("urn:graph:filter", "urn:graph:bare", "urn:graph:subquery", "urn:graph:order"),
        graphs);
  }
}
