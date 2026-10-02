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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.jdbi3.ContextMemoryLifecycle.effectiveStatus;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ClientErrorException;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiFunction;
import java.util.function.BiPredicate;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.CreateOntologyChangeSet;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.OntologyChangeSetRepository;
import org.openmetadata.service.resources.ontology.OntologyChangeSetMapper;

/** Derives reviewable glossary proposals from a bounded snapshot of published memories. */
@Slf4j
public final class OntologyMemoryDerivationService {
  static final int MAX_MEMORIES = 20;
  static final int MAX_TERMS_PER_MEMORY = 2;
  private static final int MAX_MEMORY_CHARS = 4_000;
  private static final String MEMORY_FIELDS = "primaryEntity,owners,derivedEntities";

  private final ContextMemoryRepository memoryRepository;
  private final GlossaryRepository glossaryRepository;
  private final GlossaryTermRepository termRepository;
  private final OntologyChangeSetRepository changeSetRepository;
  private final Boundaries boundaries;
  private final OntologyMemoryDraftFactory draftFactory = new OntologyMemoryDraftFactory();

  /** The model, search, and draft-persistence boundaries, replaceable in tests. */
  record Boundaries(
      OntologyAiCompletionGateway gateway,
      Supplier<OntologyMemoryExistingTermFinder> termFinder,
      Supplier<OntologyMemoryGlossarySelector> glossarySelector,
      BiFunction<CreateOntologyChangeSet, String, UUID> draftWriter) {}

  public OntologyMemoryDerivationService(
      final ContextMemoryRepository memoryRepository,
      final GlossaryRepository glossaryRepository,
      final GlossaryTermRepository termRepository,
      final OntologyChangeSetRepository changeSetRepository,
      final OntologyAiCompletionGateway gateway) {
    this(
        memoryRepository,
        glossaryRepository,
        termRepository,
        changeSetRepository,
        new Boundaries(
            gateway,
            () -> new OntologyMemoryExistingTermFinder(Entity.getSearchRepository()),
            () ->
                new OntologyMemoryGlossarySelector(
                    glossaryRepository, Entity.getSearchRepository(), gateway),
            (request, user) ->
                changeSetRepository
                    .create(null, new OntologyChangeSetMapper().createToEntity(request, user))
                    .getId()));
  }

  OntologyMemoryDerivationService(
      final ContextMemoryRepository memoryRepository,
      final GlossaryRepository glossaryRepository,
      final GlossaryTermRepository termRepository,
      final OntologyChangeSetRepository changeSetRepository,
      final Boundaries boundaries) {
    this.memoryRepository = memoryRepository;
    this.glossaryRepository = glossaryRepository;
    this.termRepository = termRepository;
    this.changeSetRepository = changeSetRepository;
    this.boundaries = boundaries;
  }

  /**
   * Runs one queued job. Memories can change between enqueue and run, and a lifecycle batch groups
   * several of them, so memories that are no longer eligible are skipped instead of failing the
   * whole job.
   */
  public Optional<UUID> derive(
      final long jobId, final String glossaryFqn, final List<UUID> memoryIds, final String user) {
    return previousDraft(jobId)
        .or(() -> draftFrom(jobId, glossaryFqn, eligibleMemories(memoryIds, user), user));
  }

  private Optional<UUID> previousDraft(final long jobId) {
    return changeSetRepository
        .getByNameOrNull(
            null,
            OntologyMemoryDraftFactory.changeSetName(jobId),
            changeSetRepository.getFields(""),
            Include.NON_DELETED,
            false)
        .map(OntologyChangeSet::getId);
  }

  private Optional<UUID> draftFrom(
      final long jobId,
      final String glossaryFqn,
      final List<ContextMemory> memories,
      final String user) {
    final List<OntologyAiCompletionGateway.MemoryContext> contexts =
        memories.stream().map(OntologyMemoryDerivationService::context).toList();
    return contexts.isEmpty()
        ? Optional.empty()
        : proposeTerms(jobId, glossaryFqn, contexts)
            .map(request -> boundaries.draftWriter().apply(request, user));
  }

