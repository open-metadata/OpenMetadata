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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.apache.jena.query.QueryFactory;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

class FindByTagToolTest {

  private static final Authorizer AUTHORIZER = mock(Authorizer.class);
  private static final CatalogSecurityContext SECURITY_CONTEXT = mock(CatalogSecurityContext.class);

  @Test
  void rejectsMissingTagFqn() {
    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () -> new FindByTagTool(() -> null).execute(AUTHORIZER, SECURITY_CONTEXT, Map.of()));

    assertEquals("'tagFqn' parameter is required", exception.getMessage());
  }

  @Test
  void rejectsInvalidEntityType() {
    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                new FindByTagTool(() -> null)
                    .execute(
                        AUTHORIZER,
                        SECURITY_CONTEXT,
                        Map.of("tagFqn", "PII.Sensitive", "entityType", "table OR 1=1")));

    assertEquals("'entityType' must be alphanumeric", exception.getMessage());
  }

  @Test
  void parameterizesTagFqnInsteadOfRejectingValidLiteralCharacters() {
    String query = FindByTagTool.buildSparql("PII\".Sensitive\\Tier\n2", "table", 50, 0);

    QueryFactory.create(query);
    assertTrue(query.contains("PII\\\".Sensitive"));
    assertTrue(query.contains("ontology/Table"));
  }

  @Test
  void rejectsDisabledRepository() {
    RdfRepository repository = mock(RdfRepository.class);
    when(repository.isEnabled()).thenReturn(false);

    assertThrows(
        IllegalStateException.class,
        () ->
            tool(repository)
                .execute(AUTHORIZER, SECURITY_CONTEXT, Map.of("tagFqn", "PII.Sensitive")));
  }

  @Test
  void returnsTypedEntityMatches() throws IOException {
    RdfRepository repository = enabledRepository();
    when(repository.executeSparqlQuery(anyString(), anyString()))
        .thenReturn(
            """
            {"results":{"bindings":[{
              "entity":{"value":"https://open-metadata.org/entity/table/abc"},
              "entityType":{"value":"https://open-metadata.org/ontology/Table"},
              "fqn":{"value":"service.database.schema.table"},
              "label":{"value":"table"}
            }]}}
            """);

    FindByTagTool.Result result =
        tool(repository).execute(AUTHORIZER, SECURITY_CONTEXT, Map.of("tagFqn", "PII.Sensitive"));

    assertEquals(1, result.returnedCount());
    assertEquals("service.database.schema.table", result.results().getFirst().fullyQualifiedName());
  }

  @Test
  void queryMatchesTagsAndGlossaryTerms() {
    String query = FindByTagTool.buildSparql("BusinessTerms.PII", null, 50, 0);

    assertTrue(query.contains("om:tagFQN"));
    assertTrue(query.contains("om:fullyQualifiedName"));
    assertTrue(query.contains("\"BusinessTerms.PII\""));
  }

  @Test
  void returnsAnEmptyImmutableResultAndClampsLimit() throws IOException {
    RdfRepository repository = enabledRepository();
    when(repository.executeSparqlQuery(anyString(), anyString()))
        .thenReturn("{\"results\":{\"bindings\":[]}}");

    FindByTagTool.Result result =
        tool(repository)
            .execute(AUTHORIZER, SECURITY_CONTEXT, Map.of("tagFqn", "PII.None", "limit", 999_999));

    assertEquals(500, result.limit());
    assertEquals(0, result.returnedCount());
    assertEquals(List.of(), result.results());
  }

  private static FindByTagTool tool(RdfRepository repository) {
    return new FindByTagTool(() -> repository);
  }

  private static RdfRepository enabledRepository() {
    RdfRepository repository = mock(RdfRepository.class);
    when(repository.isEnabled()).thenReturn(true);
    return repository;
  }
}
