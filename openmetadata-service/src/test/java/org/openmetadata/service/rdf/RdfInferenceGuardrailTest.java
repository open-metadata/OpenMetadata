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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.ServiceUnavailableException;
import java.util.Locale;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.service.rdf.RdfRepository.InferenceQueryResult;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;

/** OpenMetadata never pulls the RDF store into its own heap to answer an inference request. */
class RdfInferenceGuardrailTest {
  private static final String ASK_QUERY =
      "ASK { <http://example.com/a> <http://example.com/p> <http://example.com/b> }";
  private static final String DIRECT_RESULT = "{\"head\":{},\"boolean\":true}";
  private static final String JSON_LD = "application/ld+json";
  private static final String TRIPLE_TERM_CONSTRUCT =
      "CONSTRUCT { <http://example.com/r> <http://www.w3.org/1999/02/22-rdf-syntax-ns#reifies> "
          + "<<( <http://example.com/a> <http://example.com/p> <http://example.com/b> )>> } WHERE {}";

  @ParameterizedTest
  @ValueSource(strings = {"rdfs", "owl", "RDFS"})
  void inferenceLevelsWithoutARemoteReasonerAreUnavailable(final String inferenceLevel) {
    final RdfStorageInterface storage = mock(RdfStorageInterface.class);
    final RdfRepository repository = repository(storage, materializedInference());

    final ServiceUnavailableException exception =
        assertThrows(
            ServiceUnavailableException.class,
            () ->
                repository.executeSparqlQueryWithInferenceResult(
                    ASK_QUERY, "json", inferenceLevel));

    assertTrue(exception.getMessage().contains(inferenceLevel.toLowerCase(Locale.ROOT)));
    verifyNoInteractions(storage);
  }

  @Test
  void customInferenceIsUnavailableWithoutMaterializedRules() {
    final RdfStorageInterface storage = mock(RdfStorageInterface.class);
    final RdfRepository repository = repository(storage, new RdfConfiguration().withEnabled(true));

    assertThrows(
        ServiceUnavailableException.class,
        () -> repository.executeSparqlQueryWithInferenceResult(ASK_QUERY, "json", "custom"));
    verifyNoInteractions(storage);
  }

  @Test
  void customInferenceReadsTheMaterializedRuleGraphs() {
    final RdfStorageInterface storage = mock(RdfStorageInterface.class);
    when(storage.executeSparqlQuery(ASK_QUERY, "json")).thenReturn(DIRECT_RESULT);

    final InferenceQueryResult result =
        repository(storage, materializedInference())
            .executeSparqlQueryWithInferenceResult(ASK_QUERY, "json", "custom");

    assertEquals(DIRECT_RESULT, result.results());
    assertNull(result.warning());
    verify(storage, never()).getTripleCount();
  }

  @Test
  void configuredDefaultInferenceNoLongerChangesPlainQueries() {
    final RdfStorageInterface storage = mock(RdfStorageInterface.class);
    when(storage.executeSparqlQuery(ASK_QUERY, "json")).thenReturn(DIRECT_RESULT);
    final RdfConfiguration config =
        new RdfConfiguration()
            .withEnabled(true)
            .withInferenceEnabled(true)
            .withDefaultInferenceLevel(RdfConfiguration.ReasoningLevel.RDFS);

    assertEquals(DIRECT_RESULT, repository(storage, config).executeSparqlQuery(ASK_QUERY, "json"));
    verify(storage, never()).executeSparqlQuery(startsWith("CONSTRUCT"), anyString());
    verify(storage, never()).getTripleCount();
  }

  @ParameterizedTest
  @ValueSource(strings = {"none", "custom"})
  void passesTheStorageJsonLdRejectionThroughTheInferenceWrapper(final String inferenceLevel) {
    final RdfStorageInterface storage = mock(RdfStorageInterface.class);
    when(storage.executeSparqlQuery(TRIPLE_TERM_CONSTRUCT, JSON_LD))
        .thenThrow(new UnsupportedRdfSerializationException(RdfSerializationFormat.JSON_LD));
    final RdfRepository repository = repository(storage, materializedInference());

    assertThrows(
        UnsupportedRdfSerializationException.class,
        () ->
            repository.executeSparqlQueryWithInferenceResult(
                TRIPLE_TERM_CONSTRUCT, JSON_LD, inferenceLevel));
  }

  @Test
  void stillReportsOtherInferenceFailuresAsServerErrors() {
    final RdfStorageInterface storage = mock(RdfStorageInterface.class);
    when(storage.executeSparqlQuery(ASK_QUERY, "json"))
        .thenThrow(new RuntimeException("Fuseki unavailable"));
    final RdfRepository repository = repository(storage, new RdfConfiguration().withEnabled(true));

    assertThrows(
        IllegalStateException.class,
        () -> repository.executeSparqlQueryWithInferenceResult(ASK_QUERY, "json", "none"));
  }

  private static RdfConfiguration materializedInference() {
    return new RdfConfiguration().withEnabled(true).withMaterializedInferenceEnabled(true);
  }

  private static RdfRepository repository(
      final RdfStorageInterface storage, final RdfConfiguration config) {
    return new RdfRepository(config, storage, null);
  }
}
