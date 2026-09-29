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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.TypeRegistry;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.PendingReference;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.ReferenceKey;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Keeps {@code entity_extension_reference} in step with entity-level custom-property values of
 * type {@code entityReference} and {@code entityReferenceList}, and applies it on every path: a
 * writer proves its targets exist under a shared lock, reads hide references whose target was
 * hard-deleted, and the compaction sweep rewrites those values once the delete has committed.
 */
@Slf4j
public final class EntityExtensionReferences {
  public static final String ENTITY_REFERENCE = "entityReference";
  public static final String ENTITY_REFERENCE_LIST = "entityReferenceList";
  private static final String FIELD_ID = "id";
  private static final String FIELD_TYPE = "type";
  private static final String CUSTOM_FIELD_SCHEMA = "customFieldSchema";

  private final CollectionDAO daoCollection;

  public EntityExtensionReferences(CollectionDAO daoCollection) {
    this.daoCollection = daoCollection;
  }

  public static boolean isReferenceProperty(String entityType, String propertyName) {
    try {
      String propertyType = TypeRegistry.getCustomPropertyType(entityType, propertyName);
      return ENTITY_REFERENCE.equals(propertyType) || ENTITY_REFERENCE_LIST.equals(propertyType);
    } catch (EntityNotFoundException e) {
      return false;
    }
  }

  /** Referenced ids grouped by target type; references without an id or type are skipped. */
  public static Map<String, List<String>> referencedIdsByType(JsonNode value) {
    Map<String, List<String>> byType = new LinkedHashMap<>();
    if (value != null && value.isArray()) {
      value.forEach(element -> addReference(byType, element));
    } else {
      addReference(byType, value);
    }
    return byType;
  }

  private static void addReference(Map<String, List<String>> byType, JsonNode ref) {
    if (ref != null && ref.isObject() && ref.hasNonNull(FIELD_ID) && ref.hasNonNull(FIELD_TYPE)) {
      byType
          .computeIfAbsent(ref.get(FIELD_TYPE).asText(), ignored -> new ArrayList<>())
          .add(ref.get(FIELD_ID).asText());
    }
  }

  private static String idOf(JsonNode ref) {
    return ref != null && ref.hasNonNull(FIELD_ID) ? ref.get(FIELD_ID).asText() : null;
  }

  /**
   * Logs a reference whose type is outside the property's {@code entityTypes}. Nothing enforced
   * this before, so existing values may carry such references; rejecting them would break the
   * next edit of every such value.
   */
  static void warnOnDisallowedType(JsonNode value, String fieldName, String propertyConfig) {
    Set<String> allowed = allowedTypes(propertyConfig);
    if (allowed.isEmpty()) {
      return;
    }
    referencedIdsByType(value).keySet().stream()
        .filter(type -> !allowed.contains(type))
        .forEach(
            type ->
                LOG.warn(
                    "Custom property '{}' references a {} but is restricted to {}",
                    fieldName,
                    type,
                    allowed));
  }

  private static Set<String> allowedTypes(String propertyConfig) {
    if (nullOrEmpty(propertyConfig) || !propertyConfig.startsWith("[")) {
      return Set.of();
    }
    Set<String> types = new HashSet<>();
    JsonUtils.readTree(propertyConfig).forEach(node -> types.add(node.asText()));
    return types;
  }

  /** Writes the rows for one value after locking its targets; a missing target fails the write. */
  public void store(UUID holderId, String extension, JsonNode value) {
    insertLocked(holderId, extension, referencedIdsByType(value));
  }

  /** Applies the difference between two values of the same property. */
  public void replace(UUID holderId, String extension, JsonNode original, JsonNode updated) {
    Set<String> before = flatten(referencedIdsByType(original));
    Map<String, List<String>> after = referencedIdsByType(updated);
    List<String> removed = new ArrayList<>(before);
    removed.removeAll(flatten(after));
    if (!removed.isEmpty()) {
      daoCollection.entityExtensionReferenceDAO().deleteMany(holderId, extension, removed);
    }
    insertLocked(holderId, extension, withoutIds(after, before));
  }

