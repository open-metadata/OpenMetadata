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
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ClientErrorException;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.api.data.CreateOntologyChangeSet;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.OntologyChangeSetRepository;
import org.openmetadata.service.search.SearchRepository;

class OntologyMemoryDerivationServiceTest {
  private final ContextMemoryRepository memories = mock(ContextMemoryRepository.class);
  private final GlossaryRepository glossaries = mock(GlossaryRepository.class);
  private final OntologyChangeSetRepository changeSets = mock(OntologyChangeSetRepository.class);
  private final OntologyAiCompletionGateway gateway = mock(OntologyAiCompletionGateway.class);
  private final SearchRepository search = mock(SearchRepository.class);
  private final List<CreateOntologyChangeSet> written = new ArrayList<>();
  private final UUID draftId = UUID.randomUUID();
  private final Glossary business =
      new Glossary()
          .withId(UUID.randomUUID())
          .withName("business")
          .withFullyQualifiedName("business")
          .withDescription("Business concepts");
  private final OntologyMemoryDerivationService service =
      new OntologyMemoryDerivationService(
          memories,
          glossaries,
          mock(GlossaryTermRepository.class),
          changeSets,
          new OntologyMemoryDerivationService.Boundaries(
              gateway,
              () -> new OntologyMemoryExistingTermFinder(search),
              () -> new OntologyMemoryGlossarySelector(glossaries, search, gateway),
              (request, user) -> {
                written.add(request);
                return draftId;
              }));

