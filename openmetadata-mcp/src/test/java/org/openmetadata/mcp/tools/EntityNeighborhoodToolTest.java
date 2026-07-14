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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

class EntityNeighborhoodToolTest {

  private static final Authorizer AUTHORIZER = mock(Authorizer.class);
  private static final CatalogSecurityContext SECURITY_CONTEXT = mock(CatalogSecurityContext.class);

  @Test
  void rejectsMissingEntityId() {
    assertValidationError("'entityId' parameter is required", Map.of("entityType", "table"));
  }

  @Test
  void rejectsMissingEntityType() {
    assertValidationError(
        "'entityType' parameter is required", Map.of("entityId", UUID.randomUUID().toString()));
  }

  @Test
  void rejectsInvalidEntityReference() {
    assertValidationError(
        "'entityId' must be a UUID", Map.of("entityId", "not-a-uuid", "entityType", "table"));
    assertValidationError(
        "'entityType' must be alphanumeric",
        Map.of("entityId", UUID.randomUUID().toString(), "entityType", "table> ; DROP --"));
  }

  @Test
  void rejectsDisabledRepository() {
    RdfRepository repository = mock(RdfRepository.class);
    when(repository.isEnabled()).thenReturn(false);

    IllegalStateException exception =
        assertThrows(
            IllegalStateException.class,
            () ->
                tool(repository)
                    .execute(
                        AUTHORIZER,
                        SECURITY_CONTEXT,
                        Map.of("entityId", UUID.randomUUID().toString(), "entityType", "table")));

    assertTrue(exception.getMessage().contains("not enabled"));
  }

  @Test
  void returnsTypedNeighborhoodAndClampsDepth() throws IOException {
    RdfRepository repository = enabledRepository();
    when(repository.executeSparqlQuery(anyString(), org.mockito.ArgumentMatchers.eq("text/turtle")))
        .thenReturn("<urn:table> <urn:hasColumn> <urn:column> .");
    when(repository.executeSparqlQuery(
            anyString(), org.mockito.ArgumentMatchers.eq("application/sparql-results+json")))
        .thenReturn(
            """
            {"results":{"bindings":[{
              "direction":{"value":"outgoing"},
              "predicate":{"value":"https://open-metadata.org/ontology/hasColumn"},
              "neighbor":{"value":"urn:column"}
            }]}}
            """);

    EntityNeighborhoodTool.Neighborhood result =
        tool(repository)
            .execute(
                AUTHORIZER,
                SECURITY_CONTEXT,
                Map.of(
                    "entityId",
                    "11111111-1111-1111-1111-111111111111",
                    "entityType",
                    "table",
                    "depth",
                    99));

    assertEquals(3, result.depth());
    assertNotNull(result.triples());
    assertEquals(1, result.edges().size());
    assertEquals("outgoing", result.edges().getFirst().direction());
  }

  @Test
  void constructQueryIncludesIncomingEdgesAndRespectsDepth() {
    String depthOne = EntityNeighborhoodTool.buildConstructQuery("urn:entity", 1, 100);
    String depthThree = EntityNeighborhoodTool.buildConstructQuery("urn:entity", 3, 100);

    assertTrue(depthOne.contains("?s ?p <urn:entity>"));
    assertFalse(depthOne.contains("?n3"));
    assertTrue(depthThree.contains("?n3"));
  }

  @Test
  void constructQueryPreservesTheIntermediateSubject() {
    String query = EntityNeighborhoodTool.buildConstructQuery("urn:entity", 2, 100);

    assertTrue(query.contains("<urn:entity> ?p1 ?s . ?s ?p ?o"));
  }

  @Test
  void wrapsRepositoryFailureWithNeighborhoodContext() {
    RdfRepository repository = enabledRepository();
    when(repository.executeSparqlQuery(anyString(), anyString()))
        .thenThrow(new RuntimeException("connection refused"));

    IllegalStateException exception =
        assertThrows(
            IllegalStateException.class,
            () ->
                tool(repository)
                    .execute(
                        AUTHORIZER,
                        SECURITY_CONTEXT,
                        Map.of(
                            "entityId",
                            "22222222-2222-2222-2222-222222222222",
                            "entityType",
                            "pipeline")));

    assertTrue(exception.getMessage().contains("Neighborhood query failed"));
  }

  private static void assertValidationError(String expectedMessage, Map<String, Object> params) {
    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                new EntityNeighborhoodTool(() -> null)
                    .execute(AUTHORIZER, SECURITY_CONTEXT, params));
    assertEquals(expectedMessage, exception.getMessage());
  }

  private static EntityNeighborhoodTool tool(RdfRepository repository) {
    return new EntityNeighborhoodTool(() -> repository);
  }

  private static RdfRepository enabledRepository() {
    RdfRepository repository = mock(RdfRepository.class);
    when(repository.isEnabled()).thenReturn(true);
    when(repository.getBaseUri()).thenReturn("https://open-metadata.org/");
    return repository;
  }
}
