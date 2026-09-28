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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.apache.jena.query.QueryExecution;
import org.apache.jena.query.QueryExecutionFactory;
import org.apache.jena.query.QueryFactory;
import org.apache.jena.query.ResultSet;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.Resource;
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
  void canonicalizesAcronymsInEntityTypeFilters() {
    String query = FindByTagTool.buildSparql("AI.Model", "llmModel", 50, 0);

    assertTrue(query.contains("ontology/LLMModel"));
    assertFalse(query.contains("ontology/LlmModel"));
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
              "entity":{"type":"uri","value":"https://open-metadata.org/entity/table/abc"},
              "entityType":{"type":"uri","value":"https://open-metadata.org/ontology/Table"},
              "fqn":{"type":"literal","value":"service.database.schema.table"},
              "label":{"type":"literal","value":"table"}
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
    assertTrue(
        query.contains(
            "FILTER(STRSTARTS(STR(?typeIri), \"https://open-metadata.org/ontology/\"))"));
  }

  /**
   * An entity carrying two ontology types must still be one result row.
   *
   * <p>OpenMetadata assets legitimately carry more than one RDF type. With {@code ?entity a
   * ?entityType} in the projection each type produced its own row, so a single asset was returned
   * twice and the limit/offset window silently counted it twice.
   */
  @Test
  void doubleTypedEntityYieldsOneRow() {
    Model source = ModelFactory.createDefaultModel();
    String ns = "https://open-metadata.org/ontology/";
    Resource tag = source.createResource("urn:tag:pii");
    Resource entity = source.createResource("urn:entity:model");
    Property tagFqn = source.createProperty(ns + "tagFQN");
    Property hasTag = source.createProperty(ns + "hasTag");
    Property fqn = source.createProperty(ns + "fullyQualifiedName");
    source.add(tag, tagFqn, "PII.Sensitive");
    source.add(entity, hasTag, tag);
    source.add(entity, fqn, "service.llm.model");
    source.add(
        entity,
        source.createProperty("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
        source.createResource(ns + "Entity"));
    source.add(
        entity,
        source.createProperty("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
        source.createResource(ns + "LLMModel"));

    String query = FindByTagTool.buildSparql("PII.Sensitive", null, 50, 0);
    int rows = 0;
    try (QueryExecution execution = QueryExecutionFactory.create(query, source)) {
      ResultSet results = execution.execSelect();
      while (results.hasNext()) {
        results.next();
        rows++;
      }
    } finally {
      source.close();
    }

    assertEquals(1, rows, "a double-typed entity was returned once per rdf:type instead of once");
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
