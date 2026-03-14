package org.openmetadata.service.jdbi3;

import static org.openmetadata.schema.type.Include.ALL;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;

/** Mutable builder used by common and entity-specific read planners. */
final class ReadPlanBuilder {
  private final UUID entityId;
  private final Map<Include, Set<Integer>> toRelationsByInclude = new HashMap<>();
  private final Map<Include, Set<Integer>> fromRelationsByInclude = new HashMap<>();
  private final Map<String, Include> fieldIncludes = new HashMap<>();
  private final Map<String, ReadPlan.RelationSpec> relationSpecs = new HashMap<>();
  private final Set<String> relationFields = new HashSet<>();
  private final Set<String> entitySpecificPrefetchKeys = new HashSet<>();

  private boolean loadExtension;
  private boolean loadTags;
  private boolean loadVotes;

  ReadPlanBuilder(UUID entityId) {
    this.entityId = entityId;
  }

  ReadPlanBuilder addToRelationField(
      String field, Include include, Relationship relationship, String fromEntityTypeFilter) {
    Include normalizedInclude = normalizeInclude(include);
    toRelationsByInclude
        .computeIfAbsent(normalizedInclude, key -> new HashSet<>())
        .add(relationship.ordinal());
    fieldIncludes.put(field, normalizedInclude);
    relationFields.add(field);
    relationSpecs.put(
        field,
        new ReadPlan.RelationSpec(
            ReadPlan.RelationDirection.TO, relationship, fromEntityTypeFilter, normalizedInclude));
    return this;
  }

  ReadPlanBuilder addFromRelationField(
      String field, Include include, Relationship relationship, String toEntityTypeFilter) {
    Include normalizedInclude = normalizeInclude(include);
    fromRelationsByInclude
        .computeIfAbsent(normalizedInclude, key -> new HashSet<>())
        .add(relationship.ordinal());
    fieldIncludes.put(field, normalizedInclude);
    relationFields.add(field);
    relationSpecs.put(
        field,
        new ReadPlan.RelationSpec(
            ReadPlan.RelationDirection.FROM, relationship, toEntityTypeFilter, normalizedInclude));
    return this;
  }

  ReadPlanBuilder requestTags() {
    this.loadTags = true;
    return this;
  }

  ReadPlanBuilder requestExtension() {
    this.loadExtension = true;
    return this;
  }

  ReadPlanBuilder requestVotes() {
    this.loadVotes = true;
    return this;
  }

  ReadPlanBuilder addEntitySpecificPrefetch(String key) {
    if (key != null && !key.isBlank()) {
      entitySpecificPrefetchKeys.add(key);
    }
    return this;
  }

  ReadPlanBuilder addEntitySpecificPrefetch(ReadPrefetchKey key) {
    if (key != null) {
      addEntitySpecificPrefetch(key.value());
    }
    return this;
  }

  ReadPlan build() {
    if (entityId == null) {
      return ReadPlan.empty();
    }
    return new ReadPlan(
        entityId,
        toRelationsByInclude,
        fromRelationsByInclude,
        fieldIncludes,
        relationSpecs,
        relationFields,
        loadExtension,
        loadTags,
        loadVotes,
        entitySpecificPrefetchKeys);
  }

  private Include normalizeInclude(Include include) {
    return include == null ? ALL : include;
  }
}
