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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.io.StringReader;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.update.UpdateFactory;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;

class RdfLineageBatchingTest {

  private static final String BASE_URI = "https://open-metadata.org/";
  private static final String KNOWLEDGE_GRAPH = "https://open-metadata.org/graph/knowledge";

  @Test
  void singleLineageWriteUsesOneCombinedTransaction() {
    RdfStorageInterface storage = mock(RdfStorageInterface.class);
    RdfRepository repository = repository(storage);
    UUID fromId = UUID.randomUUID();
    UUID toId = UUID.randomUUID();

    repository.addLineageWithDetails(
        "table", fromId, "table", toId, new LineageDetails().withSqlQuery("SELECT * FROM source"));

    ArgumentCaptor<String> updateCaptor = ArgumentCaptor.forClass(String.class);
    verify(storage, times(1)).executeSparqlUpdate(updateCaptor.capture());
    String update = updateCaptor.getValue();
    assertTrue(update.contains("DELETE WHERE"));
    assertTrue(update.contains("INSERT DATA"));
    assertTrue(update.indexOf("DELETE") < update.indexOf("INSERT DATA"));
    assertDoesNotThrow(() -> UpdateFactory.create(update));
  }

  @Test
  void lineageDeleteBuilderPreservesTheReconciliationBlock() {
    RdfRepository repository = repository(mock(RdfStorageInterface.class));
    UUID fromId = UUID.randomUUID();
    UUID toId = UUID.randomUUID();
    String fromUri = BASE_URI + "entity/table/" + fromId;
    String toUri = BASE_URI + "entity/table/" + toId;
    String detailsUri = BASE_URI + "lineageDetails/" + fromId + "/" + toId;
    String expected =
        String.format(
            "DELETE WHERE { GRAPH <%s> { <%s> <https://open-metadata.org/ontology/UPSTREAM> <%s> . } };"
                + " DELETE WHERE { GRAPH <%s> { <%s> <http://www.w3.org/ns/prov#wasDerivedFrom> <%s> . } };"
                + " DELETE WHERE { GRAPH <%s> { <%s> <https://open-metadata.org/ontology/hasLineageDetails> <%s> . } };"
                + " DELETE { GRAPH <%s> { ?s ?p ?o } } WHERE { GRAPH <%s> { ?s ?p ?o . FILTER(STRSTARTS(STR(?s), \"%s\")) } };"
                + " DELETE { GRAPH <%s> { ?act <http://www.w3.org/ns/prov#generated> <%s> } } WHERE { GRAPH <%s> { ?act <http://www.w3.org/ns/prov#generated> <%s> } }",
            KNOWLEDGE_GRAPH,
            fromUri,
            toUri,
            KNOWLEDGE_GRAPH,
            toUri,
            fromUri,
            KNOWLEDGE_GRAPH,
            fromUri,
            detailsUri,
            KNOWLEDGE_GRAPH,
            KNOWLEDGE_GRAPH,
            detailsUri,
            KNOWLEDGE_GRAPH,
            detailsUri,
            KNOWLEDGE_GRAPH,
            detailsUri);

    assertEquals(expected, repository.buildLineageDeleteStatements(fromUri, toUri, detailsUri));
  }

  @Test
  void insertOnlyBatchContainsTheSameTriplesAsIndividualBuilders() {
    RdfStorageInterface storage = mock(RdfStorageInterface.class);
    RdfRepository repository = repository(storage);
    List<RdfRepository.LineageEdgeData> edges = List.of(edge("SELECT 1"), edge("SELECT 2"));
    Model expected = ModelFactory.createDefaultModel();
    for (RdfRepository.LineageEdgeData edge : edges) {
      expected.add(
          repository.buildLineageModel(
              edge.fromType(), edge.fromId(), edge.toType(), edge.toId(), edge.details()));
    }

    repository.bulkAddLineage(edges, RdfWriteMode.INSERT_ONLY);

    ArgumentCaptor<String> updateCaptor = ArgumentCaptor.forClass(String.class);
    verify(storage).executeSparqlUpdate(updateCaptor.capture());
    String update = updateCaptor.getValue();
    assertFalse(update.contains("DELETE"));
    Model actual = parseInsertModel(update);
    assertTrue(expected.isIsomorphicWith(actual));
  }

  private static RdfRepository repository(RdfStorageInterface storage) {
    RdfConfiguration config =
        new RdfConfiguration().withEnabled(true).withBaseUri(URI.create(BASE_URI));
    return new RdfRepository(config, storage, null);
  }

  private static RdfRepository.LineageEdgeData edge(String sql) {
    return new RdfRepository.LineageEdgeData(
        "table",
        UUID.randomUUID(),
        "table",
        UUID.randomUUID(),
        new LineageDetails().withSqlQuery(sql));
  }

  private static Model parseInsertModel(String update) {
    String prefix = "INSERT DATA { GRAPH <" + KNOWLEDGE_GRAPH + "> { ";
    int start = update.indexOf(prefix) + prefix.length();
    int end = update.lastIndexOf(" } }");
    Model model = ModelFactory.createDefaultModel();
    model.read(new StringReader(update.substring(start, end)), null, "N-TRIPLES");
    return model;
  }
}