  @Test
  void resumedJobReusesItsDraftWithoutCallingTheModel() {
    final UUID changeSetId = UUID.randomUUID();
    when(changeSets.getByNameOrNull(
            isNull(), eq("memory-glossary-42"), isNull(), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(Optional.of(new OntologyChangeSet().withId(changeSetId)));

    assertEquals(
        Optional.of(changeSetId),
        service.derive(42, "business", List.of(UUID.randomUUID()), "alice"));
    verifyNoInteractions(gateway);
  }

  @Test
  void batchSkipsMemoriesThatStoppedBeingEligibleAndDerivesFromTheRest() throws IOException {
    final ContextMemory drafted = stored(memory(MemoryVisibility.ENTITY));
    final ContextMemory archived = stored(memory(MemoryVisibility.ENTITY));
    archived.setStatus(ContextMemoryStatus.ARCHIVED);
    final ContextMemory eligible = stored(memory(MemoryVisibility.ENTITY));
    final UUID deletedId = UUID.randomUUID();
    when(memories.get(isNull(), eq(deletedId), isNull(), eq(Include.NON_DELETED), eq(false)))
        .thenThrow(EntityNotFoundException.byId(deletedId.toString()));
    when(changeSets.findOpenBySourceMemoryId(drafted.getId()))
        .thenReturn(List.of(new OntologyChangeSet().withId(UUID.randomUUID())));
    stubDerivationFor(eligible);

    final Optional<UUID> result =
        service.derive(
            43,
            null,
            List.of(drafted.getId(), archived.getId(), deletedId, eligible.getId()),
            "admin");

    assertEquals(Optional.of(draftId), result);
    final OntologyChangeOperation operation = written.getFirst().getOperations().getFirst();
    assertEquals(Set.of(eligible.getId()), operation.getSourceMemoryIds());
    assertEquals("business.churned_customer", operation.getTerm().getFullyQualifiedName());
    final ArgumentCaptor<OntologyAiCompletionGateway.MemoryTermPrompt> prompt =
        ArgumentCaptor.forClass(OntologyAiCompletionGateway.MemoryTermPrompt.class);
    verify(gateway).deriveTermsFromMemories(prompt.capture());
    assertEquals(
        List.of(eligible.getId()),
        prompt.getValue().memories().stream()
            .map(OntologyAiCompletionGateway.MemoryContext::id)
            .toList());
    assertEquals(
        OntologyMemoryDerivationService.MAX_TERMS_PER_MEMORY, prompt.getValue().maxTerms());
  }

  @Test
  void jobWithNothingLeftToDeriveSkipsTheModel() {
    final ContextMemory drafted = stored(memory(MemoryVisibility.PUBLIC));
    when(changeSets.findOpenBySourceMemoryId(drafted.getId()))
        .thenReturn(List.of(new OntologyChangeSet().withId(UUID.randomUUID())));

    assertTrue(service.derive(44, null, List.of(drafted.getId()), "alice").isEmpty());
    verifyNoInteractions(gateway, search);
  }

  @Test
  void requireEligibleAcceptsPublishedMemoriesAndOwnRestrictedOnes() {
    final ContextMemory memory = memory(MemoryVisibility.ENTITY);

    OntologyMemoryDerivationService.requireEligible(List.of(memory), "bob");
    memory.setShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.PUBLIC));
    OntologyMemoryDerivationService.requireEligible(List.of(memory), "bob");
    memory.setShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.SHARED));
    OntologyMemoryDerivationService.requireEligible(List.of(memory), "alice");
    memory.setShareConfig(null);
    OntologyMemoryDerivationService.requireEligible(List.of(memory), "alice");
    assertTrue(OntologyMemoryDerivationService.ownsAll(List.of(memory), "alice"));
    assertFalse(OntologyMemoryDerivationService.ownsAll(List.of(memory), "bob"));
  }

  @Test
  void requireEligibleRejectsRestrictedInactiveAndDerivedMemories() {
    final ContextMemory restricted = memory(MemoryVisibility.PRIVATE);
    final ContextMemory archived = memory(MemoryVisibility.ENTITY);
    archived.setStatus(ContextMemoryStatus.ARCHIVED);
    final ContextMemory derived = memory(MemoryVisibility.PUBLIC);
    derived.setDerivedEntities(
        List.of(new EntityReference().withId(UUID.randomUUID()).withType(Entity.GLOSSARY_TERM)));

    assertThrows(
        BadRequestException.class,
        () -> OntologyMemoryDerivationService.requireEligible(List.of(restricted), "bob"));
    assertThrows(
        BadRequestException.class,
        () -> OntologyMemoryDerivationService.requireEligible(List.of(archived), "alice"));
    final ClientErrorException conflict =
        assertThrows(
            ClientErrorException.class,
            () -> OntologyMemoryDerivationService.requireEligible(List.of(derived), "alice"));
    assertEquals(Response.Status.CONFLICT.getStatusCode(), conflict.getResponse().getStatus());
  }

  @Test
  void requireEligibleExplainsEmptyAndOversizedMemoriesSeparately() {
    final ContextMemory empty = memory(MemoryVisibility.ENTITY).withAnswer(" ");
    final ContextMemory oversized = memory(MemoryVisibility.ENTITY).withAnswer("x".repeat(5_000));

    final BadRequestException emptyError =
        assertThrows(
            BadRequestException.class,
            () -> OntologyMemoryDerivationService.requireEligible(List.of(empty), "alice"));
    final BadRequestException oversizedError =
        assertThrows(
            BadRequestException.class,
            () -> OntologyMemoryDerivationService.requireEligible(List.of(oversized), "alice"));

    assertTrue(emptyError.getMessage().contains("question and an answer"));
    assertTrue(oversizedError.getMessage().contains("content limit"));
  }

  @Test
  void fetchRejectsOversizedOrDuplicateInputBeforeLoadingAnything() {
    final UUID id = UUID.randomUUID();

    assertThrows(BadRequestException.class, () -> service.fetchMemories(List.of(id, id)));
    assertThrows(BadRequestException.class, () -> service.fetchMemories(List.of()));
    verifyNoInteractions(memories);
  }

  private ContextMemory stored(final ContextMemory memory) {
    when(memories.get(isNull(), eq(memory.getId()), isNull(), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(memory);
    return memory;
  }

  private void stubDerivationFor(final ContextMemory memory) throws IOException {
    when(search.getIndexOrAliasName(any())).thenReturn("index");
    when(search.search(any(SearchRequest.class), isNull()))
        .thenReturn(Response.ok("{\"hits\":{\"hits\":[]}}").build());
    when(glossaries.listAfter(isNull(), isNull(), any(), eq(50), isNull()))
        .thenReturn(new ResultList<>(List.of(business)));
    when(gateway.matchGlossary(any()))
        .thenReturn(
            new OntologyAiCompletionGateway.Completion<>(
                "test-model",
                List.of(
                    new OntologyAiCompletionGateway.GlossaryMatchCandidate(
                        business.getId(), "sales", "Sales", "Sales", 0.9D, "Business fit"))));
    when(gateway.deriveTermsFromMemories(any()))
        .thenReturn(
            new OntologyAiCompletionGateway.Completion<>(
                "test-model",
                List.of(
                    new OntologyAiCompletionGateway.MemoryTermCandidate(
                        memory.getId(),
                        "churned_customer",
                        "Churned Customer",
                        "A customer who cancelled every subscription",
                        0.9D,
                        "The memory defines churn"))));
  }

  private static ContextMemory memory(final MemoryVisibility visibility) {
    return new ContextMemory()
        .withId(UUID.randomUUID())
        .withQuestion("What is a churned customer?")
        .withAnswer("A customer who cancelled every subscription.")
        .withOwners(List.of(new EntityReference().withType("user").withName("alice")))
        .withStatus(ContextMemoryStatus.ACTIVE)
        .withShareConfig(new MemoryShareConfig().withVisibility(visibility));
  }
}
