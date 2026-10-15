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

package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.service.exception.OntologyAiProviderException;
import org.openmetadata.service.search.SearchRepository;

class OntologyMemoryExistingTermFinderTest {
  private final SearchRepository searchRepository = mock(SearchRepository.class);
  private final OntologyMemoryExistingTermFinder finder =
      new OntologyMemoryExistingTermFinder(searchRepository);
  private final UUID memoryId = UUID.randomUUID();

  @Test
  void passesExistingConceptsToTheSuggestionPrompt() throws IOException {
    final UUID termId = UUID.randomUUID();
    when(searchRepository.getIndexOrAliasName("glossary_term_search_index"))
        .thenReturn("glossary_term_search_index");
    when(searchRepository.search(any(SearchRequest.class), isNull()))
        .thenReturn(
            Response.ok(
                    "{\"hits\":{\"hits\":[{\"_source\":{\"id\":\""
                        + termId
                        + "\",\"fullyQualifiedName\":\"business.inactive_customer\","
                        + "\"description\":\"No purchase in three months\"}}]}}")
                .build());

    final var terms = finder.find(List.of(memory()));

    assertEquals(1, terms.size());
    assertEquals(termId, terms.getFirst().id());
    assertEquals("business.inactive_customer", terms.getFirst().name());
    assertEquals("No purchase in three months", terms.getFirst().description());
  }

  @Test
  void allowsNoMatchesButDoesNotTreatSearchFailureAsNoMatches() throws IOException {
    when(searchRepository.getIndexOrAliasName("glossary_term_search_index"))
        .thenReturn("glossary_term_search_index");
    when(searchRepository.search(any(SearchRequest.class), isNull()))
        .thenReturn(Response.ok("{\"hits\":{\"hits\":[]}}").build());
    assertTrue(finder.find(List.of(memory())).isEmpty());

    when(searchRepository.search(any(SearchRequest.class), isNull()))
        .thenReturn(Response.ok("{}").build());
    assertThrows(OntologyAiProviderException.class, () -> finder.find(List.of(memory())));
  }

  @Test
  void treatsAMemoryWithoutSearchableWordsAsHavingNoExistingTerms() {
    final var memory = new OntologyAiCompletionGateway.MemoryContext(memoryId, "AI?", "AI.", "");

    assertTrue(finder.find(List.of(memory)).isEmpty());
    verifyNoInteractions(searchRepository);
  }

  @Test
  void refusesToGuessWhenSearchIsUnavailable() {
    assertThrows(
        OntologyAiProviderException.class,
        () -> new OntologyMemoryExistingTermFinder(null).find(List.of(memory())));
  }

  private OntologyAiCompletionGateway.MemoryContext memory() {
    return new OntologyAiCompletionGateway.MemoryContext(
        memoryId, "What is an inactive customer?", "No purchase in three months", null);
  }
}