  private Optional<CreateOntologyChangeSet> proposeTerms(
      final long jobId,
      final String glossaryFqn,
      final List<OntologyAiCompletionGateway.MemoryContext> contexts) {
    final List<OntologyAiCompletionGateway.TermContext> existingTerms =
        boundaries.termFinder().get().find(contexts);
    final OntologyMemoryGlossarySelector.Selection selection =
        selectGlossary(glossaryFqn, contexts, existingTerms);
    final var completion =
        boundaries
            .gateway()
            .deriveTermsFromMemories(
                new OntologyAiCompletionGateway.MemoryTermPrompt(
                    selection.glossary().getFullyQualifiedName(),
                    contexts,
                    existingTerms,
                    contexts.size() * MAX_TERMS_PER_MEMORY));
    return draftFactory.create(
        jobId, selection, memoryIds(contexts), completion, this::isTermNameTaken);
  }

  private OntologyMemoryGlossarySelector.Selection selectGlossary(
      final String glossaryFqn,
      final List<OntologyAiCompletionGateway.MemoryContext> contexts,
      final List<OntologyAiCompletionGateway.TermContext> existingTerms) {
    return glossaryFqn == null || glossaryFqn.isBlank()
        ? boundaries.glossarySelector().get().select(contexts, existingTerms)
        : new OntologyMemoryGlossarySelector.Selection(
            loadGlossary(glossaryFqn), false, 1D, null, null);
  }