  private static Set<String> flatten(Map<String, List<String>> byType) {
    return byType.values().stream().flatMap(List::stream).collect(Collectors.toSet());
  }

  private static Map<String, List<String>> withoutIds(
      Map<String, List<String>> byType, Set<String> excluded) {
    Map<String, List<String>> kept = new LinkedHashMap<>();
    byType.forEach(
        (type, ids) -> {
          List<String> remaining = ids.stream().filter(id -> !excluded.contains(id)).toList();
          if (!remaining.isEmpty()) {
            kept.put(type, remaining);
          }
        });
    return kept;
  }

  private void insertLocked(UUID holderId, String extension, Map<String, List<String>> byType) {
    byType.forEach(this::lockExisting);
    byType.forEach(
        (type, ids) ->
            daoCollection
                .entityExtensionReferenceDAO()
                .insertMany(holderId, extension, ids, Collections.nCopies(ids.size(), type)));
  }

  /**
   * The validator already resolved these targets, but outside this transaction and possibly from
   * cache. The shared lock is the proof that counts: a concurrent hard delete of a target now
   * waits for this commit and marks the row afterwards, and a target that is already gone fails
   * the write instead of leaving a dangling row nothing would ever mark.
   */
  private void lockExisting(String type, List<String> ids) {
    if (!Entity.hasEntityRepository(type)) {
      throw new IllegalArgumentException(
          String.format("Unknown referenced entity type '%s'", type));
    }
    EntityDAO<?> dao = Entity.getEntityRepository(type).getDao();
    List<String> distinct = ids.stream().distinct().toList();
    Set<String> present =
        new HashSet<>(
            EntityDAO.queryInChunks(
                distinct,
                chunk ->
                    dao.lockExistingIds(dao.getTableName(), chunk, dao.getCondition(NON_DELETED))));
    distinct.stream()
        .filter(id -> !present.contains(id))
        .findFirst()
        .ifPresent(
            id -> {
              throw new IllegalArgumentException(
                  String.format("Referenced %s '%s' does not exist", type, id));
            });
  }

  /** Drops references whose target was hard-deleted from values that are not compacted yet. */
  public void removePending(Map<UUID, ObjectNode> extensionsByHolder) {
    if (extensionsByHolder.isEmpty()) {
      return;
    }
    List<String> ids = extensionsByHolder.keySet().stream().map(UUID::toString).toList();
    List<PendingReference> pending = daoCollection.entityExtensionReferenceDAO().findPending(ids);
    Map<ReferenceKey, Set<String>> deadByKey =
        pending.stream()
            .collect(
                Collectors.groupingBy(
                    reference -> new ReferenceKey(reference.id(), reference.extension()),
                    Collectors.mapping(PendingReference::toId, Collectors.toSet())));
    deadByKey.forEach(
        (key, dead) ->
            removeFrom(
                extensionsByHolder.get(key.id()),
                TypeRegistry.getPropertyName(key.extension()),
                dead));
  }

  private static void removeFrom(ObjectNode extension, String propertyName, Set<String> dead) {
    JsonNode value = extension == null ? null : extension.get(propertyName);
    if (value == null) {
      return;
    }
    if (value.isArray()) {
      removeDeadElements((ArrayNode) value, dead);
    } else if (dead.contains(idOf(value))) {
      extension.remove(propertyName);
    }
  }

  private static boolean removeDeadElements(ArrayNode list, Set<String> dead) {
    boolean removed = false;
    Iterator<JsonNode> elements = list.elements();
    while (elements.hasNext()) {
      if (dead.contains(idOf(elements.next()))) {
        elements.remove();
        removed = true;
      }
    }
    return removed;
  }

  public int markPending(List<UUID> deletedIds) {
    return daoCollection
        .entityExtensionReferenceDAO()
        .markPending(deletedIds.stream().map(UUID::toString).toList());
  }

