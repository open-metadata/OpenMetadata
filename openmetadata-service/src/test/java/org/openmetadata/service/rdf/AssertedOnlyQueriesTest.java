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

package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.apache.jena.atlas.iterator.Iter;
import org.apache.jena.graph.Node;
import org.apache.jena.graph.NodeFactory;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.query.QueryExecution;
import org.apache.jena.query.QueryExecutionFactory;
import org.apache.jena.sparql.core.DatasetGraph;
import org.apache.jena.sparql.core.DatasetGraphFactory;
import org.apache.jena.sparql.graph.GraphUnionRead;
import org.junit.jupiter.api.Test;

/**
 * Runs restricted queries with Jena's own dataset-description handling, the same code Fuseki uses,
 * over a dataset whose default graph is the union of its named graphs.
 */
class AssertedOnlyQueriesTest {
  private static final String BASE = "https://open-metadata.org/";
  private static final String KNOWLEDGE = BASE + "graph/knowledge";
  private static final String ONTOLOGY = BASE + "graph/ontology";
  private static final String INFERRED = BASE + "graph/inferred/";
  private static final String INHERITED_TAG = INFERRED + "schema-tag-inheritance";

  private final DatasetGraph dataset = DatasetGraphFactory.createGeneral();
  private final AtomicInteger graphListings = new AtomicInteger();
  private final AssertedOnlyQueries queries =
      new AssertedOnlyQueries(this::listGraphs, () -> INFERRED, Duration.ofMinutes(1));

  @Test
  void leavesOutTriplesThatOnlyAnInferredGraphHolds() {
    add(KNOWLEDGE, "urn:table", "urn:hasTag", "urn:pii");
    add(INHERITED_TAG, "urn:column", "urn:hasTag", "urn:pii");
    final String inherited = "ASK { <urn:column> <urn:hasTag> <urn:pii> }";

    assertTrue(ask(inherited), "The union default graph includes inferred graphs");
    assertFalse(ask(queries.restrict(inherited)));
    assertTrue(ask(queries.restrict("ASK { <urn:table> <urn:hasTag> <urn:pii> }")));
  }

  @Test
  void graphPatternsCannotReachInferredGraphs() {
    add(INHERITED_TAG, "urn:column", "urn:hasTag", "urn:pii");

    assertFalse(ask(queries.restrict("ASK { GRAPH ?g { <urn:column> <urn:hasTag> <urn:pii> } }")));
  }

  @Test
  void propertyPathsStillJoinTriplesFromDifferentAssertedGraphs() {
    add(KNOWLEDGE, "urn:a", "urn:next", "urn:b");
    add(ONTOLOGY, "urn:b", "urn:next", "urn:c");

    assertTrue(ask(queries.restrict("ASK { <urn:a> <urn:next>+ <urn:c> }")));
  }

  @Test
  void aTripleInSeveralAssertedGraphsIsCountedOnce() {
    add(KNOWLEDGE, "urn:a", "urn:p", "urn:b");
    add(ONTOLOGY, "urn:a", "urn:p", "urn:b");

    assertEquals(1, count(queries.restrict("SELECT (COUNT(*) AS ?n) WHERE { ?s ?p ?o }")));
  }

  @Test
  void aQueryThatDeclaresItsDatasetRunsAsWritten() {
    final String explicit = "SELECT ?s FROM <" + INHERITED_TAG + "> WHERE { ?s ?p ?o }";

    assertEquals(explicit, queries.restrict(explicit));
  }

  @Test
  void aStoreWithOnlyInferredGraphsAnswersFromAnEmptyDataset() {
    add(INHERITED_TAG, "urn:column", "urn:hasTag", "urn:pii");

    assertFalse(ask(queries.restrict("ASK { ?s ?p ?o }")));
  }

  @Test
  void theGraphListIsReusedUntilItExpires() {
    add(KNOWLEDGE, "urn:a", "urn:p", "urn:b");

    queries.restrict("ASK { ?s ?p ?o }");
    queries.restrict("ASK { ?s ?p ?o }");

    assertEquals(1, graphListings.get());
  }

  private List<String> listGraphs() {
    graphListings.incrementAndGet();
    return Iter.toList(Iter.map(dataset.listGraphNodes(), Node::getURI));
  }

  private void add(
      final String graph, final String subject, final String predicate, final String object) {
    dataset.add(
        NodeFactory.createURI(graph),
        NodeFactory.createURI(subject),
        NodeFactory.createURI(predicate),
        NodeFactory.createURI(object));
  }

  private boolean ask(final String query) {
    try (QueryExecution execution =
        QueryExecutionFactory.create(query, DatasetFactory.wrap(unionDefaultGraphView()))) {
      return execution.execAsk();
    }
  }

  private long count(final String query) {
    try (QueryExecution execution =
        QueryExecutionFactory.create(query, DatasetFactory.wrap(unionDefaultGraphView()))) {
      return execution.execSelect().next().getLiteral("n").getLong();
    }
  }

  /** The named graphs of {@link #dataset}, with their union as the default graph. */
  private DatasetGraph unionDefaultGraphView() {
    final DatasetGraph view = DatasetGraphFactory.createGeneral(new GraphUnionRead(dataset));
    dataset.listGraphNodes().forEachRemaining(name -> view.addGraph(name, dataset.getGraph(name)));
    return view;
  }
}
