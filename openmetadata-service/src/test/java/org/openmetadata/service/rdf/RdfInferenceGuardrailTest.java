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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.service.rdf.RdfRepository.InferenceQueryResult;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;

class RdfInferenceGuardrailTest {
  private static final String ALL_DATA_QUERY = "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }";
  private static final String ONTOLOGY_QUERY =
      "CONSTRUCT { ?s ?p ?o } WHERE { GRAPH <https://open-metadata.org/graph/ontology> { ?s ?p ?o } }";
  private static final String ASK_QUERY =
      "ASK { <http://example.com/a> <http://example.com/p> <http://example.com/b> }";
  private static final String DATA =
      "<http://example.com/a> <http://example.com/p> <http://example.com/b> .";

  @Test
  void fallsBackToDirectQueryWhenStoreExceedsLimit() {
    RdfStorageInterface storage = mock(RdfStorageInterface.class);
    RdfConfiguration config =
        new RdfConfiguration().withEnabled(true).withMaxInMemoryInferenceTriples(2);
    RdfRepository repository = new RdfRepository(config, storage, null);
    String directResult = "{\"head\":{},\"boolean\":true}";
    when(storage.getTripleCount()).thenReturn(3L);
    when(storage.executeSparqlQuery(ASK_QUERY, "json")).thenReturn(directResult);

    InferenceQueryResult result =
        repository.executeSparqlQueryWithInferenceResult(ASK_QUERY, "json", "rdfs");

    assertEquals(directResult, result.results());
    assertNotNull(result.warning());
    assertTrue(result.warning().contains("3 triples"));
    assertTrue(result.warning().contains("limit of 2"));
    verify(storage, never()).executeSparqlQuery(startsWith("CONSTRUCT"), anyString());
  }

  @Test
  void executesInferenceInMemoryWhenStoreIsWithinLimit() {
    RdfStorageInterface storage = inferenceStorage();
    RdfConfiguration config =
        new RdfConfiguration().withEnabled(true).withMaxInMemoryInferenceTriples(2);
    RdfRepository repository = new RdfRepository(config, storage, null);

    InferenceQueryResult result =
        repository.executeSparqlQueryWithInferenceResult(ASK_QUERY, "json", "rdfs");

    assertNull(result.warning());
    assertTrue(result.results().contains("\"boolean\":true"));
    verify(storage).executeSparqlQuery(ALL_DATA_QUERY, "text/turtle");
    verify(storage).executeSparqlQuery(ONTOLOGY_QUERY, "text/turtle");
  }

  @Test
  void reusesBoundedInferenceModelWhenCachingIsEnabled() {
    RdfStorageInterface storage = inferenceStorage();
    RdfConfiguration config =
        new RdfConfiguration()
            .withEnabled(true)
            .withMaxInMemoryInferenceTriples(2)
            .withCacheInferredTriples(true);
    RdfRepository repository = new RdfRepository(config, storage, null);

    repository.executeSparqlQueryWithInferenceResult(ASK_QUERY, "json", "rdfs");
    repository.executeSparqlQueryWithInferenceResult(ASK_QUERY, "json", "rdfs");

    verify(storage, times(1)).executeSparqlQuery(ALL_DATA_QUERY, "text/turtle");
    verify(storage, times(1)).executeSparqlQuery(ONTOLOGY_QUERY, "text/turtle");
    verify(storage, times(2)).getTripleCount();
  }

  @Test
  void usesDefaultLimitForMissingOrInvalidConfiguration() {
    assertEquals(
        RdfRepository.DEFAULT_MAX_IN_MEMORY_INFERENCE_TRIPLES,
        RdfRepository.resolveMaxInMemoryInferenceTriples(new RdfConfiguration()));
    assertEquals(
        RdfRepository.DEFAULT_MAX_IN_MEMORY_INFERENCE_TRIPLES,
        RdfRepository.resolveMaxInMemoryInferenceTriples(
            new RdfConfiguration().withMaxInMemoryInferenceTriples(0)));
  }

  private RdfStorageInterface inferenceStorage() {
    RdfStorageInterface storage = mock(RdfStorageInterface.class);
    when(storage.getTripleCount()).thenReturn(1L);
    when(storage.executeSparqlQuery(ALL_DATA_QUERY, "text/turtle")).thenReturn(DATA);
    when(storage.executeSparqlQuery(ONTOLOGY_QUERY, "text/turtle")).thenReturn("");
    return storage;
  }
}
