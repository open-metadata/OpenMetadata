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
import java.util.List;
import java.util.concurrent.TimeoutException;
import org.apache.jena.graph.Node;
import org.apache.jena.graph.NodeFactory;
import org.apache.jena.graph.Triple;
import org.apache.jena.graph.impl.GraphBase;
import org.apache.jena.sparql.core.DatasetGraph;
import org.apache.jena.sparql.core.DatasetGraphFactory;
import org.apache.jena.update.UpdateAction;
import org.apache.jena.util.iterator.ExtendedIterator;
import org.openmetadata.service.rdf.storage.RdfWriteOutcomeUnknownException;

/**
 * In-memory stand-in for the Fuseki dataset: SPARQL Update runs for real, and the default graph is
 * the union of all named graphs, as with {@code tdb2:unionDefaultGraph}.
 */
final class UnionDefaultGraphStore implements InferenceGraphStore {
  static final String KNOWLEDGE_GRAPH = "https://open-metadata.org/graph/knowledge";

  private final NamedGraphUnion namedGraphUnion = new NamedGraphUnion();
  private final DatasetGraph dataset = DatasetGraphFactory.createGeneral(namedGraphUnion);
  private final List<String> updates = new ArrayList<>();
  private Runnable afterNextUpdate = () -> {};
  private String failingUpdateFragment;
  private String timingOutUpdateFragment;
  private boolean available = true;

  UnionDefaultGraphStore() {
    namedGraphUnion.dataset = dataset;
  }

  @Override
  public boolean isAvailable() {
    return available;
  }

  @Override
  public void update(final String sparqlUpdate) {
    if (failingUpdateFragment != null && sparqlUpdate.contains(failingUpdateFragment)) {
      throw new IllegalStateException("Fuseki rejected the update");
    }
    if (timingOutUpdateFragment != null && sparqlUpdate.contains(timingOutUpdateFragment)) {
      throw new RuntimeException(
          "Failed to execute SPARQL update",
          new RdfWriteOutcomeUnknownException(
              "executeSparqlUpdate", new TimeoutException("request timed out")));
    }
    UpdateAction.parseExecute(sparqlUpdate, dataset);
    updates.add(sparqlUpdate);
    final Runnable action = afterNextUpdate;
    afterNextUpdate = () -> {};
    action.run();
  }

  @Override
  public long tripleCount(final String graphUri) {
    return dataset.getGraph(uri(graphUri)).size();
  }

  void assertFact(final String subject, final String predicate, final String object) {
    dataset.add(uri(KNOWLEDGE_GRAPH), uri(subject), uri(predicate), uri(object));
  }

  void retractFact(final String subject, final String predicate, final String object) {
    dataset.delete(uri(KNOWLEDGE_GRAPH), uri(subject), uri(predicate), uri(object));
  }

  void addToGraph(
      final String graphUri, final String subject, final String predicate, final String object) {
    dataset.add(uri(graphUri), uri(subject), uri(predicate), uri(object));
  }

  boolean contains(
      final String graphUri, final String subject, final String predicate, final String object) {
    return dataset.contains(uri(graphUri), uri(subject), uri(predicate), uri(object));
  }

  int updateCount() {
    return updates.size();
  }

  /** Runs {@code action} once, right after the next update, as a concurrent writer would. */
  void afterNextUpdate(final Runnable action) {
    afterNextUpdate = action;
  }

  void failUpdatesContaining(final String fragment) {
    failingUpdateFragment = fragment;
  }

  /** OM gave up waiting, as at its request timeout, so Fuseki may or may not apply the update. */
  void timeOutUpdatesContaining(final String fragment) {
    timingOutUpdateFragment = fragment;
  }

  void makeUnavailable() {
    available = false;
  }

  private static Node uri(final String value) {
    return NodeFactory.createURI(value);
  }

  /**
   * Reads every named graph at query time, so graphs a rule creates mid-run are visible at once.
   * Jena's update engine reads the default graph through the dataset, not {@code getDefaultGraph},
   * so the union has to be the dataset's own default graph rather than an override on a wrapper.
   */
  private static final class NamedGraphUnion extends GraphBase {
    private DatasetGraph dataset;

    @Override
    protected ExtendedIterator<Triple> graphBaseFind(final Triple pattern) {
      return dataset.getUnionGraph().find(pattern);
    }
  }
}
