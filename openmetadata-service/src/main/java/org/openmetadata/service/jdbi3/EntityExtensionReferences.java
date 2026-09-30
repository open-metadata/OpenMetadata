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
import static org.openmetadata.schema.type.Include.NON_DELETED;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.TypeRegistry;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.ReferenceRow;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.ReferenceTarget;

/**
 * Keeps {@code entity_extension_reference} in step with custom-property values of type {@code
 * entityReference} and {@code entityReferenceList}: a writer proves its targets exist under a
 * shared lock, a hard delete marks the rows that point at the deleted entity, and {@link
 * EntityExtensionReferenceCompaction} rewrites those values once the delete has committed.
 * Entity-level values live here; column-level values in {@link ColumnExtensionReferences}.
 */
@Slf4j
public final class EntityExtensionReferences {
  public static final String ENTITY_REFERENCE = "entityReference";
  public static final String ENTITY_REFERENCE_LIST = "entityReferenceList";
  private static final String FIELD_ID = "id";
  private static final String FIELD_TYPE = "type";
  public static final String CUSTOM_FIELD_SCHEMA = "customFieldSchema";
  private static final String CUSTOM_PROPERTIES_SEGMENT = ".customProperties.";

  /** One warning per (property, type) per server, not one per edit. */
  private static final Cache<String, Boolean> WARNED_TYPES =
      Caffeine.newBuilder().maximumSize(1_000).build();

  private final CollectionDAO daoCollection;

  public EntityExtensionReferences(CollectionDAO daoCollection) {
    this.daoCollection = daoCollection;
  }

  /** Entity-level keys read {@code <type>.customProperties.<name>}; column keys are FQN hashes. */
  static boolean isEntityLevelKey(String extension) {
    return extension.contains(CUSTOM_PROPERTIES_SEGMENT);
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

  static String idOf(JsonNode ref) {
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
        .filter(type -> WARNED_TYPES.asMap().putIfAbsent(fieldName + "/" + type, true) == null)
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
  public void store(UUID holderId, String holderType, String extension, JsonNode value) {
    insertLocked(holderId, holderType, extension, referencedIdsByType(value));
  }

  /**
   * Brings the ledger rows of one property in line with its new value. The baseline is the
   * persisted ledger, not the request's original: a writer that read the entity before a target
   * was deleted and commits after the sweep dropped its rows would otherwise write the dead id
   * back with no row to mark it. Against the ledger the id is new, the lock fails, the write 400s.
   */
  public void replace(UUID holderId, String holderType, String extension, JsonNode updated) {
    Set<String> before =
        new HashSet<>(daoCollection.entityExtensionReferenceDAO().findToIds(holderId, extension));
    Map<String, List<String>> after = referencedIdsByType(updated);
    List<String> removed = new ArrayList<>(before);
    removed.removeAll(flatten(after));
    if (!removed.isEmpty()) {
      daoCollection.entityExtensionReferenceDAO().deleteMany(holderId, extension, removed);
    }
    insertLocked(holderId, holderType, extension, withoutIds(after, before));
  }

  static Set<String> flatten(Map<String, List<String>> byType) {
    return byType.values().stream().flatMap(List::stream).collect(Collectors.toSet());
  }

  static Map<String, List<String>> withoutIds(
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

  void insertLocked(
      UUID holderId, String holderType, String extension, Map<String, List<String>> byType) {
    byType.forEach(this::lockExisting);
    byType.forEach(
        (type, ids) ->
            daoCollection
                .entityExtensionReferenceDAO()
                .insertMany(
                    holderId, extension, holderType, ids, Collections.nCopies(ids.size(), type)));
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
    List<String> missing = distinct.stream().filter(id -> !present.contains(id)).toList();
    if (!missing.isEmpty()) {
      throw new IllegalArgumentException(
          String.format("Referenced %s '%s' does not exist", type, missing.getFirst()));
    }
  }

  /**
   * Drops ids a hard delete already marked dead from one incoming value, so an edit is not rejected
   * for them (e.g. a client read the list before the sweep ran, added one element and sent it
   * back). A property this empties is removed. Returns whether anything was dropped.
   */
  boolean dropPending(
      ObjectNode extension, Predicate<String> isReference, UUID holderId, String key) {
    Set<String> pending =
        new HashSet<>(daoCollection.entityExtensionReferenceDAO().findPendingToIds(holderId, key));
    return !pending.isEmpty()
        && ColumnExtensionReferences.removeDead(extension, pending, isReference);
  }

  static boolean removeDeadElements(ArrayNode list, Set<String> dead) {
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

  /** What a pass over the live ledger rows found: rows scanned, targets gone, rows marked. */
  public record LiveProbe(int scanned, int dead, int marked) {}

  /**
   * Safety net for a lost post-commit re-probe: walks the live ledger rows, checks each target
   * still exists in its own table and marks the ones that do not. Types this server does not know
   * are skipped, never marked.
   */
  public LiveProbe probeLiveReferences(int batchSize, boolean apply) {
    int scanned = 0;
    int dead = 0;
    int marked = 0;
    List<ReferenceTarget> page =
        daoCollection.entityExtensionReferenceDAO().listLiveAfter("", "", "", batchSize);
    while (!page.isEmpty()) {
      List<ReferenceRow> gone = deadRowsIn(page);
      scanned += page.size();
      dead += gone.size();
      marked += apply ? markRows(gone) : 0;
      ReferenceTarget last = page.getLast();
      page =
          page.size() < batchSize
              ? List.of()
              : daoCollection
                  .entityExtensionReferenceDAO()
                  .listLiveAfter(last.id().toString(), last.extension(), last.toId(), batchSize);
    }
    return new LiveProbe(scanned, dead, marked);
  }

  private static List<ReferenceRow> deadRowsIn(List<ReferenceTarget> page) {
    Map<String, List<ReferenceTarget>> byType =
        page.stream().collect(Collectors.groupingBy(ReferenceTarget::toEntity));
    List<ReferenceRow> gone = new ArrayList<>();
    byType.forEach(
        (type, rows) -> {
          if (Entity.hasEntityRepository(type)) {
            Set<String> present =
                existingIds(type, rows.stream().map(ReferenceTarget::toId).distinct().toList());
            rows.stream()
                .filter(row -> !present.contains(row.toId()))
                .forEach(row -> gone.add(new ReferenceRow(row.id(), row.extension(), row.toId())));
          }
        });
    return gone;
  }

  private static Set<String> existingIds(String type, List<String> ids) {
    EntityDAO<?> dao = Entity.getEntityRepository(type).getDao();
    return new HashSet<>(
        EntityDAO.queryInChunks(ids, chunk -> dao.findExistingIds(dao.getTableName(), chunk)));
  }

  private int markRows(List<ReferenceRow> rows) {
    if (rows.isEmpty()) {
      return 0;
    }
    daoCollection
        .entityExtensionReferenceDAO()
        .markPendingByKey(
            rows.stream().map(ReferenceRow::id).toList(),
            rows.stream().map(ReferenceRow::extension).toList(),
            rows.stream().map(ReferenceRow::toId).toList());
    return rows.size();
  }

  public int markPending(List<UUID> deletedIds) {
    return daoCollection
        .entityExtensionReferenceDAO()
        .markPending(deletedIds.stream().map(UUID::toString).toList());
  }
}
