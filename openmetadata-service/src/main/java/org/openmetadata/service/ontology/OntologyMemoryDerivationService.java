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
    final List<ContextMemory> memories = loadMemories(memoryIds);
    final OntologyMemoryGlossarySelector.Selection selection =
        glossaryFqn == null || glossaryFqn.isBlank()
            ? new OntologyMemoryGlossarySelector(
                    glossaryRepository, Entity.getSearchRepository(), gateway)
                .select(memories.stream().map(this::context).toList())
            : new OntologyMemoryGlossarySelector.Selection(
                loadGlossary(glossaryFqn), false, 1D, null, null);
    final OntologyAiCompletionGateway.MemoryTermPrompt prompt =
        new OntologyAiCompletionGateway.MemoryTermPrompt(
            selection.glossary().getFullyQualifiedName(),
            memories.stream().map(this::context).toList(),
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

  public List<ContextMemory> loadMemories(final List<UUID> memoryIds) {
    if (memoryIds == null
        || memoryIds.isEmpty()
        || memoryIds.size() > MAX_MEMORIES
        || memoryIds.stream().anyMatch(id -> id == null)
        || Set.copyOf(memoryIds).size() != memoryIds.size()) {
      throw new BadRequestException("memoryIds must contain 1 to 20 unique memories");
    }
    return memoryIds.stream().map(this::loadMemory).toList();
  }

  private ContextMemory loadMemory(final UUID id) {
    final ContextMemory memory =
        memoryRepository.get(
            null, id, memoryRepository.getFields("primaryEntity"), Include.NON_DELETED, false);
    if (memory.getStatus() != ContextMemoryStatus.ACTIVE
        || memory.getShareConfig() == null
        || memory.getShareConfig().getVisibility() != MemoryVisibility.ENTITY) {
      throw new BadRequestException("Memory is not active and published: " + id);
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

  private OntologyAiCompletionGateway.MemoryContext context(final ContextMemory memory) {
    return new OntologyAiCompletionGateway.MemoryContext(
        memory.getId(), memory.getQuestion(), memory.getAnswer(), memory.getSummary());
  }

  private UUID persist(final CreateOntologyChangeSet request, final String user) {
    final OntologyChangeSet changeSet = new OntologyChangeSetMapper().createToEntity(request, user);
    return changeSetRepository.create(null, changeSet).getId();
  }
}
