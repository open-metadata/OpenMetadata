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

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ClientErrorException;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.api.data.CreateOntologyChangeSet;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.OntologyChangeSetRepository;
import org.openmetadata.service.resources.ontology.OntologyChangeSetMapper;

/** Derives reviewable glossary proposals from a bounded snapshot of published memories. */
public final class OntologyMemoryDerivationService {
  private static final int MAX_MEMORIES = 20;
  private static final int MAX_MEMORY_CHARS = 4_000;
  private static final int MAX_TERMS_PER_MEMORY = 2;

  private final ContextMemoryRepository memoryRepository;
  private final GlossaryRepository glossaryRepository;
  private final GlossaryTermRepository termRepository;
  private final OntologyChangeSetRepository changeSetRepository;
  private final OntologyAiCompletionGateway gateway;
  private final OntologyMemoryDraftFactory draftFactory = new OntologyMemoryDraftFactory();

  public OntologyMemoryDerivationService(
      final ContextMemoryRepository memoryRepository,
      final GlossaryRepository glossaryRepository,
      final GlossaryTermRepository termRepository,
      final OntologyChangeSetRepository changeSetRepository,
      final OntologyAiCompletionGateway gateway) {
    this.memoryRepository = memoryRepository;
    this.glossaryRepository = glossaryRepository;
    this.termRepository = termRepository;
    this.changeSetRepository = changeSetRepository;
    this.gateway = gateway;
  }

  public Optional<UUID> derive(
      final long jobId, final String glossaryFqn, final List<UUID> memoryIds, final String user) {
    final String name = OntologyMemoryDraftFactory.changeSetName(jobId);
    final Optional<OntologyChangeSet> previous =
        changeSetRepository.getByNameOrNull(
            null, name, changeSetRepository.getFields(""), Include.NON_DELETED, false);
    if (previous.isPresent()) {
      return Optional.of(previous.get().getId());
    }
    final List<ContextMemory> memories = loadMemories(memoryIds, user);
    if (memoryIds.size() == 1) {
      final List<OntologyChangeSet> openProposals = findOpenProposals(memoryIds.getFirst());
      if (!openProposals.isEmpty()) {
        return Optional.of(openProposals.getFirst().getId());
      }
    }
    final List<OntologyAiCompletionGateway.MemoryContext> contexts =
        memories.stream().map(this::context).toList();
    final List<OntologyAiCompletionGateway.TermContext> existingTerms =
        new OntologyMemoryExistingTermFinder(Entity.getSearchRepository()).find(contexts);
    final OntologyMemoryGlossarySelector.Selection selection =
        glossaryFqn == null || glossaryFqn.isBlank()
            ? new OntologyMemoryGlossarySelector(
                    glossaryRepository, Entity.getSearchRepository(), gateway)
                .select(contexts, existingTerms)
            : new OntologyMemoryGlossarySelector.Selection(
                loadGlossary(glossaryFqn), false, 1D, null, null);
    final OntologyAiCompletionGateway.MemoryTermPrompt prompt =
        new OntologyAiCompletionGateway.MemoryTermPrompt(
            selection.glossary().getFullyQualifiedName(),
            contexts,
            existingTerms,
            memories.size() * MAX_TERMS_PER_MEMORY);
    final var completion = gateway.deriveTermsFromMemories(prompt);
    final Optional<CreateOntologyChangeSet> draft =
        draftFactory.create(
            jobId,
            selection,
            Set.copyOf(memoryIds),
            completion,
            fqn ->
                termRepository
                    .getByNameOrNull(
                        null, fqn, termRepository.getFields(""), Include.NON_DELETED, false)
                    .isPresent());
    return draft.map(request -> persist(request, user));
  }

  public List<OntologyChangeSet> findOpenProposals(final UUID memoryId) {
    return changeSetRepository.findOpenBySourceMemoryId(memoryId);
  }

  public Glossary loadGlossary(final String glossaryFqn) {
    if (glossaryFqn == null || glossaryFqn.isBlank()) {
      throw new BadRequestException("glossary is required");
    }
    final Glossary glossary =
        glossaryRepository.getByName(
            null, glossaryFqn, glossaryRepository.getFields("ontologyConfiguration"));
    if (glossary.getOntologyConfiguration() != null
        && Boolean.TRUE.equals(glossary.getOntologyConfiguration().getReadOnly())) {
      throw new BadRequestException("Glossary is read-only: " + glossaryFqn);
    }
    return glossary;
  }

  public List<ContextMemory> loadMemories(final List<UUID> memoryIds, final String user) {
    if (memoryIds == null
        || memoryIds.isEmpty()
        || memoryIds.size() > MAX_MEMORIES
        || memoryIds.stream().anyMatch(id -> id == null)
        || Set.copyOf(memoryIds).size() != memoryIds.size()) {
      throw new BadRequestException("memoryIds must contain 1 to 20 unique memories");
    }
    return memoryIds.stream().map(id -> loadMemory(id, user)).toList();
  }

  private ContextMemory loadMemory(final UUID id, final String user) {
    final ContextMemory memory =
        memoryRepository.get(
            null,
            id,
            memoryRepository.getFields("primaryEntity,owners,derivedEntities"),
            Include.NON_DELETED,
            false);
    if (memory.getStatus() != ContextMemoryStatus.ACTIVE) {
      throw new BadRequestException("Memory is not active: " + id);
    }
    final MemoryVisibility visibility =
        memory.getShareConfig() == null
            ? MemoryVisibility.PRIVATE
            : memory.getShareConfig().getVisibility();
    if (visibility != MemoryVisibility.ENTITY
        && visibility != MemoryVisibility.PUBLIC
        && !isDirectOwner(memory, user)) {
      throw new BadRequestException("Restricted memory requires an owner-initiated job: " + id);
    }
    if (memory.getDerivedEntities() != null && !memory.getDerivedEntities().isEmpty()) {
      throw new ClientErrorException(
          "Memory already has an applied glossary term: " + id, Response.Status.CONFLICT);
    }
    if (memory.getQuestion() == null
        || memory.getQuestion().isBlank()
        || memory.getAnswer() == null
        || memory.getAnswer().isBlank()
        || memory.getQuestion().length()
                + memory.getAnswer().length()
                + (memory.getSummary() == null ? 0 : memory.getSummary().length())
            > MAX_MEMORY_CHARS) {
      throw new BadRequestException("Memory exceeds the derivation content limit: " + id);
    }
    return memory;
  }

  private static boolean isDirectOwner(final ContextMemory memory, final String user) {
    return memory.getOwners() != null
        && memory.getOwners().stream()
            .anyMatch(owner -> Entity.USER.equals(owner.getType()) && user.equals(owner.getName()));
  }

  public static boolean ownsAll(final List<ContextMemory> memories, final String user) {
    return memories.stream().allMatch(memory -> isDirectOwner(memory, user));
  }

  private OntologyAiCompletionGateway.MemoryContext context(final ContextMemory memory) {
    return new OntologyAiCompletionGateway.MemoryContext(
        memory.getId(), memory.getQuestion(), memory.getAnswer(), memory.getSummary());
  }

  private UUID persist(final CreateOntologyChangeSet request, final String user) {
    final OntologyChangeSet changeSet = new OntologyChangeSetMapper().createToEntity(request, user);
    return changeSetRepository.create(null, changeSet).getId();
  }
}