  // Deleted terms still own their name, so a draft must not plan to recreate one.
  private boolean isTermNameTaken(final String fullyQualifiedName) {
    return termRepository
        .getByNameOrNull(null, fullyQualifiedName, termRepository.getFields(""), Include.ALL, false)
        .isPresent();
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

  /** Loads the requested memories without judging them, so callers can authorize first. */
  public List<ContextMemory> fetchMemories(final List<UUID> memoryIds) {
    requireMemoryIds(memoryIds);
    return memoryIds.stream().map(this::fetchMemory).toList();
  }

  public static void requireEligible(final List<ContextMemory> memories, final String user) {
    for (final ContextMemory memory : memories) {
      final Ineligibility reason = ineligibility(memory, user);
      if (reason != null) {
        throw reason.exception(memory.getId());
      }
    }
  }

  public static boolean ownsAll(final List<ContextMemory> memories, final String user) {
    return memories.stream().allMatch(memory -> isDirectOwner(memory, user));
  }

  private List<ContextMemory> eligibleMemories(final List<UUID> memoryIds, final String user) {
    requireMemoryIds(memoryIds);
    final List<ContextMemory> eligible = new ArrayList<>();
    for (final UUID id : memoryIds) {
      final ContextMemory memory = fetchMemoryOrNull(id);
      final String skipReason = skipReason(memory, user);
      if (skipReason == null) {
        eligible.add(memory);
      } else {
        LOG.info("Skipping memory {} in ontology derivation: {}", id, skipReason);
      }
    }
    return List.copyOf(eligible);
  }

  private String skipReason(final ContextMemory memory, final String user) {
    final Ineligibility ineligibility = memory == null ? null : ineligibility(memory, user);
    final String reason;
    if (memory == null) {
      reason = "it was deleted";
    } else if (ineligibility != null) {
      reason = ineligibility.message;
    } else {
      reason = findOpenProposals(memory.getId()).isEmpty() ? null : "a draft from it awaits review";
    }
    return reason;
  }

  private static void requireMemoryIds(final List<UUID> memoryIds) {
    if (memoryIds == null
        || memoryIds.isEmpty()
        || memoryIds.size() > MAX_MEMORIES
        || memoryIds.stream().anyMatch(id -> id == null)
        || Set.copyOf(memoryIds).size() != memoryIds.size()) {
      throw new BadRequestException("memoryIds must contain 1 to 20 unique memories");
    }
  }

  private ContextMemory fetchMemory(final UUID id) {
    return memoryRepository.get(
        null, id, memoryRepository.getFields(MEMORY_FIELDS), Include.NON_DELETED, false);
  }

  private ContextMemory fetchMemoryOrNull(final UUID id) {
    try {
      return fetchMemory(id);
    } catch (EntityNotFoundException exception) {
      return null;
    }
  }

  private static Ineligibility ineligibility(final ContextMemory memory, final String user) {
    return Arrays.stream(Ineligibility.values())
        .filter(reason -> reason.appliesTo(memory, user))
        .findFirst()
        .orElse(null);
  }

  private static boolean isOrgWide(final ContextMemory memory) {
    final MemoryVisibility visibility =
        memory.getShareConfig() == null ? null : memory.getShareConfig().getVisibility();
    return visibility == MemoryVisibility.ENTITY || visibility == MemoryVisibility.PUBLIC;
  }

  private static boolean isWithinContentLimit(final ContextMemory memory) {
    return contentLength(memory) <= MAX_MEMORY_CHARS;
  }

  private static int contentLength(final ContextMemory memory) {
    return memory.getQuestion().length()
        + memory.getAnswer().length()
        + (memory.getSummary() == null ? 0 : memory.getSummary().length());
  }

  private static boolean isBlank(final String text) {
    return text == null || text.isBlank();
  }

  private static boolean isDirectOwner(final ContextMemory memory, final String user) {
    return memory.getOwners() != null
        && memory.getOwners().stream()
            .anyMatch(owner -> Entity.USER.equals(owner.getType()) && user.equals(owner.getName()));
  }

  private static Set<UUID> memoryIds(
      final List<OntologyAiCompletionGateway.MemoryContext> contexts) {
    return contexts.stream()
        .map(OntologyAiCompletionGateway.MemoryContext::id)
        .collect(Collectors.toUnmodifiableSet());
  }

  private static OntologyAiCompletionGateway.MemoryContext context(final ContextMemory memory) {
    return new OntologyAiCompletionGateway.MemoryContext(
        memory.getId(), memory.getQuestion(), memory.getAnswer(), memory.getSummary());
  }

  /** Checked in declaration order: later checks may assume the earlier ones passed. */
  private enum Ineligibility {
    INACTIVE(
        "Memory is not active",
        Response.Status.BAD_REQUEST,
        (memory, user) -> effectiveStatus(memory.getStatus()) != ContextMemoryStatus.ACTIVE),
    RESTRICTED(
        "Restricted memory requires an owner-initiated job",
        Response.Status.BAD_REQUEST,
        (memory, user) -> !isOrgWide(memory) && !isDirectOwner(memory, user)),
    ALREADY_DERIVED(
        "Memory already has an applied glossary term",
        Response.Status.CONFLICT,
        (memory, user) -> !nullOrEmpty(memory.getDerivedEntities())),
    EMPTY(
        "Memory needs a question and an answer to derive terms",
        Response.Status.BAD_REQUEST,
        (memory, user) -> isBlank(memory.getQuestion()) || isBlank(memory.getAnswer())),
    TOO_LONG(
        "Memory exceeds the derivation content limit",
        Response.Status.BAD_REQUEST,
        (memory, user) -> !isWithinContentLimit(memory));

    private final String message;
    private final Response.Status status;
    private final BiPredicate<ContextMemory, String> check;

    Ineligibility(
        final String message,
        final Response.Status status,
        final BiPredicate<ContextMemory, String> check) {
      this.message = message;
      this.status = status;
      this.check = check;
    }

    private boolean appliesTo(final ContextMemory memory, final String user) {
      return check.test(memory, user);
    }

    private ClientErrorException exception(final UUID memoryId) {
      final String detail = message + ": " + memoryId;
      return status == Response.Status.BAD_REQUEST
          ? new BadRequestException(detail)
          : new ClientErrorException(detail, status);
    }
  }
}