  /** What one compaction pass over up to {@code limit} pending rows did. */
  public record CompactionPage(int fetched, int processed, int rewritten) {}

  enum Outcome {
    SKIPPED,
    CLEANED,
    REWRITTEN
  }

  /** Compacts the holders behind up to {@code limit} pending rows. */
  public CompactionPage compactPending(int limit) {
    List<ReferenceKey> rows = daoCollection.entityExtensionReferenceDAO().listPendingKeys(limit);
    int processed = 0;
    int rewritten = 0;
    for (ReferenceKey key : new LinkedHashSet<>(rows)) {
      Outcome outcome = compact(key);
      processed += outcome == Outcome.SKIPPED ? 0 : 1;
      rewritten += outcome == Outcome.REWRITTEN ? 1 : 0;
    }
    return new CompactionPage(rows.size(), processed, rewritten);
  }

  /**
   * One short transaction per holder that takes the value row before its ledger rows, the same
   * order a writer uses, so the two never wait on each other in a cycle. A row another
   * transaction holds is skipped and picked up by a later run.
   */
  Outcome compact(ReferenceKey key) {
    Outcome outcome =
        DeadlockRetry.execute(
            () -> daoCollection.inTransaction(dao -> compactInTransaction(dao, key)));
    if (outcome == Outcome.REWRITTEN) {
      refreshHolder(key);
    }
    return outcome;
  }

  private Outcome compactInTransaction(CollectionDAO dao, ReferenceKey key) {
    String json =
        dao.entityExtensionDAO().getExtensionForUpdateSkipLocked(key.id(), key.extension());
    if (json == null) {
      return dropOrphanRows(dao, key);
    }
    List<String> dead =
        dao.entityExtensionReferenceDAO().findPendingForUpdate(key.id(), key.extension());
    if (dead.isEmpty()) {
      return Outcome.CLEANED;
    }
    boolean changed = rewriteValue(dao, key, JsonUtils.readTree(json), new HashSet<>(dead));
    dao.entityExtensionReferenceDAO().deleteMany(key.id(), key.extension(), dead);
    return changed ? Outcome.REWRITTEN : Outcome.CLEANED;
  }

  /** Null from the locking read means locked elsewhere, or gone; only the latter leaves orphans. */
  private static Outcome dropOrphanRows(CollectionDAO dao, ReferenceKey key) {
    if (dao.entityExtensionDAO().getExtension(key.id(), key.extension()) != null) {
      return Outcome.SKIPPED;
    }
    dao.entityExtensionReferenceDAO().delete(key.id(), key.extension());
    return Outcome.CLEANED;
  }

  /** An edit may already have rewritten the value; a no-op rewrite is skipped, not replayed. */
  private static boolean rewriteValue(
      CollectionDAO dao, ReferenceKey key, JsonNode value, Set<String> dead) {
    boolean changed;
    if (value.isArray()) {
      changed = removeDeadElements((ArrayNode) value, dead);
      if (changed && value.isEmpty()) {
        dao.entityExtensionDAO().delete(key.id(), key.extension());
      } else if (changed) {
        dao.entityExtensionDAO()
            .insert(key.id(), key.extension(), CUSTOM_FIELD_SCHEMA, value.toString());
      }
    } else {
      changed = dead.contains(idOf(value));
      if (changed) {
        dao.entityExtensionDAO().delete(key.id(), key.extension());
      }
    }
    return changed;
  }

  private static void refreshHolder(ReferenceKey key) {
    String holderType = FullyQualifiedName.split(key.extension())[0];
    if (!Entity.hasEntityRepository(holderType)) {
      return;
    }
    try {
      EntityReference holder = Entity.getEntityReferenceById(holderType, key.id(), ALL);
      EntityRepository.invalidateCacheForEntity(
          holderType, key.id(), holder.getFullyQualifiedName());
      Entity.getSearchRepository().updateEntity(holder);
    } catch (EntityNotFoundException e) {
      LOG.debug("Holder {} {} was deleted before its value could be reindexed", holderType, key);
    }
  }
}
