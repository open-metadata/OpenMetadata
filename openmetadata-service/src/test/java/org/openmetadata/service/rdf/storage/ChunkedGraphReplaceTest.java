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
package org.openmetadata.service.rdf.storage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;
import org.apache.jena.atlas.iterator.Iter;
import org.apache.jena.dboe.base.file.Location;
import org.apache.jena.graph.Graph;
import org.apache.jena.graph.Node;
import org.apache.jena.graph.NodeFactory;
import org.apache.jena.query.Dataset;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.riot.RDFFormat;
import org.apache.jena.tdb2.TDB2Factory;
import org.apache.jena.update.UpdateAction;
import org.apache.jena.vocabulary.DCTerms;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ChunkedGraphReplaceTest {
  private static final String GRAPH = "https://open-metadata.org/graph/ontology/test";
  private static final String EX = "https://example.org/model/";
  private static final int CHUNK_BYTES = 8 * 1024;

  private Dataset dataset;
  private InMemoryFuseki fuseki;

  @BeforeEach
  void openDataset() {
    dataset = TDB2Factory.connectDataset(Location.mem());
    fuseki = new InMemoryFuseki(dataset);
  }

  @AfterEach
  void closeDataset() {
    dataset.close();
  }

  @Test
  void aGraphLargerThanAChunkIsStagedAndMovedIntoPlaceWithEveryBlankNodeIntact() {
    final Model content = ontology("new", 120);
    try {
      new ChunkedGraphReplace(fuseki, CHUNK_BYTES).replace(GRAPH, content);

      assertTrue(served().isIsomorphicWith(content));
      assertTrue(fuseki.putBytes.size() > 1, "the graph must not fit one chunk");
      assertTrue(fuseki.putBytes.stream().allMatch(bytes -> bytes <= CHUNK_BYTES));
      assertEquals(List.of(GRAPH), graphs());
    } finally {
      content.close();
    }
  }

  @Test
  void aReplacementOverTheServedReleaseServesEveryStagedTriple() {
    final Model old = axioms("old", 1);
    final Model next = axioms("new", 1_000);
    try {
      new ChunkedGraphReplace(fuseki, CHUNK_BYTES).replace(GRAPH, old);
      new ChunkedGraphReplace(fuseki, CHUNK_BYTES).replace(GRAPH, next);

      final Model served = served();
      assertEquals(5_000, served.size(), "served triples");
      assertTrue(served.isIsomorphicWith(next));
      assertEquals(List.of(GRAPH), graphs());
    } finally {
      old.close();
      next.close();
    }
  }

  @Test
  void aGraphThatFitsOneChunkIsOnePutOfTheGraphItself() {
    final Model content = ontology("small", 2);
    try {
      new ChunkedGraphReplace(fuseki, CHUNK_BYTES).replace(GRAPH, content);

      assertTrue(served().isIsomorphicWith(content));
      assertEquals(List.of(GRAPH), fuseki.putGraphs);
      assertEquals(List.of(), fuseki.updates);
    } finally {
      content.close();
    }
  }

  @Test
  void aFailureBeforeTheSwapLeavesTheGraphAsItWasAndARetryConverges() {
    final Model old = ontology("old", 3);
    final Model next = ontology("new", 120);
    try {
      new ChunkedGraphReplace(fuseki, CHUNK_BYTES).replace(GRAPH, old);
      fuseki.failOnPut = fuseki.putGraphs.size() + 3;

      assertThrows(
          IllegalStateException.class,
          () -> new ChunkedGraphReplace(fuseki, CHUNK_BYTES).replace(GRAPH, next));
      assertTrue(served().isIsomorphicWith(old));
      assertEquals(2, graphs().size() - 1, "the failed attempt left its staged chunks");

      fuseki.failOnPut = -1;
      new ChunkedGraphReplace(fuseki, CHUNK_BYTES).replace(GRAPH, next);
      assertTrue(served().isIsomorphicWith(next));
      assertEquals(List.of(GRAPH), graphs());
    } finally {
      old.close();
      next.close();
    }
  }

  @Test
  void aStaleAttemptWithMoreChunksLeavesNothingBehind() {
    final Model large = ontology("large", 200);
    final Model smaller = ontology("smaller", 12);
    try {
      fuseki.failOnPut = 6;
      assertThrows(
          IllegalStateException.class,
          () -> new ChunkedGraphReplace(fuseki, CHUNK_BYTES).replace(GRAPH, large));
      fuseki.failOnPut = -1;

      new ChunkedGraphReplace(fuseki, CHUNK_BYTES).replace(GRAPH, smaller);
      assertTrue(served().isIsomorphicWith(smaller));
      assertEquals(List.of(GRAPH), graphs());
    } finally {
      large.close();
      smaller.close();
    }
  }

  @Test
  void aBlankNodeStructureLargerThanAChunkTravelsAloneInOneRequest() {
    final Model content = ontology("listed", 40);
    try {
      content
          .createResource(EX + "Every")
          .addProperty(
              OWL2.disjointUnionOf,
              content.createList(content.listSubjectsWithProperty(RDF.type, OWL2.Class)));
      new ChunkedGraphReplace(fuseki, CHUNK_BYTES).replace(GRAPH, content);

      assertTrue(served().isIsomorphicWith(content));
      assertTrue(fuseki.putBytes.stream().anyMatch(bytes -> bytes > CHUNK_BYTES));
    } finally {
      content.close();
    }
  }

  @Test
  void resendingACommittedSwapIsRefusedAndKeepsTheServedGraph() {
    final Model content = ontology("new", 120);
    try {
      fuseki.sendEachUpdateTwice = true;
      assertThrows(
          RuntimeException.class,
          () -> new ChunkedGraphReplace(fuseki, CHUNK_BYTES).replace(GRAPH, content));

      assertTrue(served().isIsomorphicWith(content));
      assertEquals(List.of(GRAPH), graphs());
    } finally {
      content.close();
    }
  }

  @Test
  void aSwapWhoseChunksANewerAttemptDroppedIsRefused() {
    final Model old = ontology("old", 3);
    final Model first = ontology("first", 120);
    final Model newer = ontology("newer", 120);
    try {
      new ChunkedGraphReplace(fuseki, CHUNK_BYTES).replace(GRAPH, old);
      fuseki.beforeSwap =
          () -> {
            fuseki.failOnPut = fuseki.putGraphs.size() + 2;
            assertThrows(
                IllegalStateException.class,
                () -> new ChunkedGraphReplace(fuseki, CHUNK_BYTES).replace(GRAPH, newer));
            fuseki.failOnPut = -1;
          };

      assertThrows(
          RuntimeException.class,
          () -> new ChunkedGraphReplace(fuseki, CHUNK_BYTES).replace(GRAPH, first));
      assertTrue(served().isIsomorphicWith(old));

      new ChunkedGraphReplace(fuseki, CHUNK_BYTES).replace(GRAPH, newer);
      assertTrue(served().isIsomorphicWith(newer));
      assertEquals(List.of(GRAPH), graphs());
    } finally {
      old.close();
      first.close();
      newer.close();
    }
  }

  @Test
  void anEmptyGraphIsOnePutThatClearsTheGraph() {
    final Model old = ontology("old", 3);
    final Model empty = ModelFactory.createDefaultModel();
    try {
      new ChunkedGraphReplace(fuseki, CHUNK_BYTES).replace(GRAPH, old);
      new ChunkedGraphReplace(fuseki, CHUNK_BYTES).replace(GRAPH, empty);
      assertTrue(served().isEmpty());
    } finally {
      old.close();
      empty.close();
    }
  }

  @Test
  void aBlankNodeStructureLargerThanOneRequestIsRefusedBeforeAnythingIsSent() {
    final Model content = ModelFactory.createDefaultModel();
    try {
      content
          .createResource(EX + "Huge")
          .addProperty(
              RDFS.subClassOf,
              content
                  .createResource()
                  .addProperty(RDFS.comment, "x".repeat(ChunkedGraphReplace.MAX_REQUEST_BYTES)));

      assertThrows(
          RdfPayloadTooLargeException.class,
          () -> new ChunkedGraphReplace(fuseki, CHUNK_BYTES).replace(GRAPH, content));
      assertEquals(List.of(), fuseki.putGraphs);
      assertEquals(List.of(), fuseki.updates);
    } finally {
      content.close();
    }
  }

  @Test
  void aChunkLargerThanTheFusekiUploadLimitIsRefused() {
    assertThrows(
        IllegalArgumentException.class,
        () -> new ChunkedGraphReplace(fuseki, ChunkedGraphReplace.MAX_REQUEST_BYTES + 1L));
  }

  /** Classes with restrictions and a short list, so most triples hang off blank nodes. */
  private static Model ontology(final String version, final int classes) {
    final Model model = ModelFactory.createDefaultModel();
    final Resource relatedTo = model.createResource(EX + "relatedTo");
    model.add(relatedTo, RDF.type, OWL2.ObjectProperty);
    final List<RDFNode> members = new ArrayList<>();
    for (int index = 0; index < classes; index++) {
      final Resource type = model.createResource(EX + "C" + index);
      members.add(type);
      type.addProperty(RDF.type, OWL2.Class)
          .addProperty(RDFS.label, version + " class " + index)
          .addProperty(
              RDFS.subClassOf,
              model
                  .createResource(OWL2.Restriction)
                  .addProperty(OWL2.onProperty, relatedTo)
                  .addProperty(OWL2.someValuesFrom, model.createResource(EX + "C" + (index + 1))));
    }
    model
        .createResource(EX + "All")
        .addProperty(OWL2.disjointUnionOf, model.createList(members.subList(0, 2).iterator()));
    return model;
  }

  /**
   * Statement sources as the annotated projection writes them, one blank node each. The labels are
   * fixed, so every run lays out the TDB2 indexes alike.
   */
  private static Model axioms(final String version, final int count) {
    final Model model = ModelFactory.createDefaultModel();
    final Graph graph = model.getGraph();
    for (int index = 0; index < count; index++) {
      final Node axiom = NodeFactory.createBlankNode(version + "-axiom-" + index);
      graph.add(axiom, RDF.type.asNode(), OWL2.Axiom.asNode());
      graph.add(axiom, OWL2.annotatedSource.asNode(), NodeFactory.createURI(EX + "C" + index % 97));
      graph.add(axiom, OWL2.annotatedProperty.asNode(), RDFS.label.asNode());
      graph.add(
          axiom,
          OWL2.annotatedTarget.asNode(),
          NodeFactory.createLiteralString(version + " label " + index));
      graph.add(
          axiom,
          DCTerms.source.asNode(),
          NodeFactory.createURI("urn:member:" + version + ":" + index));
    }
    return model;
  }

  private Model served() {
    return dataset.calculateRead(
        () -> ModelFactory.createDefaultModel().add(dataset.getNamedModel(GRAPH)));
  }

  private List<String> graphs() {
    return dataset.calculateRead(() -> Iter.toList(dataset.listNames()).stream().sorted().toList());
  }

  /**
   * Behaves as Fuseki does for these requests: the dataset is TDB2, Fuseki's store; a PUT body is
   * RDF-Thrift, whose blank node labels Fuseki keeps as sent; each request is one transaction.
   */
  private static final class InMemoryFuseki implements ChunkedGraphReplace.GraphStore {
    private final Dataset dataset;
    final List<String> putGraphs = new ArrayList<>();
    final List<Integer> putBytes = new ArrayList<>();
    final List<String> updates = new ArrayList<>();
    int failOnPut = -1;
    boolean sendEachUpdateTwice;
    Runnable beforeSwap;

    InMemoryFuseki(final Dataset dataset) {
      this.dataset = dataset;
    }

    @Override
    public void put(final String graph, final Model content) {
      if (putGraphs.size() + 1 == failOnPut) {
        throw new IllegalStateException("Simulated crash before PUT " + failOnPut);
      }
      final ByteArrayOutputStream body = new ByteArrayOutputStream();
      RDFDataMgr.write(body, content, RDFFormat.RDF_THRIFT);
      final Model received = ModelFactory.createDefaultModel();
      RDFDataMgr.read(received, new ByteArrayInputStream(body.toByteArray()), Lang.RDFTHRIFT);
      dataset.executeWrite(() -> dataset.replaceNamedModel(graph, received));
      putGraphs.add(graph);
      putBytes.add(body.size());
    }

    @Override
    public void update(final String sparqlUpdate) {
      if (beforeSwap != null && sparqlUpdate.contains("INSERT")) {
        final Runnable newerAttempt = beforeSwap;
        beforeSwap = null;
        newerAttempt.run();
      }
      updates.add(sparqlUpdate);
      dataset.executeWrite(() -> UpdateAction.parseExecute(sparqlUpdate, dataset));
      if (sendEachUpdateTwice) {
        dataset.executeWrite(() -> UpdateAction.parseExecute(sparqlUpdate, dataset));
      }
    }

    @Override
    public List<String> graphs() {
      return dataset.calculateRead(() -> Iter.toList(dataset.listNames()));
    }
  }
}
