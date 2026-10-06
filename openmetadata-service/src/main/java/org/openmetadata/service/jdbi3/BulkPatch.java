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

package org.openmetadata.service.jdbi3;

import jakarta.json.JsonPatch;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.EntityRepository.Operation;
import org.openmetadata.service.rules.RuleEngine;
import org.openmetadata.service.security.ChangeActor;
import org.openmetadata.service.util.ChildFieldResolver;
import org.openmetadata.service.util.EntityUtil.Fields;

/**
 * PATCH for many entities of one type at once. Each entity goes through the steps a single PATCH
 * runs on it (the same load, preparation, rule checks and entity updater, in its own transaction),
 * then the entity rows, version history, search documents and change events are written in batches.
 *
 * <p>Like the bulk API, it does not consolidate an edit into the editor's previous version: every
 * edit is its own version.
 */
@Slf4j
final class BulkPatch<T extends EntityInterface> {

  private static final String BATCH_PHASE = "bulkPatch";

  /** The in-memory edit to make to one loaded entity. */
  record Edit<E>(UUID id, Consumer<E> apply) {}

  private record Candidate<E>(E updated, Set<String> patchedFields) {}

  private final EntityRepository<T> repository;
  private final ChangeActor actor;
  private final boolean dryRun;
  private final Map<UUID, String> failures = new HashMap<>();

  BulkPatch(EntityRepository<T> repository, ChangeActor actor, boolean dryRun) {
    this.repository = repository;
    this.actor = actor;
    this.dryRun = dryRun;
  }

  /**
   * Applies the edits and returns the failure message of every entity that could not be edited. In
   * a dry run nothing is written, but every check a real run would make still runs.
   */
  Map<UUID, String> apply(List<Edit<T>> edits) {
    Map<UUID, T> originals = load(edits);
    List<EntityRepository<T>.EntityUpdater> changed = new ArrayList<>();
    for (Edit<T> edit : edits) {
      Optional.ofNullable(originals.get(edit.id()))
          .ifPresentOrElse(
              original -> edit(original, edit).ifPresent(changed::add),
              () -> failures.put(edit.id(), notFound(edit.id())));
    }
    List<EntityRepository<T>.EntityUpdater> stored = store(changed);
    react(stored);
    return failures;
  }

  // The load PATCH does, for all entities at once. Child fields get their FQNs so edits can
  // address them.
  private Map<UUID, T> load(List<Edit<T>> edits) {
    List<UUID> ids = edits.stream().map(Edit::id).distinct().toList();
    List<T> entities = repository.get(null, ids, loadFields(), Include.NON_DELETED);
    if (ChildFieldResolver.supports(repository.getEntityType())) {
      entities.forEach(e -> ChildFieldResolver.ensureChildFqns(e, repository.getEntityType()));
    }
    return entities.stream().collect(Collectors.toMap(EntityInterface::getId, Function.identity()));
  }

  // A single PATCH load always fills child-field tags, but some bulk readers (topic, search index,
  // API endpoint) only fill them when the child container itself is requested.
  private Fields loadFields() {
    String entityType = repository.getEntityType();
    Set<String> fields = new LinkedHashSet<>(repository.getPatchFields().getFieldList());
    if (ChildFieldResolver.supports(entityType)) {
      fields.addAll(List.of(ChildFieldResolver.containerFields(entityType).split(",")));
    }
    return repository.getFields(String.join(",", fields));
  }

  private Optional<EntityRepository<T>.EntityUpdater> edit(T original, Edit<T> edit) {
    Optional<EntityRepository<T>.EntityUpdater> updater = Optional.empty();
    try {
      updater = dryRun ? validate(original, edit) : update(original, edit);
    } catch (Exception e) {
      LOG.debug("Bulk patch failed for {} {}", repository.getEntityType(), original.getId(), e);
      failures.put(original.getId(), messageOf(e));
    }
    return updater;
  }

  private Optional<EntityRepository<T>.EntityUpdater> validate(T original, Edit<T> edit) {
    candidate(original, edit).ifPresent(candidate -> prepare(original, candidate.updated()));
    return Optional.empty();
  }

  // Its own transaction, so an entity that fails part-way leaves nothing behind. A deadlock replay
  // starts again from fresh copies, because the updater mutates what it is given.
  private Optional<EntityRepository<T>.EntityUpdater> update(T original, Edit<T> edit) {
    List<EntityRepository<T>.EntityUpdater> result = new ArrayList<>(1);
    repository.flushInOneTransaction(
        () -> {
          result.clear();
          updateOnce(JsonUtils.deepCopy(original, repository.getEntityClass()), edit)
              .ifPresent(result::add);
        });
    return result.stream().findFirst();
  }

