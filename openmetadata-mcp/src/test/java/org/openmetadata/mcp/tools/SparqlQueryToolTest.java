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

package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

class SparqlQueryToolTest {

  private static final Authorizer AUTHORIZER = mock(Authorizer.class);
  private static final CatalogSecurityContext SECURITY_CONTEXT = mock(CatalogSecurityContext.class);

  @Test
  void rejectsMissingBlankAndMalformedQueries() {
    assertValidationError("'query' parameter is required", Map.of());
    assertValidationError("'query' parameter is required", Map.of("query", "   "));

    IllegalArgumentException malformed =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                new SparqlQueryTool(() -> null)
                    .execute(
                        AUTHORIZER, SECURITY_CONTEXT, Map.of("query", "not sparql at all {{}}")));
    assertTrue(malformed.getMessage().startsWith("Invalid SPARQL query"));
  }

  @Test
  void rejectsUpdateOperations() {
    for (String update :
        List.of(
            "INSERT DATA { <urn:s> <urn:p> <urn:o> }",
            "DELETE WHERE { ?s ?p ?o }",
            "DROP GRAPH <urn:graph>")) {
      assertThrows(
          IllegalArgumentException.class,
          () ->
              new SparqlQueryTool(() -> null)
                  .execute(AUTHORIZER, SECURITY_CONTEXT, Map.of("query", update)));
    }
  }

  @Test
  void rejectsUnavailableRepository() {
    RdfRepository repository = mock(RdfRepository.class);
    when(repository.isEnabled()).thenReturn(false);

    assertThrows(
        IllegalStateException.class,
        () ->
            tool(repository)
                .execute(
                    AUTHORIZER, SECURITY_CONTEXT, Map.of("query", "SELECT * WHERE { ?s ?p ?o }")));
  }

  @Test
  void rejectsDisallowedFederation() {
    RdfRepository repository = enabledRepository();
    String query = "SELECT * WHERE { SERVICE <https://attacker.example/sparql> { ?s ?p ?o } }";

    assertThrows(
        SparqlFederationGuard.FederationDisallowedException.class,
        () -> tool(repository).execute(AUTHORIZER, SECURITY_CONTEXT, Map.of("query", query)));
  }

  @Test
  void returnsTypedSelectResult() throws IOException {
    RdfRepository repository = enabledRepository();
    String query = "SELECT * WHERE { ?s ?p ?o } LIMIT 1";
    when(repository.executeSparqlQuery(query, "application/sparql-results+json"))
        .thenReturn("{\"results\":{\"bindings\":[]}}");

    SparqlQueryTool.Result result =
        tool(repository).execute(AUTHORIZER, SECURITY_CONTEXT, Map.of("query", query));

    assertEquals("json", result.format());
    assertEquals("SELECT", result.queryType());
    assertFalse(result.truncated());
    assertEquals(27, result.byteCount());
  }

  @Test
  void truncatesAtUtf8Boundary() throws IOException {
    RdfRepository repository = enabledRepository();
    when(repository.executeSparqlQuery(anyString(), anyString())).thenReturn("é".repeat(4_000));

    SparqlQueryTool.Result result =
        tool(repository)
            .execute(
                AUTHORIZER,
                SECURITY_CONTEXT,
                Map.of("query", "SELECT * WHERE { ?s ?p ?o }", "maxBytes", 2049));

    assertTrue(result.truncated());
    assertTrue(result.body().getBytes(StandardCharsets.UTF_8).length <= 2049);
    assertEquals(8_000, result.byteCount());
  }

  @Test
  void routesInferenceThroughTheSharedService() throws IOException {
    RdfRepository repository = enabledRepository();
    when(repository.executeSparqlQueryWithInferenceResult(anyString(), anyString(), eq("rdfs")))
        .thenReturn(new RdfRepository.InferenceQueryResult("{}", null));

    tool(repository)
        .execute(
            AUTHORIZER,
            SECURITY_CONTEXT,
            Map.of("query", "SELECT * WHERE { ?s ?p ?o }", "inferenceLevel", "rdfs"));

    verify(repository)
        .executeSparqlQueryWithInferenceResult(
            anyString(), eq("application/sparql-results+json"), eq("rdfs"));
  }

  @Test
  void defaultsGraphQueriesToTurtleAndRejectsIncompatibleFormats() throws IOException {
    RdfRepository repository = enabledRepository();
    when(repository.executeSparqlQuery(anyString(), eq("text/turtle"))).thenReturn("");

    SparqlQueryTool.Result result =
        tool(repository)
            .execute(
                AUTHORIZER,
                SECURITY_CONTEXT,
                Map.of("query", "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }"));

    assertEquals("turtle", result.format());
    assertThrows(
        IllegalArgumentException.class,
        () ->
            tool(repository)
                .execute(
                    AUTHORIZER,
                    SECURITY_CONTEXT,
                    Map.of("query", "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }", "format", "csv")));
  }

  @Test
  void rejectsUnsupportedFormats() {
    RdfRepository repository = enabledRepository();

    assertThrows(
        IllegalArgumentException.class,
        () ->
            tool(repository)
                .execute(
                    AUTHORIZER,
                    SECURITY_CONTEXT,
                    Map.of("query", "SELECT * WHERE { ?s ?p ?o }", "format", "binary")));
  }

  @Test
  void writeContractIsNotSupported() {
    assertThrows(
        UnsupportedOperationException.class,
        () ->
            new SparqlQueryTool(() -> null)
                .execute(AUTHORIZER, null, SECURITY_CONTEXT, Map.of("query", "ASK {}")));
  }

  private static void assertValidationError(String expectedMessage, Map<String, Object> params) {
    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () -> new SparqlQueryTool(() -> null).execute(AUTHORIZER, SECURITY_CONTEXT, params));
    assertEquals(expectedMessage, exception.getMessage());
  }

  private static SparqlQueryTool tool(RdfRepository repository) {
    return new SparqlQueryTool(() -> repository);
  }

  private static RdfRepository enabledRepository() {
    RdfRepository repository = mock(RdfRepository.class);
    when(repository.isEnabled()).thenReturn(true);
    when(repository.getConfig()).thenReturn(new RdfConfiguration());
    return repository;
  }
}
