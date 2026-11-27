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
package org.openmetadata.service.aicontext;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ServiceUnavailableException;
import java.io.IOException;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.personaContext.ContextRule;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;

class PersonaContextRuleValidationTest {
  @Test
  void malformedAndBodilessQueriesAreBadRequests() {
    for (String query : List.of("not JSON", "null", "[]", "{\"query\":null}", "{\"query\":[]}")) {
      assertThrows(
          BadRequestException.class, () -> PersonaContextRuleValidation.query(query), query);
    }
  }

  @Test
  void acceptsBareAndWrappedQueries() {
    assertEquals(
        PersonaContextRuleValidation.query("{\"term\":{\"domain\":\"A\"}}"),
        PersonaContextRuleValidation.query("{\"query\":{\"term\":{\"domain\":\"A\"}}}"));
  }

  @Test
  void rejectsFiltersTheSearchEngineCannotExecuteInEitherDeliveryMode() throws IOException {
    SearchRepository repository =
        repository(new SearchClient.RawSearchResponse(200, "{\"valid\":false}"));
    for (boolean scoped : List.of(true, false)) {
      ContextRule rule = rule().withFilteredInSearch(scoped);
      assertThrows(
          BadRequestException.class, () -> PersonaContextRuleValidation.validate(rule, repository));
    }
  }

  @Test
  void acceptsValidFiltersAndPreservesUnfilteredRules() throws IOException {
    SearchRepository repository =
        repository(new SearchClient.RawSearchResponse(200, "{\"valid\":true}"));
    assertDoesNotThrow(() -> PersonaContextRuleValidation.validate(rule(), repository));
    assertDoesNotThrow(
        () -> PersonaContextRuleValidation.validate(rule().withQueryFilter(""), null));
  }

  @Test
  void distinguishesUnavailableSearchFromInvalidInput() throws IOException {
    SearchRepository repository = repository(new SearchClient.RawSearchResponse(503, "{}"));
    assertThrows(
        ServiceUnavailableException.class,
        () -> PersonaContextRuleValidation.validate(rule(), repository));
    when(repository.getSearchClient().rawSearchRequest(anyString(), anyString(), anyString()))
        .thenThrow(new IOException("Unavailable"));
    assertThrows(
        ServiceUnavailableException.class,
        () -> PersonaContextRuleValidation.validate(rule(), repository));
  }

  private SearchRepository repository(SearchClient.RawSearchResponse response) throws IOException {
    SearchRepository repository = mock(SearchRepository.class);
    SearchClient client = mock(SearchClient.class);
    when(repository.getSearchClient()).thenReturn(client);
    when(repository.getIndexOrAliasName(Entity.TABLE)).thenReturn("tables");
    when(client.rawSearchRequest(anyString(), anyString(), anyString())).thenReturn(response);
    return repository;
  }

  private ContextRule rule() {
    return new ContextRule()
        .withName("Tables")
        .withEntityType(Entity.TABLE)
        .withQueryFilter("{\"regexp\":{\"name\":\"[shop\"}}");
  }
}
