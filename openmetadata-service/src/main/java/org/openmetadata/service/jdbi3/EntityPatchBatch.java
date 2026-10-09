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

import com.google.common.collect.Lists;
import jakarta.json.JsonPatch;
import java.util.ArrayList;
import java.util.LinkedHashMap;
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
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.events.ChangeEventHandler;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.security.PatchRequester;
import org.openmetadata.service.security.policyevaluator.BulkFieldHydrator;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.ChildFieldResolver;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.RestUtil.PatchResponse;

/**
 * Applies an edit to many entities of one type, each as its own PATCH: authorized for that entity
 * with the operations its patch implies, saved by {@code EntityRepository.patch(original, patch,
 * actor)} in its own transaction, and recorded with the change event that PATCH records. Only the
 * loads and the event inserts are grouped.
 *
 * <p>An entity that fails (authorization, rule, validation or save) is reported with its message and
 * keeps no change; the others go on. A dry run authorizes and prepares each patch and saves nothing.
 * See ADR:2026-10-09-bulk-edits-compose-single-entity-writes and
 * ADR:2026-10-09-bulk-edits-authorize-each-entity-as-its-patch.
 */
@Slf4j
final class EntityPatchBatch<T extends EntityInterface<?>> {

  static final int GROUP_SIZE = 100;

  /** What to change on one loaded entity. */
  record EntityEdit<E>(UUID id, Consumer<E> apply) {}

  /**
   * The failure message of each entity that could not be edited, and the entities the batch changed
   * (or, in a dry run, would change). An entity the edit leaves as it was is in neither.
   */
  record PatchBatchResult(Map<UUID, String> failures, List<UUID> changed) {}

  private final EntityRepository<T> repository;
  private final PatchRequester requester;
  private final boolean dryRun;
  private final Fields loadFields;
  private final Map<UUID, String> failures = new LinkedHashMap<>();
  private final List<UUID> changed = new ArrayList<>();

  EntityPatchBatch(EntityRepository<T> repository, PatchRequester requester, boolean dryRun) {
    this.repository = repository;
    this.requester = requester;
    this.dryRun = dryRun;
    this.loadFields = loadFields(repository);
  }

  PatchBatchResult apply(List<EntityEdit<T>> edits) {
    Lists.partition(edits, GROUP_SIZE).forEach(this::applyGroup);
    return new PatchBatchResult(failures, changed);
  }

  private void applyGroup(List<EntityEdit<T>> group) {
    Map<UUID, T> originals = load(group);
    // The originals carry every patch field, tags included, so policies read them as loaded.
    BulkFieldHydrator loaded = new BulkFieldHydrator(Map.of());
    List<String> events = new ArrayList<>();
    for (EntityEdit<T> edit : group) {
      Optional.ofNullable(originals.get(edit.id()))
          .ifPresentOrElse(
              original -> applyOne(original, edit, loaded).ifPresent(events::add),
              () -> failures.put(edit.id(), notFound(edit.id())));
    }
    repository.insertChangeEventsBatch(events);
  }

  private Map<UUID, T> load(List<EntityEdit<T>> group) {
    List<UUID> ids = group.stream().map(EntityEdit::id).distinct().toList();
    List<T> entities = repository.get(null, ids, loadFields, Include.NON_DELETED);
    String entityType = repository.getEntityType();
    if (ChildFieldResolver.supports(entityType)) {
      entities.forEach(entity -> ChildFieldResolver.ensureChildFqns(entity, entityType));
    }
    return entities.stream().collect(Collectors.toMap(EntityInterface::getId, Function.identity()));
  }

  // The returned event is the one a PATCH of this entity records.
  private Optional<String> applyOne(T original, EntityEdit<T> edit, BulkFieldHydrator loaded) {
    Optional<String> event = Optional.empty();
    try {
      JsonPatch patch = patchOf(original, edit);
      if (!patch.toJsonArray().isEmpty()) {
        authorize(original, patch, loaded);
        event = dryRun ? prepare(original, patch) : save(original, patch);
      }
    } catch (Exception e) {
      LOG.debug("Patch failed for {} {}", repository.getEntityType(), original.getId(), e);
      failures.put(original.getId(), messageOf(e));
    }
    return event;
  }

  private JsonPatch patchOf(T original, EntityEdit<T> edit) {
    T edited = JsonUtils.deepCopy(original, repository.getEntityClass());
    edit.apply().accept(edited);
    return JsonUtils.getJsonPatch(original, edited);
  }

  private void authorize(T original, JsonPatch patch, BulkFieldHydrator loaded) {
    String entityType = repository.getEntityType();
    requester
        .authorizer()
        .authorize(
            requester.securityContext(),
            new OperationContext(entityType, patch),
            new ResourceContext<>(entityType, original, repository, loaded));
  }

  private Optional<String> prepare(T original, JsonPatch patch) {
    repository.preparePatch(original, patch, requester.actor());
    changed.add(original.getId());
    return Optional.empty();
  }

  private Optional<String> save(T original, JsonPatch patch) {
    PatchResponse<T> response = repository.patch(original, patch, requester.actor());
    Optional<String> event = Optional.empty();
    if (response.changeType() != EventType.ENTITY_NO_CHANGE) {
      changed.add(original.getId());
      event =
          Optional.of(
              JsonUtils.pojoToJson(
                  ChangeEventHandler.entityChangeEvent(
                      requester.actor().userName(), response.changeType(), response.entity())));
    }
    return event;
  }

  // What a single PATCH loads. Some bulk readers (topic, search index, API endpoint) only fill
  // child-field tags when the child container itself is asked for.
  private static Fields loadFields(EntityRepository<?> repository) {
    String entityType = repository.getEntityType();
    Set<String> fields = new LinkedHashSet<>(repository.getPatchFields().getFieldList());
    if (ChildFieldResolver.supports(entityType)) {
      fields.addAll(List.of(ChildFieldResolver.containerFields(entityType).split(",")));
    }
    return repository.getFields(String.join(",", fields));
  }

  private String notFound(UUID id) {
    return CatalogExceptionMessage.entityNotFound(repository.getEntityType(), id);
  }

  private static String messageOf(Exception e) {
    return e.getMessage() == null ? e.toString() : e.getMessage();
  }
}
