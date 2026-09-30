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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.exception.OntologyAiProviderException;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.search.SearchRepository;

class OntologyMemoryGlossarySelectorTest {
  private final GlossaryRepository repository = mock(GlossaryRepository.class);
  private final SearchRepository searchRepository = mock(SearchRepository.class);
  private final OntologyAiCompletionGateway gateway = mock(OntologyAiCompletionGateway.class);
  private final OntologyMemoryGlossarySelector selector =
      new OntologyMemoryGlossarySelector(repository, searchRepository, gateway);
  private final Glossary existing =
      new Glossary()
          .withId(UUID.randomUUID())
          .withName("Business")
          .withFullyQualifiedName("Business")
          .withDescription("Customers and products");

  @Test
  void reusesStrongSemanticMatch() {
    final var selection = selector.choose(completion(existing.getId(), 0.85D), List.of(existing));

    assertFalse(selection.create());
    assertEquals(existing.getId(), selection.glossary().getId());
  }

  @Test
  void searchesMemoryContentBeforeSemanticMatching() throws IOException {
    final Glossary narrow =
        new Glossary()
            .withId(UUID.randomUUID())
            .withName("subscription_metrics")
            .withFullyQualifiedName("subscription_metrics")
            .withDescription("Subscription revenue and customer retention");
    when(searchRepository.getIndexOrAliasName("glossary_search_index"))
        .thenReturn("glossary_search_index");
    when(searchRepository.search(any(SearchRequest.class), isNull()))
        .thenReturn(
            Response.ok("{\"hits\":{\"hits\":[{\"_source\":{\"id\":\"" + narrow.getId() + "\"}}]}}")
                .build());
    when(repository.get(isNull(), eq(narrow.getId()), isNull())).thenReturn(narrow);
    when(repository.listAfter(isNull(), isNull(), any(), eq(50), isNull()))
        .thenReturn(new ResultList<>(List.of(existing)));
    when(gateway.matchGlossary(any())).thenReturn(completion(existing.getId(), 0.85D));

    final var term =
        new OntologyAiCompletionGateway.TermContext(
            UUID.randomUUID(), "Business.Customer", "A person who buys products", null);
    final var selection =
        selector.select(
            List.of(
                new OntologyAiCompletionGateway.MemoryContext(
                    UUID.randomUUID(), "What is a customer?", "A customer buys products", null)),
            List.of(term));

    final ArgumentCaptor<SearchRequest> request = ArgumentCaptor.forClass(SearchRequest.class);
    verify(searchRepository).search(request.capture(), isNull());
    assertTrue(request.getValue().getQuery().contains("customer"));
    final ArgumentCaptor<OntologyAiCompletionGateway.GlossaryMatchPrompt> prompt =
        ArgumentCaptor.forClass(OntologyAiCompletionGateway.GlossaryMatchPrompt.class);
    verify(gateway).matchGlossary(prompt.capture());
    assertEquals(2, prompt.getValue().glossaries().size());
    assertEquals(narrow.getId(), prompt.getValue().glossaries().getFirst().id());
    assertEquals(List.of(term), prompt.getValue().glossaries().getLast().relevantTerms());
    assertFalse(selection.create());
    assertEquals(existing.getId(), selection.glossary().getId());
  }

  @Test
  void proposesNewGlossaryWhenNoCandidateFits() {
    when(repository.getByNameOrNull(
            isNull(), eq("Sales"), isNull(), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(Optional.empty());

    final var selection = selector.choose(completion(null, 0.8D), List.of(existing));

    assertTrue(selection.create());
    assertEquals("Sales", selection.glossary().getName());
    assertEquals("Sales", selection.glossary().getFullyQualifiedName());
  }

  @Test
  void proposesNewGlossaryWhenExistingMatchIsWeak() {
    when(repository.getByNameOrNull(
            isNull(), eq("Sales"), isNull(), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(Optional.empty());

    final var selection = selector.choose(completion(existing.getId(), 0.5D), List.of(existing));

    assertTrue(selection.create());
    assertEquals("Sales", selection.glossary().getName());
  }

  @Test
  void rejectsInventedExistingGlossaryIdentifier() {
    assertThrows(
        OntologyAiProviderException.class,
        () -> selector.choose(completion(UUID.randomUUID(), 0.9D), List.of(existing)));
  }

  private static OntologyAiCompletionGateway.Completion<
          OntologyAiCompletionGateway.GlossaryMatchCandidate>
      completion(final UUID glossaryId, final double confidence) {
    return new OntologyAiCompletionGateway.Completion<>(
        "test-model",
        List.of(
            new OntologyAiCompletionGateway.GlossaryMatchCandidate(
                glossaryId, "Sales", "Sales", "Sales concepts", confidence, "Semantic fit")));
  }
}
