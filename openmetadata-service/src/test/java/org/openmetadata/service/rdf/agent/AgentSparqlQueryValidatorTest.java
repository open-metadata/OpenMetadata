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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.apache.jena.query.Query;
import org.apache.jena.query.QueryFactory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.rdf.AgentSparqlErrorCode;
import org.openmetadata.service.rdf.SparqlQueryLimits;

class AgentSparqlQueryValidatorTest {
  private final AgentSparqlQueryValidator validator = new AgentSparqlQueryValidator();

  @ParameterizedTest
  @ValueSource(
      strings = {
        "SELECT ?s WHERE { ?s ?p ?o }",
        "SELECT ?s (COUNT(DISTINCT ?o) AS ?n) WHERE { ?s ?p ?o } GROUP BY ?s HAVING (COUNT(?o) > 1)"
            + " ORDER BY DESC(?n)",
        "SELECT ?s WHERE { { SELECT ?s WHERE { ?s ?p ?o } LIMIT 5 } }",
        "SELECT ?s WHERE { ?s ?p ?o FILTER NOT EXISTS { ?s a ?type } }",
        "SELECT ?s WHERE { ?s ?p ?o OPTIONAL { ?o ?q ?r } MINUS { ?s ?x ?y } }",
        "SELECT ?s WHERE { ?s <urn:p>+ ?o } VALUES ?s { <urn:a> }",
        "SELECT ?s WHERE { ?s ?p \"GRAPH SERVICE FROM\" } # FROM NAMED <urn:g>",
        "SELECT ?s (\"SERVICE\" AS ?label) WHERE { ?s ?p ?o BIND(\"GRAPH\" AS ?kind) }",
        "VERSION \"1.2\" SELECT (TRIPLE(<urn:s>, <urn:p>, \"cat\"@en--ltr) AS ?statement) WHERE {}"
      })
  void acceptsSelectShapes(String sparql) {
    AgentSparqlQueryPlan plan = validator.validate(sparql);

    assertTrue(QueryFactory.create(plan.executableSparql()).isSelectType());
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "ASK { ?s ?p ?o }",
        "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }",
        "DESCRIBE <urn:subject>"
      })
  void rejectsNonSelectForms(String sparql) {
    assertCode(AgentSparqlErrorCode.QUERY_FORM_NOT_ALLOWED, sparql);
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "INSERT DATA { <urn:s> <urn:p> <urn:o> }",
        "DELETE WHERE { ?s ?p ?o }",
        "CLEAR ALL"
      })
  void rejectsUpdatesAsDisallowedForms(String sparql) {
    assertCode(AgentSparqlErrorCode.QUERY_FORM_NOT_ALLOWED, sparql);
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "SELECT ?s FROM <urn:g> WHERE { ?s ?p ?o }",
        "SELECT ?s FROM NAMED <urn:g> WHERE { ?s ?p ?o }",
        "SELECT ?s WHERE { GRAPH <urn:g> { ?s ?p ?o } }",
        "SELECT ?s WHERE { GRAPH ?g { ?s ?p ?o } }",
        "SELECT ?s WHERE { { SELECT ?s WHERE { GRAPH ?g { ?s ?p ?o } } } }",
        "SELECT ?s WHERE { ?s ?p ?o FILTER EXISTS { GRAPH ?g { ?s ?p ?o } } }",
        "SELECT ?s WHERE { ?s ?p ?o OPTIONAL { GRAPH <urn:g> { ?o ?q ?r } } }",
        "SELECT ?s WHERE { { ?s ?p ?o } UNION { GRAPH ?g { ?s ?p ?o } } }",
        "SELECT ?s (EXISTS { GRAPH ?g { ?s ?p ?o } } AS ?inGraph) WHERE { ?s ?p ?o }",
        "SELECT ?s WHERE { ?s ?p ?o } ORDER BY (EXISTS { GRAPH ?g { ?s ?p ?o } })",
        "SELECT ?s WHERE { ?s ?p ?o BIND(NOT EXISTS { GRAPH ?g { ?s ?p ?o } } AS ?x) }"
      })
  void rejectsGraphSelectionAtAnyLevel(String sparql) {
    assertCode(AgentSparqlErrorCode.GRAPH_SELECTION_NOT_ALLOWED, sparql);
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "SELECT ?s WHERE { SERVICE <https://example.org/sparql> { ?s ?p ?o } }",
        "SELECT ?s WHERE { SERVICE ?endpoint { ?s ?p ?o } }",
        "SELECT ?s WHERE { { SELECT ?s WHERE { SERVICE <urn:e> { ?s ?p ?o } } } }",
        "SELECT ?s WHERE { ?s ?p ?o FILTER NOT EXISTS { SERVICE <urn:e> { ?s ?p ?o } } }",
        "SELECT ?s WHERE { ?s ?p ?o } GROUP BY ?s HAVING (EXISTS { SERVICE <urn:e> { ?s ?p ?o } })"
      })
  void rejectsFederationAtAnyLevel(String sparql) {
    assertCode(AgentSparqlErrorCode.FEDERATION_NOT_ALLOWED, sparql);
  }

  @ParameterizedTest
  @ValueSource(strings = {"", "   ", "SELECT ?s WHERE {"})
  void rejectsMissingOrMalformedQueries(String sparql) {
    assertCode(AgentSparqlErrorCode.QUERY_INVALID, sparql);
  }

  @Test
  void rejectsNullQuery() {
    assertCode(AgentSparqlErrorCode.QUERY_INVALID, null);
  }

  @Test
  void rejectsOversizedQueryText() {
    String padding = " ".repeat(SparqlQueryLimits.MAX_QUERY_CHARACTERS);

    assertCode(AgentSparqlErrorCode.QUERY_INVALID, "SELECT ?s WHERE { ?s ?p ?o }" + padding);
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "SELECT (<java:java.lang.Math.sqrt>(?x) AS ?y) WHERE { ?s ?p ?o }",
        "SELECT (<JAVA:java.lang.Math.sqrt>(?x) AS ?y) WHERE { ?s ?p ?o }",
        "SELECT ?s WHERE { ?s <java:evil.Foo> ?o }",
        "SELECT ?s WHERE { ?s <java:evil.Foo>+ ?o }",
        "SELECT ?s WHERE { { SELECT ?s WHERE { ?s <java:evil.Foo> ?o } } }",
        "SELECT ?s WHERE { ?s ?p ?o FILTER EXISTS { ?s <java:evil.Foo> ?o } }"
      })
  void rejectsJavaSchemeCalls(String sparql) {
    // Jena dynamically loads classpath classes for java: IRIs with no configuration, so
    // function calls and predicate positions carrying the scheme are rejected up front.
    assertCode(AgentSparqlErrorCode.QUERY_FORM_NOT_ALLOWED, sparql);
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "SELECT (CALL(IRI(CONCAT(\"ja\",\"va:org.example.SomeFunction\")), ?o) AS ?y)"
            + " WHERE { ?s ?p ?o }",
        "SELECT (<http://jena.apache.org/ARQ/function#eval>(?x) AS ?y) WHERE { ?s ?p ?o }",
        "SELECT (<http://jena.hpl.hp.com/ARQ/function#eval>(?x) AS ?y) WHERE { ?s ?p ?o }",
        "SELECT (CALL(<java:java.lang.Math.sqrt>, ?x) AS ?y) WHERE { ?s ?p ?o }"
      })
  void rejectsDynamicCalls(String sparql) {
    // CALL computes its function at run time and afn:eval hands off to CALL, so neither has
    // a fixed name the function check could see.
    assertCode(AgentSparqlErrorCode.QUERY_FORM_NOT_ALLOWED, sparql);
  }

  @Test
  void keepsExplicitLimitAndOffsetUnchanged() {
    AgentSparqlQueryPlan plan =
        validator.validate("SELECT ?s WHERE { ?s ?p ?o } OFFSET 20 LIMIT 10");

    Query executed = QueryFactory.create(plan.executableSparql());
    assertEquals(10, plan.explicitLimit());
    assertFalse(plan.isServerLimited());
    assertEquals(10, executed.getLimit());
    assertEquals(20, executed.getOffset());
  }

  @Test
  void probesOneRowPastTheServerLimitWhenNoLimitWasSubmitted() {
    AgentSparqlQueryPlan plan = validator.validate("SELECT ?s WHERE { ?s ?p ?o } OFFSET 20");

    Query executed = QueryFactory.create(plan.executableSparql());
    assertNull(plan.explicitLimit());
    assertTrue(plan.isServerLimited());
    assertEquals(SparqlQueryLimits.DEFAULT_RESULT_LIMIT + 1, executed.getLimit());
    assertEquals(20, executed.getOffset());
  }

  @Test
  void leavesSubqueryLimitsAloneWhenProbing() {
    AgentSparqlQueryPlan plan =
        validator.validate(
            "SELECT ?s (COUNT(?o) AS ?n) WHERE { { SELECT ?s ?o WHERE { ?s ?p ?o } LIMIT 3 } }"
                + " GROUP BY ?s");

    assertTrue(plan.executableSparql().matches("(?s).*LIMIT\\s+3\\b.*"), plan.executableSparql());
    assertEquals(
        SparqlQueryLimits.DEFAULT_RESULT_LIMIT + 1,
        QueryFactory.create(plan.executableSparql()).getLimit());
  }

  @Test
  void acceptsTheMaximumExplicitLimitAndRejectsAnythingAbove() {
    assertEquals(
        SparqlQueryLimits.MAX_RESULT_LIMIT,
        validator
            .validate("SELECT ?s WHERE { ?s ?p ?o } LIMIT " + SparqlQueryLimits.MAX_RESULT_LIMIT)
            .explicitLimit());
    assertCode(
        AgentSparqlErrorCode.QUERY_LIMIT_EXCEEDED,
        "SELECT ?s WHERE { ?s ?p ?o } LIMIT " + (SparqlQueryLimits.MAX_RESULT_LIMIT + 1));
  }

  private void assertCode(AgentSparqlErrorCode expected, String sparql) {
    AgentSparqlException rejected =
        assertThrows(AgentSparqlException.class, () -> validator.validate(sparql));
    assertEquals(expected, rejected.getCode());
  }
}
