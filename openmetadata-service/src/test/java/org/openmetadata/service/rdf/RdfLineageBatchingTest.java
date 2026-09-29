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
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.update.UpdateAction;
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
    assertEquals(1, countOccurrences(update, "WHERE"), update);
    assertTrue(update.contains("DELETE {"));
    assertTrue(update.contains("INSERT DATA"));
    assertTrue(update.indexOf("DELETE") < update.indexOf("INSERT DATA"));
    assertDoesNotThrow(() -> UpdateFactory.create(update));
  }

  @Test
  void lineageDeleteBuilderPreservesTheReconciliationScope() {
    RdfRepository repository = repository(mock(RdfStorageInterface.class));
    UUID fromId = UUID.randomUUID();
    UUID toId = UUID.randomUUID();
    String fromUri = BASE_URI + "entity/table/" + fromId;
    String toUri = BASE_URI + "entity/table/" + toId;
    String detailsUri = BASE_URI + "lineageDetails/" + fromId + "/" + toId;
    String update = repository.buildLineageDeleteStatements(fromUri, toUri, detailsUri);
    Dataset dataset = DatasetFactory.createTxnMem();
    Model graph = dataset.getNamedModel(KNOWLEDGE_GRAPH);
    Resource from = graph.createResource(fromUri);
    Resource to = graph.createResource(toUri);
    Resource details = graph.createResource(detailsUri);
    Resource columnLineage = graph.createResource(detailsUri + "/column/1");
    Resource plan = graph.createResource(detailsUri + "/plan");
    Resource activity = graph.createResource("urn:activity");
    Resource unrelated = graph.createResource("urn:unrelated");
    Property upstream = graph.createProperty("https://open-metadata.org/ontology/UPSTREAM");
    Property wasDerivedFrom = graph.createProperty("http://www.w3.org/ns/prov#wasDerivedFrom");
    Property hasDetails =
        graph.createProperty("https://open-metadata.org/ontology/hasLineageDetails");
    Property hasColumnLineage =
        graph.createProperty("https://open-metadata.org/ontology/hasColumnLineage");
    Property hadPlan = graph.createProperty("http://www.w3.org/ns/prov#hadPlan");
    Property generated = graph.createProperty("http://www.w3.org/ns/prov#generated");
    Property value = graph.createProperty("urn:value");
    graph.add(from, upstream, to);
    graph.add(to, wasDerivedFrom, from);
    graph.add(from, hasDetails, details);
    graph.add(details, hasColumnLineage, columnLineage);
    graph.add(details, hadPlan, plan);
    graph.add(details, value, "details");
    graph.add(columnLineage, value, "column");
    graph.add(plan, value, "plan");
    graph.add(activity, generated, details);
    graph.add(unrelated, value, "preserved");

    assertEquals(1, countOccurrences(update, "WHERE"), update);
    assertTrue(update.contains(fromUri), update);
    assertTrue(update.contains(toUri), update);
    assertTrue(update.contains(detailsUri), update);
    assertTrue(update.contains("hasColumnLineage"), update);
    assertTrue(update.contains("hadPlan"), update);
    assertTrue(update.contains("prov#generated"), update);
    assertDoesNotThrow(() -> UpdateAction.parseExecute(update, dataset));
    assertFalse(graph.contains(from, upstream, to));
    assertFalse(graph.contains(to, wasDerivedFrom, from));
    assertFalse(graph.contains(from, hasDetails, details));
    assertFalse(graph.contains(details, null));
    assertFalse(graph.contains(columnLineage, null));
    assertFalse(graph.contains(plan, null));
    assertFalse(graph.contains(activity, generated, details));
    assertTrue(graph.contains(unrelated, value, "preserved"));
    dataset.close();
  }

  @Test
  void lineageDeleteBuilderNeverScansTheWholeGraph() {
    RdfRepository repository = repository(mock(RdfStorageInterface.class));
    UUID fromId = UUID.randomUUID();
    UUID toId = UUID.randomUUID();
    String fromUri = BASE_URI + "entity/table/" + fromId;
    String toUri = BASE_URI + "entity/table/" + toId;
    String detailsUri = BASE_URI + "lineageDetails/" + fromId + "/" + toId;

    String statements = repository.buildLineageDeleteStatements(fromUri, toUri, detailsUri);

    // A STRSTARTS/regex prefix filter over ?s forces an unbound full-graph scan per
    // edge; every delete pattern must anchor on a ground subject or object instead.
    assertFalse(statements.contains("STRSTARTS"));
    assertEquals(1, countOccurrences(statements, "WHERE"), statements);
    assertDoesNotThrow(() -> UpdateAction.parseExecute(statements, DatasetFactory.createTxnMem()));
  }

  @Test
  void reconcileBatchUsesOneWhereBearingOperation() {
    RdfStorageInterface storage = mock(RdfStorageInterface.class);
    RdfRepository repository = repository(storage);

    repository.bulkAddLineage(List.of(edge("SELECT 1"), edge("SELECT 2")), RdfWriteMode.RECONCILE);

    ArgumentCaptor<String> updateCaptor = ArgumentCaptor.forClass(String.class);
    verify(storage).executeSparqlUpdate(updateCaptor.capture());
    String update = updateCaptor.getValue();
    assertEquals(1, countOccurrences(update, "WHERE"), update);
    assertTrue(update.contains("INSERT DATA"), update);
    assertDoesNotThrow(() -> UpdateAction.parseExecute(update, DatasetFactory.createTxnMem()));
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

  private static int countOccurrences(String haystack, String needle) {
    int count = 0;
    int from = 0;
    while ((from = haystack.indexOf(needle, from)) >= 0) {
      count++;
      from += needle.length();
    }
    return count;
  }
}