  private Optional<EntityRepository<T>.EntityUpdater> updateOnce(T original, Edit<T> edit) {
    Optional<EntityRepository<T>.EntityUpdater> result = Optional.empty();
    Optional<Candidate<T>> candidate = candidate(original, edit);
    if (candidate.isPresent()) {
      T updated = prepare(original, candidate.get().updated());
      EntityRepository<T>.EntityUpdater updater =
          repository.getUpdater(original, updated, Operation.PATCH, null);
      updater.setPatchedFields(candidate.get().patchedFields());
      updater.updateWithDeferredStore();
      result = Optional.of(updater).filter(u -> u.isVersionChanged() || u.isEntityChanged());
    }
    return result;
  }

  private Optional<Candidate<T>> candidate(T original, Edit<T> edit) {
    T updated = JsonUtils.deepCopy(original, repository.getEntityClass());
    edit.apply().accept(updated);
    JsonPatch diff = JsonUtils.getJsonPatch(original, updated);
    return diff.toJsonArray().isEmpty()
        ? Optional.empty()
        : Optional.of(new Candidate<>(updated, JsonUtils.extractPatchedFields(diff)));
  }

  // The preparation PATCH runs on the patched entity before its updater.
  private T prepare(T original, T edited) {
    T updated = repository.restorePatchSecrets(original, edited);
    updated.setUpdatedBy(actor.userName());
    updated.setUpdatedAt(System.currentTimeMillis());
    repository.prepareInternal(updated, true);
    RuleEngine.getInstance().evaluateUpdate(original, updated);
    updated.setOwners(repository.getValidatedOwners(updated.getOwners()));
    updated.setDomains(repository.getValidatedDomains(updated.getDomains()));
    repository.restorePatchAttributes(original, updated);
    updated.setImpersonatedBy(actor.impersonatedBy());
    return updated;
  }

  private List<EntityRepository<T>.EntityUpdater> store(
      List<EntityRepository<T>.EntityUpdater> changed) {
    List<EntityRepository<T>.EntityUpdater> stored = changed;
    if (!changed.isEmpty()) {
      try {
        repository.flushInOneTransaction(() -> storeBatch(changed));
      } catch (Exception e) {
        LOG.warn("Batched store failed, storing {} entities one by one", changed.size(), e);
        stored = changed.stream().filter(this::storeOne).toList();
      }
      repository.invalidateMany(entities(stored));
    }
    return stored;
  }

  private void storeBatch(List<EntityRepository<T>.EntityUpdater> changed) {
    repository.writeBulkVersionHistory(changed, BATCH_PHASE);
    repository.updateMany(entities(changed));
  }

  private boolean storeOne(EntityRepository<T>.EntityUpdater updater) {
    boolean stored = false;
    try {
      repository.flushInOneTransaction(updater::storeUpdate);
      stored = true;
    } catch (Exception e) {
      failures.put(updater.getUpdated().getId(), messageOf(e));
    }
    return stored;
  }

  // After commit, as in a single PATCH: each type's own post-update hooks still run, while the
  // search updates they raise go out as one bulk request. Inherited fields are filled in first, so
  // an asset that loses its own domain is indexed with the one it now inherits.
  private void react(List<EntityRepository<T>.EntityUpdater> stored) {
    repository.setInheritedFields(entities(stored), repository.getPatchFields());
    EntityLifecycleEventDispatcher.getInstance().batchUpdates(() -> stored.forEach(this::reactOne));
    List<String> events = new ArrayList<>();
    for (EntityRepository<T>.EntityUpdater updater : stored) {
      repository
          .buildChangeEventJsonForBulkOperation(
              updater.getUpdated(), updater.getChangeType(), actor.userName())
          .ifPresent(events::add);
    }
    repository.insertChangeEventsBatch(events);
  }

  private void reactOne(EntityRepository<T>.EntityUpdater updater) {
    try {
      repository.postUpdate(updater.getOriginal(), updater.getUpdated());
      updater.runDeferredReactOperations();
    } catch (Exception e) {
      LOG.error(
          "Post-update work failed for {} {}",
          repository.getEntityType(),
          updater.getUpdated().getId(),
          e);
    }
  }

  private List<T> entities(List<EntityRepository<T>.EntityUpdater> updaters) {
    return updaters.stream().map(updater -> updater.getUpdated()).toList();
  }

  private String notFound(UUID id) {
    return CatalogExceptionMessage.entityNotFound(repository.getEntityType(), id);
  }

  private static String messageOf(Exception e) {
    return e.getMessage() == null ? e.toString() : e.getMessage();
  }
}
