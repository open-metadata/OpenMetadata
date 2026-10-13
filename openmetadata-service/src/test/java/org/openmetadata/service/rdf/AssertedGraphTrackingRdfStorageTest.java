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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;

class AssertedGraphTrackingRdfStorageTest {
  private static final String KNOWLEDGE = "https://open-metadata.org/graph/knowledge";
  private static final String CENTRALITY = "https://open-metadata.org/insights/centrality/table";

  @Test
  void readsTheGraphsAnUpdateCanAddTo() {
    assertEquals(
        Optional.of(Set.of(CENTRALITY)),
        AssertedGraphTrackingRdfStorage.targetGraphs(
            "INSERT DATA { GRAPH <" + CENTRALITY + "> { <urn:a> <urn:p> 1 } }"));
    assertEquals(
        Optional.of(Set.of(KNOWLEDGE)),
        AssertedGraphTrackingRdfStorage.targetGraphs(
            "WITH <"
                + KNOWLEDGE
                + "> DELETE { ?s <urn:p> ?o } INSERT { ?s <urn:q> ?o }"
                + " WHERE { ?s <urn:p> ?o }"));
    assertEquals(
        Optional.of(Set.of(CENTRALITY)),
        AssertedGraphTrackingRdfStorage.targetGraphs(
            "LOAD <file:///tmp/scores.ttl> INTO GRAPH <" + CENTRALITY + ">"));
    assertEquals(
        Optional.of(Set.of(CENTRALITY)),
        AssertedGraphTrackingRdfStorage.targetGraphs(
            "COPY GRAPH <" + KNOWLEDGE + "> TO GRAPH <" + CENTRALITY + ">"));
  }

  @Test
  void deletesAndDefaultGraphWritesAddNoGraph() {
    assertEquals(
        Optional.of(Set.of()),
        AssertedGraphTrackingRdfStorage.targetGraphs(
            "DELETE WHERE { GRAPH <"
                + KNOWLEDGE
                + "> { <urn:a> ?p ?o } };"
                + " DROP SILENT GRAPH <"
                + CENTRALITY
                + ">; INSERT DATA { <urn:a> <urn:p> <urn:b> }"));
  }

  @Test
  void aGraphNamedByAVariableOrAnUnreadableUpdateIsUnknown() {
    assertEquals(
        Optional.empty(),
        AssertedGraphTrackingRdfStorage.targetGraphs(
            "INSERT { GRAPH ?g { ?s <urn:copy> ?o } } WHERE { GRAPH ?g { ?s <urn:p> ?o } }"));
    assertEquals(Optional.empty(), AssertedGraphTrackingRdfStorage.targetGraphs("not sparql"));
  }

  @Test
  void anUpdateThatFailsStillMakesItsNewGraphReadable() {
    final List<String> graphs = new ArrayList<>(List.of(KNOWLEDGE));
    final AtomicInteger listings = new AtomicInteger();
    final AssertedOnlyQueries queries =
        new AssertedOnlyQueries(
            () -> {
              listings.incrementAndGet();
              return List.copyOf(graphs);
            },
            () -> "https://open-metadata.org/graph/inferred/",
            Duration.ofMinutes(1));
    final RdfStorageInterface fuseki = mock(RdfStorageInterface.class);
    doThrow(new IllegalStateException("timed out")).when(fuseki).executeSparqlUpdate(anyString());
    final AssertedGraphTrackingRdfStorage storage =
        new AssertedGraphTrackingRdfStorage(fuseki, queries, KNOWLEDGE);
    queries.restrict("ASK { ?s ?p ?o }");
    graphs.add(CENTRALITY);

    assertThrows(
        IllegalStateException.class,
        () ->
            storage.executeSparqlUpdate(
                "INSERT DATA { GRAPH <" + CENTRALITY + "> { <urn:a> <urn:p> 1 } }"));

    final String restricted = queries.restrict("ASK { ?s ?p ?o }");
    assertEquals(2, listings.get());
    assertEquals(true, restricted.contains("<" + CENTRALITY + ">"));
  }
}
