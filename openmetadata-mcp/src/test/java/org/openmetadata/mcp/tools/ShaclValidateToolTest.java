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
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.RdfValidationService;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

class ShaclValidateToolTest {

  private static final Authorizer AUTHORIZER = mock(Authorizer.class);
  private static final CatalogSecurityContext SECURITY_CONTEXT = mock(CatalogSecurityContext.class);

  @Test
  void rejectsUnavailableRepository() {
    assertThrows(
        IllegalStateException.class,
        () -> new ShaclValidateTool(() -> null).execute(AUTHORIZER, SECURITY_CONTEXT, Map.of()));
  }

  @Test
  void rejectsInvalidEntityUri() {
    RdfRepository repository = enabledRepository();

    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                tool(repository)
                    .execute(AUTHORIZER, SECURITY_CONTEXT, Map.of("entityUri", "not-an-http-uri")));

    assertEquals("entityUri must be an absolute http(s) IRI", exception.getMessage());
  }

  @Test
  void rejectsIncompleteOrInvalidEntityReference() {
    RdfRepository repository = enabledRepository();

    assertThrows(
        IllegalArgumentException.class,
        () ->
            tool(repository)
                .execute(
                    AUTHORIZER,
                    SECURITY_CONTEXT,
                    Map.of("entityId", UUID.randomUUID().toString())));
    IllegalArgumentException invalidId =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                tool(repository)
                    .execute(
                        AUTHORIZER,
                        SECURITY_CONTEXT,
                        Map.of("entityId", "abc", "entityType", "table")));
    assertEquals("'entityId' must be a UUID", invalidId.getMessage());
  }

  @Test
  void rejectsAmbiguousEntityScope() {
    RdfRepository repository = enabledRepository();

    assertThrows(
        IllegalArgumentException.class,
        () ->
            tool(repository)
                .execute(
                    AUTHORIZER,
                    SECURITY_CONTEXT,
                    Map.of(
                        "entityUri",
                        "https://open-metadata.org/entity/table/one",
                        "entityId",
                        UUID.randomUUID().toString(),
                        "entityType",
                        "table")));
  }

  @Test
  void returnsTypedEntityValidationResult() throws IOException {
    RdfRepository repository = enabledRepository();
    when(repository.executeSparqlQueryDirect(anyString(), anyString()))
        .thenReturn(conformingTable());

    RdfValidationService.ValidationResult result =
        tool(repository)
            .execute(
                AUTHORIZER,
                SECURITY_CONTEXT,
                Map.of("entityId", "11111111-1111-1111-1111-111111111111", "entityType", "table"));

    assertEquals("entity", result.scope());
    assertNotNull(result.report());
    assertEquals("turtle", result.format());
  }

  @Test
  void reportsShapeViolations() throws IOException {
    RdfRepository repository = enabledRepository();
    when(repository.executeSparqlQueryDirect(anyString(), anyString()))
        .thenReturn(
            """
            @prefix om: <https://open-metadata.org/ontology/> .
            <https://open-metadata.org/lineage/1> a om:ColumnLineage ;
              om:fromColumn "service.database.schema.table.column" .
            """);

    RdfValidationService.ValidationResult result =
        tool(repository)
            .execute(
                AUTHORIZER,
                SECURITY_CONTEXT,
                Map.of("entityUri", "https://open-metadata.org/lineage/1"));

    assertFalse(result.conforms());
    assertTrue(result.violationCount() > 0);
  }

  @Test
  void requiresExplicitFullGraphOptIn() {
    RdfRepository repository = enabledRepository();

    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () -> tool(repository).execute(AUTHORIZER, SECURITY_CONTEXT, Map.of()));

    assertTrue(exception.getMessage().contains("fullGraph=true"));
  }

  @Test
  void acceptsBooleanAndStringFullGraphOptIn() throws IOException {
    RdfRepository repository = enabledRepository();
    when(repository.executeSparqlQueryDirect(anyString(), anyString())).thenReturn("");

    for (Object fullGraph : List.of(true, "true")) {
      RdfValidationService.ValidationResult result =
          tool(repository).execute(AUTHORIZER, SECURITY_CONTEXT, Map.of("fullGraph", fullGraph));
      assertEquals("full-graph", result.scope());
    }
  }

  private static ShaclValidateTool tool(RdfRepository repository) {
    return new ShaclValidateTool(() -> repository);
  }

  private static RdfRepository enabledRepository() {
    RdfRepository repository = mock(RdfRepository.class);
    when(repository.isEnabled()).thenReturn(true);
    when(repository.getBaseUri()).thenReturn("https://open-metadata.org/");
    return repository;
  }

  private static String conformingTable() {
    return """
        @prefix om: <https://open-metadata.org/ontology/> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        <https://open-metadata.org/entity/table/abc> a om:Table ;
          rdfs:label "abc" ;
          om:fullyQualifiedName "service.database.schema.abc" ;
          om:hasColumn <https://open-metadata.org/entity/column/abc.id> .
        <https://open-metadata.org/entity/column/abc.id> a om:Column ;
          om:fullyQualifiedName "service.database.schema.abc.id" .
        """;
  }
}
