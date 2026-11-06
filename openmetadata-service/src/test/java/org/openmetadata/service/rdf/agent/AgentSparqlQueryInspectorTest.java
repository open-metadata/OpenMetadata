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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.apache.jena.query.Query;
import org.apache.jena.sparql.core.DatasetGraphFactory;
import org.apache.jena.sparql.core.Var;
import org.apache.jena.sparql.expr.E_Exists;
import org.apache.jena.sparql.expr.NodeValue;
import org.apache.jena.sparql.syntax.Element;
import org.apache.jena.sparql.syntax.ElementAssign;
import org.apache.jena.sparql.syntax.ElementDataset;
import org.apache.jena.sparql.syntax.ElementGroup;
import org.apache.jena.sparql.syntax.ElementService;
import org.apache.jena.sparql.syntax.ElementUnfold;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.rdf.AgentSparqlErrorCode;

/**
 * The dataset, assignment, and unfold visits are defensive: the SPARQL parser never produces these
 * elements in a SELECT pattern today, but if a future Jena version does, they must keep the same
 * allow/deny behavior as their parsed-text equivalents.
 */
class AgentSparqlQueryInspectorTest {
  @Test
  void datasetElementIsGraphSelection() {
    Query query = queryWith(new ElementDataset(DatasetGraphFactory.create(), new ElementGroup()));

    AgentSparqlException failure =
        assertThrows(AgentSparqlException.class, () -> AgentSparqlQueryInspector.inspect(query));
    assertEquals(AgentSparqlErrorCode.GRAPH_SELECTION_NOT_ALLOWED, failure.getCode());
  }

  @Test
  void federationInsideAnAssignmentIsStillRejected() {
    Query query = queryWith(new ElementAssign(Var.alloc("x"), new E_Exists(serviceGroup())));

    AgentSparqlException failure =
        assertThrows(AgentSparqlException.class, () -> AgentSparqlQueryInspector.inspect(query));
    assertEquals(AgentSparqlErrorCode.FEDERATION_NOT_ALLOWED, failure.getCode());
  }

  @Test
  void federationInsideAnUnfoldIsStillRejected() {
    Query query =
        queryWith(new ElementUnfold(new E_Exists(serviceGroup()), Var.alloc("a"), Var.alloc("b")));

    AgentSparqlException failure =
        assertThrows(AgentSparqlException.class, () -> AgentSparqlQueryInspector.inspect(query));
    assertEquals(AgentSparqlErrorCode.FEDERATION_NOT_ALLOWED, failure.getCode());
  }

  @Test
  void pureAssignmentHasNothingToReject() {
    Query query = queryWith(new ElementAssign(Var.alloc("x"), NodeValue.makeInteger(1)));

    assertDoesNotThrow(() -> AgentSparqlQueryInspector.inspect(query));
  }

  private static ElementGroup serviceGroup() {
    ElementGroup group = new ElementGroup();
    group.addElement(new ElementService("https://example.org/sparql", new ElementGroup()));
    return group;
  }

  private static Query queryWith(Element pattern) {
    Query query = new Query();
    query.setQueryPattern(pattern);
    return query;
  }
}
