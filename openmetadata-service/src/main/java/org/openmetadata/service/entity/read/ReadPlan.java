package org.openmetadata.service.entity.read;

import static org.openmetadata.schema.type.Include.ALL;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;

/** Immutable query plan for request-scoped relationship and metadata prefetching. */
public final class ReadPlan {
  private static final ReadPlan EMPTY =
      new ReadPlan(
          null, Map.of(), Map.of(), Map.of(), Map.of(), Set.of(), false, false, false, Set.of());

  public enum RelationDirection {
    TO,
    FROM
  }

  public record RelationSpec(
      RelationDirection direction,
      Relationship relationship,
      String relatedEntityType,
      Include include) {}

  private final UUID entityId;
  private final Map<Include, Set<Integer>> toRelationsByInclude;
  private final Map<Include, Set<Integer>> fromRelationsByInclude;
  private final Map<String, Include> fieldIncludes;
  private final Map<String, RelationSpec> relationSpecs;
  private final Set<String> entitySpecificPrefetchKeys;
  private final Set<String> relationFields;
  private final boolean loadExtension;
  private final boolean loadTags;
  private final boolean loadVotes;

  ReadPlan(
      UUID entityId,
      Map<Include, Set<Integer>> toRelationsByInclude,
      Map<Include, Set<Integer>> fromRelationsByInclude,
      Map<String, Include> fieldIncludes,
      Map<String, RelationSpec> relationSpecs,
      Set<String> relationFields,
      boolean loadExtension,
      boolean loadTags,
      boolean loadVotes,
      Set<String> entitySpecificPrefetchKeys) {
    this.entityId = entityId;
    this.toRelationsByInclude = immutableRelationMap(toRelationsByInclude);
    this.fromRelationsByInclude = immutableRelationMap(fromRelationsByInclude);
    this.fieldIncludes = immutableIncludeMap(fieldIncludes);
    this.relationSpecs = immutableRelationSpecMap(relationSpecs);
    this.entitySpecificPrefetchKeys =
        entitySpecificPrefetchKeys == null ? Set.of() : Set.copyOf(entitySpecificPrefetchKeys);
    this.relationFields = relationFields == null ? Set.of() : Set.copyOf(relationFields);
    this.loadExtension = loadExtension;
    this.loadTags = loadTags;
    this.loadVotes = loadVotes;
  }

  public static ReadPlan empty() {
    return EMPTY;
  }

  public UUID getEntityId() {
    return entityId;
  }

  public Map<Include, Set<Integer>> getToRelationsByInclude() {
    return toRelationsByInclude;
  }

  public Map<Include, Set<Integer>> getFromRelationsByInclude() {
    return fromRelationsByInclude;
  }

  public Map<String, RelationSpec> getRelationSpecs() {
    return relationSpecs;
  }

  public Optional<RelationSpec> getRelationSpec(String field) {
    return Optional.ofNullable(relationSpecs.get(field));
  }

  public boolean shouldLoadRelationField(String field) {
    return relationFields.contains(field);
  }

  public Include getIncludeForField(String field) {
    return fieldIncludes.getOrDefault(field, ALL);
  }

  public boolean shouldLoadExtension() {
    return loadExtension;
  }

  public boolean shouldLoadTags() {
    return loadTags;
  }

  public boolean shouldLoadVotes() {
    return loadVotes;
  }

  public Set<String> getEntitySpecificPrefetchKeys() {
    return entitySpecificPrefetchKeys;
  }

  public boolean hasEntitySpecificPrefetch(ReadPrefetchKey key) {
    return key != null && entitySpecificPrefetchKeys.contains(key.value());
  }

  public boolean isEmpty() {
    return entityId == null
        || (toRelationsByInclude.isEmpty()
            && fromRelationsByInclude.isEmpty()
            && !loadExtension
            && !loadTags
            && !loadVotes
            && entitySpecificPrefetchKeys.isEmpty());
  }

  private static Map<Include, Set<Integer>> immutableRelationMap(
      Map<Include, Set<Integer>> source) {
    if (source == null || source.isEmpty()) {
      return Map.of();
    }
    Map<Include, Set<Integer>> copy = new HashMap<>();
    source.forEach(
        (include, relations) -> {
          if (relations != null && !relations.isEmpty()) {
            copy.put(include, Set.copyOf(relations));
          }
        });
    return copy.isEmpty() ? Map.of() : Collections.unmodifiableMap(copy);
  }

  private static Map<String, Include> immutableIncludeMap(Map<String, Include> source) {
    if (source == null || source.isEmpty()) {
      return Map.of();
    }
    Map<String, Include> copy = new HashMap<>();
    source.forEach((field, include) -> copy.put(field, include == null ? ALL : include));
    return Collections.unmodifiableMap(copy);
  }

  private static Map<String, RelationSpec> immutableRelationSpecMap(
      Map<String, RelationSpec> source) {
    if (source == null || source.isEmpty()) {
      return Map.of();
    }
    return Map.copyOf(source);
  }
}
