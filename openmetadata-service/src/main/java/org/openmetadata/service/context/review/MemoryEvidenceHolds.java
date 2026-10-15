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

package org.openmetadata.service.context.review;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.governance.workflows.WorkflowEventConsumer.GOVERNANCE_BOT;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;

/**
 * Holds every active memory a Query supports for review once that Query is retired
 * (ADR:2026-10-15-a-memory-cites-its-supporting-queries-and-their-retirement-holds-it-for-review).
 * The Query's delete calls it first: a Query has no soft delete, so every delete removes the
 * relationship rows that say which memories cite it, and a hold that fails refuses the delete
 * instead of leaving an Approved memory whose evidence is gone.
 */
@Slf4j
public final class MemoryEvidenceHolds {

  static final String EVIDENCE_RETIRED =
      "Supporting query %s was deleted; review whether this memory still holds without it";
  static final String CHANGED_WHILE_HOLDING =
      "A memory changed while its retired evidence was being recorded; delete the query again";

  /** Concurrent edits a hold re-reads through before it refuses the delete. */
  static final int MAX_ATTEMPTS = 3;

  /** Unprocessed counts: Memory Reconciliation could otherwise approve it without its evidence. */
  private static final Set<ContextMemoryStatus> ACTIVE =
      Set.of(ContextMemoryStatus.APPROVED, ContextMemoryStatus.UNPROCESSED);

  private static final GuardedMemoryPatch.Writer HOLDER =
      new GuardedMemoryPatch.Writer(
          GOVERNANCE_BOT, ChangeSource.AUTOMATED, null, CHANGED_WHILE_HOLDING);

  /** Where memories live: which ones cite a Query, the memory as stored, and a guarded write. */
  interface MemoryStore {
    List<UUID> citing(UUID queryId);

    Optional<ContextMemory> load(UUID memoryId);

    void write(MemoryChange change);
  }

  private final MemoryStore store;

  MemoryEvidenceHolds(MemoryStore store) {
    this.store = store;
  }

  public static MemoryEvidenceHolds inCatalog() {
    return new MemoryEvidenceHolds(new CatalogMemoryStore());
  }

  public void holdMemoriesSupportedBy(Query query) {
    store.citing(query.getId()).forEach(memoryId -> hold(memoryId, query.getId()));
  }

  /**
   * A memory written citing a Query that is already retired enters review as if it had been held:
   * a capture can race the supersession of the Query it cites. {@code cited} is what the write
   * asked for; resolving it drops a Query that no longer exists, so its absence from the memory's
   * resolved {@code relatedEntities} is what says it was retired.
   */
  public static void holdIfCitingRetired(ContextMemory memory, List<EntityReference> cited) {
    retiredCitation(memory, cited)
        .filter(retired -> isActive(memory))
        .ifPresent(
            retired ->
                memory
                    .withEntityStatus(ContextMemoryStatus.DRAFT)
                    .withStatusReason(reason(retired.getId())));
  }

  private void hold(UUID memoryId, UUID queryId) {
    int attempt = 1;
    while (!holdOnce(memoryId, queryId, attempt)) {
      attempt++;
    }
  }

  /** False when a concurrent edit refused the write, so the memory is read and decided again. */
  private boolean holdOnce(UUID memoryId, UUID queryId, int attempt) {
    boolean settled = true;
    try {
      store
          .load(memoryId)
          .flatMap(memory -> held(memory, queryId))
          .ifPresent(
              change -> {
                store.write(change);
                LOG.info(
                    "[MemoryEvidence] memory {} held for review: supporting query {} was deleted",
                    memoryId,
                    queryId);
              });
    } catch (PreconditionFailedException concurrentEdit) {
      if (attempt >= MAX_ATTEMPTS) {
        throw concurrentEdit;
      }
      settled = false;
    }
    return settled;
  }

  /**
   * The write that holds {@code memory}: only while it is active and still cites the Query. A Draft
   * memory is already in review and keeps its reason; a retired one stays retired. The same write
   * drops the Query from {@code relatedEntities}: the delete would remove the link anyway, and
   * removing it here records the lost evidence in the memory's history and keeps its search
   * document from listing a Query that no longer exists.
   */
  static Optional<MemoryChange> held(ContextMemory memory, UUID queryId) {
    return isActive(memory) && cites(memory, queryId)
        ? Optional.of(
            new MemoryChange(
                memory,
                JsonUtils.deepCopy(memory, ContextMemory.class)
                    .withEntityStatus(ContextMemoryStatus.DRAFT)
                    .withStatusReason(reason(queryId))
                    .withRelatedEntities(withoutQuery(memory, queryId))))
        : Optional.empty();
  }

  private static List<EntityReference> withoutQuery(ContextMemory memory, UUID queryId) {
    return listOrEmpty(memory.getRelatedEntities()).stream()
        .filter(reference -> !(isQuery(reference) && queryId.equals(reference.getId())))
        .toList();
  }

  /** A memory saved before stages existed has none, and was in use. */
  static boolean isActive(ContextMemory memory) {
    return !Boolean.TRUE.equals(memory.getDeleted())
        && (memory.getEntityStatus() == null || ACTIVE.contains(memory.getEntityStatus()));
  }

  private static boolean cites(ContextMemory memory, UUID queryId) {
    return listOrEmpty(memory.getRelatedEntities()).stream()
        .anyMatch(reference -> isQuery(reference) && queryId.equals(reference.getId()));
  }

  private static Optional<EntityReference> retiredCitation(
      ContextMemory memory, List<EntityReference> cited) {
    List<EntityReference> resolved = listOrEmpty(memory.getRelatedEntities());
    return listOrEmpty(cited).stream()
        .filter(reference -> isQuery(reference) && reference.getId() != null)
        .filter(
            reference ->
                Boolean.TRUE.equals(reference.getDeleted())
                    || resolved.stream().noneMatch(kept -> reference.getId().equals(kept.getId())))
        .findFirst();
  }

  private static boolean isQuery(EntityReference reference) {
    return Entity.QUERY.equals(reference.getType());
  }

  /** Names the Query by id only: a memory's readers may not be allowed to read the Query. */
  static String reason(UUID queryId) {
    return String.format(EVIDENCE_RETIRED, queryId);
  }

  private static final class CatalogMemoryStore implements MemoryStore {

    @Override
    public List<UUID> citing(UUID queryId) {
      return Entity.getEntityRepository(Entity.QUERY)
          .findTo(queryId, Entity.QUERY, Relationship.RELATED_TO, Entity.CONTEXT_MEMORY)
          .stream()
          .map(EntityReference::getId)
          .toList();
    }

    @Override
    public Optional<ContextMemory> load(UUID memoryId) {
      ContextMemoryRepository memories =
          (ContextMemoryRepository) Entity.getEntityRepository(Entity.CONTEXT_MEMORY);
      Optional<ContextMemory> memory = Optional.empty();
      try {
        memory =
            Optional.of(
                memories.get(
                    null,
                    memoryId,
                    memories.getFields(ContextMemoryRepository.FIELD_RELATED_ENTITIES),
                    Include.NON_DELETED,
                    false));
      } catch (EntityNotFoundException deleted) {
        LOG.debug("[MemoryEvidence] memory {} is gone", memoryId, deleted);
      }
      return memory;
    }

    @Override
    public void write(MemoryChange change) {
      GuardedMemoryPatch.apply(change, HOLDER);
    }
  }
}
