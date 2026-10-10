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

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.apache.jena.graph.NodeFactory;
import org.apache.jena.graph.Triple;
import org.apache.jena.query.Query;
import org.apache.jena.query.QueryFactory;
import org.apache.jena.sparql.core.Var;
import org.apache.jena.sparql.syntax.ElementTriplesBlock;
import org.junit.jupiter.api.Test;

class FixedPointRuleCheckTest {
  @Test
  void variablesBoundByABuiltTriplesBlockAreAccepted() {
    final Query query = QueryFactory.create("CONSTRUCT { ?s <urn:p> ?o } WHERE { ?s <urn:q> ?o }");
    final ElementTriplesBlock block = new ElementTriplesBlock();
    block.addTriple(Triple.create(Var.alloc("s"), NodeFactory.createURI("urn:q"), Var.alloc("o")));
    query.setQueryPattern(block);

    final List<String> errors = FixedPointRuleCheck.check(query);

    assertTrue(errors.isEmpty(), "Expected no errors but got: " + errors);
  }
}
