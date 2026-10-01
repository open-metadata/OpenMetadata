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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ClientErrorException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.OntologyChangeSetRepository;

class OntologyMemoryDerivationServiceTest {
  private final ContextMemoryRepository memories = mock(ContextMemoryRepository.class);
  private final OntologyChangeSetRepository changeSets = mock(OntologyChangeSetRepository.class);
  private final OntologyAiCompletionGateway gateway = mock(OntologyAiCompletionGateway.class);
  private final OntologyMemoryDerivationService service =
      new OntologyMemoryDerivationService(
          memories,
          mock(GlossaryRepository.class),
          mock(GlossaryTermRepository.class),
          changeSets,
          gateway);

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
  void anotherJobReusesAnOpenProposalForTheSameMemory() {
    final UUID memoryId = UUID.randomUUID();
    final UUID changeSetId = UUID.randomUUID();
    when(memories.get(isNull(), eq(memoryId), isNull(), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(memory(memoryId, ContextMemoryStatus.ACTIVE, MemoryVisibility.PUBLIC));
    when(changeSets.findOpenBySourceMemoryId(memoryId))
        .thenReturn(List.of(new OntologyChangeSet().withId(changeSetId)));

    assertEquals(Optional.of(changeSetId), service.derive(43, null, List.of(memoryId), "alice"));
    verifyNoInteractions(gateway);
  }

  @Test
  void acceptsOnlyActivePublishedMemories() {
    final UUID id = UUID.randomUUID();
    final ContextMemory memory = memory(id, ContextMemoryStatus.ACTIVE, MemoryVisibility.ENTITY);
    when(memories.get(isNull(), eq(id), isNull(), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(memory);

    assertEquals(List.of(memory), service.loadMemories(List.of(id), "alice"));
    assertTrue(OntologyMemoryDerivationService.ownsAll(List.of(memory), "alice"));
    assertFalse(OntologyMemoryDerivationService.ownsAll(List.of(memory), "bob"));

    memory.setShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.PRIVATE));
    assertThrows(BadRequestException.class, () -> service.loadMemories(List.of(id), "bob"));
    assertEquals(List.of(memory), service.loadMemories(List.of(id), "alice"));

    memory.setShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.SHARED));
    assertEquals(List.of(memory), service.loadMemories(List.of(id), "alice"));

    memory.setShareConfig(null);
    assertEquals(List.of(memory), service.loadMemories(List.of(id), "alice"));
    assertThrows(BadRequestException.class, () -> service.loadMemories(List.of(id), "bob"));

    memory.setShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.PUBLIC));
    assertEquals(List.of(memory), service.loadMemories(List.of(id), "bob"));

    memory.setShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.ENTITY));
    for (ContextMemoryStatus status :
        List.of(
            ContextMemoryStatus.ARCHIVED,
            ContextMemoryStatus.SUPERSEDED,
            ContextMemoryStatus.INVALIDATED)) {
      memory.setStatus(status);
      assertThrows(BadRequestException.class, () -> service.loadMemories(List.of(id), "alice"));
    }
  }

  @Test
  void rejectsOversizedOrDuplicateInput() {
    final UUID id = UUID.randomUUID();
    assertThrows(BadRequestException.class, () -> service.loadMemories(List.of(id, id), "alice"));
    assertThrows(BadRequestException.class, () -> service.loadMemories(List.of(), "alice"));
  }

  @Test
  void rejectsMemoryWithAppliedGlossaryTermBeforeGeneratingAnotherDraft() {
    final UUID id = UUID.randomUUID();
    final ContextMemory memory = memory(id, ContextMemoryStatus.ACTIVE, MemoryVisibility.PUBLIC);
    memory.setDerivedEntities(
        List.of(new EntityReference().withId(UUID.randomUUID()).withType(Entity.GLOSSARY_TERM)));
    when(memories.get(isNull(), eq(id), isNull(), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(memory);

    final ClientErrorException error =
        assertThrows(ClientErrorException.class, () -> service.loadMemories(List.of(id), "alice"));

    assertEquals(409, error.getResponse().getStatus());
    verifyNoInteractions(gateway);
  }

  private static ContextMemory memory(
      final UUID id, final ContextMemoryStatus status, final MemoryVisibility visibility) {
    return new ContextMemory()
        .withId(id)
        .withQuestion("What is a customer?")
        .withAnswer("A person who bought a product.")
        .withOwners(List.of(new EntityReference().withType("user").withName("alice")))
        .withStatus(status)
        .withShareConfig(new MemoryShareConfig().withVisibility(visibility));
  }
}
