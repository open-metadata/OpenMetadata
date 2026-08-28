/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 */
package org.openmetadata.service.cache;

import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.DATA_PRODUCT;
import static org.openmetadata.service.Entity.DOMAIN;
import static org.openmetadata.service.Entity.FIELD_DATA_PRODUCTS;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_EXPERTS;
import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.FIELD_REVIEWERS;
import static org.openmetadata.service.Entity.USER;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipRecord;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Batched pre-warm for the {@link CachedReadBundle} keys.
 *
 * <p>The standard read path's bundle population fans out to ~3 DB queries per entity (TO
 * relationships, FROM relationships, tag_usage). Doing that during warmup is exactly what
 * {@link org.openmetadata.service.apps.bundles.cache.CacheWarmupApp} is trying to avoid — it took
 * hours on modest installs.
 *
 * <p>This batcher takes a different tradeoff: it always pre-warms the cheap bundle fields — tags
 * (one batched {@code SELECT ... WHERE targetFQNHash IN (...)}) and certification (already on the
 * entity JSON we just paged through). Relationship warming is optional because it adds extra
 * relationship-table scans and reference hydration work. When enabled, it warms common
 * low-cardinality relation fields and still leaves high-cardinality graph-style fields to the lazy
 * first-read path.
 *
 * <p>Net benefit: tag and certification reads are warm immediately after warmup, eliminating one of
 * the three fan-out queries on every first read post-deploy. Operators can enable relationship
 * warming when they want the first entity-detail reads to avoid the common ownership/domain/reviewer
 * relationship queries as well.
 */
@Slf4j
public class BundleWarmupBatcher {
  private enum Direction {
    INCOMING,
    OUTGOING
  }

  private record RelationshipWarmupSpec(
      String field, Direction direction, Relationship relationship, String relatedEntityType) {}

  private static final List<RelationshipWarmupSpec> RELATIONSHIP_SPECS =
      List.of(
          new RelationshipWarmupSpec(FIELD_OWNERS, Direction.INCOMING, Relationship.OWNS, null),
          new RelationshipWarmupSpec(
              FIELD_FOLLOWERS, Direction.INCOMING, Relationship.FOLLOWS, USER),
          new RelationshipWarmupSpec(FIELD_DOMAINS, Direction.INCOMING, Relationship.HAS, DOMAIN),
          new RelationshipWarmupSpec(
              FIELD_DATA_PRODUCTS, Direction.INCOMING, Relationship.HAS, DATA_PRODUCT),
          new RelationshipWarmupSpec(
              FIELD_REVIEWERS, Direction.INCOMING, Relationship.REVIEWS, null),
          new RelationshipWarmupSpec(FIELD_EXPERTS, Direction.OUTGOING, Relationship.EXPERT, USER));

  private final CollectionDAO dao;
  private final CacheProvider cache;
  private final CacheKeys keys;
  private final boolean warmRelationships;

  public BundleWarmupBatcher(
      final CollectionDAO dao,
      final CacheProvider cache,
      final CacheKeys keys,
      final boolean warmRelationships) {
    this.dao = dao;
    this.cache = cache;
    this.keys = keys;
    this.warmRelationships = warmRelationships;
  }

  /** Outcome of a batch warmup — caller uses for stats reporting. */
  public record BatchResult(int success, int failed) {}

  public BatchResult warmupBatch(
      final String entityType, final List<? extends EntityInterface> entities, final Duration ttl) {
    if (entities == null || entities.isEmpty()) {
      return new BatchResult(0, 0);
    }
    final Map<String, EntityInterface> entitiesByFqnHash = new HashMap<>(entities.size() * 2);
    final List<String> fqnHashes = new ArrayList<>(entities.size());
    for (final EntityInterface entity : entities) {
      if (entity.getId() == null || entity.getFullyQualifiedName() == null) {
        continue;
      }
      final String hash = FullyQualifiedName.buildHash(entity.getFullyQualifiedName());
      entitiesByFqnHash.put(hash, entity);
      fqnHashes.add(hash);
    }
    if (fqnHashes.isEmpty()) {
      return new BatchResult(0, 0);
    }

    final Map<String, List<TagLabel>> tagsByFqnHash;
    try {
      tagsByFqnHash = dao.tagUsageDAO().getTagsByTargetFQNHashes(fqnHashes);
    } catch (final Exception e) {
      LOG.warn("Bundle warmup: tag batch fetch failed for type={}", entityType, e);
      return new BatchResult(0, entities.size());
    }

    final Map<UUID, Map<String, List<EntityReference>>> relationsByEntity;
    try {
      relationsByEntity = warmRelationships(entityType, entitiesByFqnHash.values());
    } catch (final Exception e) {
      LOG.warn("Bundle warmup: relationship batch fetch failed for type={}", entityType, e);
      return new BatchResult(0, entities.size());
    }

    final Map<String, String> bundleKeyValues = new HashMap<>(entitiesByFqnHash.size() * 2);
    int failed = 0;
    for (final Map.Entry<String, EntityInterface> entry : entitiesByFqnHash.entrySet()) {
      final EntityInterface entity = entry.getValue();
      try {
        final CachedReadBundle.Dto dto = new CachedReadBundle.Dto();
        final Map<String, List<EntityReference>> warmedRelations =
            relationsByEntity.get(entity.getId());
        dto.relations =
            warmRelationships
                ? (warmedRelations == null ? emptyRelationshipMap() : warmedRelations)
                : null;
        dto.tags = tagsByFqnHash.getOrDefault(entry.getKey(), Collections.emptyList());
        dto.tagsLoaded = true;
        dto.certification = entity.getCertification();
        dto.certificationLoaded = true;
        bundleKeyValues.put(keys.bundle(entityType, entity.getId()), JsonUtils.pojoToJson(dto));
      } catch (final Exception e) {
        failed++;
        LOG.debug("Bundle warmup row failed: type={} id={}", entityType, entity.getId(), e);
      }
    }
    if (bundleKeyValues.isEmpty()) {
      return new BatchResult(0, failed);
    }
    try {
      cache.pipelineSet(bundleKeyValues, ttl);
    } catch (final RuntimeException e) {
      LOG.warn("Bundle warmup: pipelined write failed for type={}", entityType, e);
      return new BatchResult(0, bundleKeyValues.size() + failed);
    }
    return new BatchResult(bundleKeyValues.size(), failed);
  }

  private Map<UUID, Map<String, List<EntityReference>>> warmRelationships(
      final String entityType, final Collection<EntityInterface> entities) {
    if (!warmRelationships) {
      return Collections.emptyMap();
    }
    final List<String> entityIds = entityIds(entities);
    final Map<UUID, Map<String, List<EntityReference>>> relationsByEntity =
        initRelationsByEntity(entities);
    final List<EntityRelationshipObject> incomingRecords =
        fetchRelationshipRecords(entityIds, entityType, Direction.INCOMING);
    final List<EntityRelationshipObject> outgoingRecords =
        fetchRelationshipRecords(entityIds, entityType, Direction.OUTGOING);
    populateRelationshipSpecs(relationsByEntity, incomingRecords, outgoingRecords);
    sortReferences(relationsByEntity);
    return relationsByEntity;
  }

  private static List<String> entityIds(final Collection<EntityInterface> entities) {
    return entities.stream().map(EntityInterface::getId).map(UUID::toString).toList();
  }

  private static Map<UUID, Map<String, List<EntityReference>>> initRelationsByEntity(
      final Collection<EntityInterface> entities) {
    final Map<UUID, Map<String, List<EntityReference>>> relationsByEntity =
        new HashMap<>(entities.size() * 2);
    entities.forEach(entity -> relationsByEntity.put(entity.getId(), emptyRelationshipMap()));
    return relationsByEntity;
  }

  private List<EntityRelationshipObject> fetchRelationshipRecords(
      final List<String> entityIds, final String entityType, final Direction direction) {
    final List<Integer> relationships = relationshipOrdinals(direction);
    if (relationships.isEmpty()) {
      return Collections.emptyList();
    }
    return direction == Direction.INCOMING
        ? listOrEmpty(
            dao.relationshipDAO()
                .findFromBatchWithRelations(entityIds, entityType, relationships, NON_DELETED))
        : listOrEmpty(
            dao.relationshipDAO()
                .findToBatchWithRelations(entityIds, entityType, relationships, NON_DELETED));
  }

  private static List<Integer> relationshipOrdinals(final Direction direction) {
    return RELATIONSHIP_SPECS.stream()
        .filter(spec -> spec.direction() == direction)
        .map(spec -> spec.relationship().ordinal())
        .distinct()
        .toList();
  }

  private void populateRelationshipSpecs(
      final Map<UUID, Map<String, List<EntityReference>>> relationsByEntity,
      final List<EntityRelationshipObject> incomingRecords,
      final List<EntityRelationshipObject> outgoingRecords) {
    final Map<RelationshipWarmupSpec, List<EntityRelationshipObject>> recordsBySpec =
        recordsBySpec(incomingRecords, outgoingRecords);
    final Map<String, EntityReference> referencesByKey = resolveRelatedReferences(recordsBySpec);
    for (final Map.Entry<RelationshipWarmupSpec, List<EntityRelationshipObject>> entry :
        recordsBySpec.entrySet()) {
      populateRelationshipField(
          relationsByEntity, entry.getKey(), entry.getValue(), referencesByKey);
    }
  }

  private static Map<RelationshipWarmupSpec, List<EntityRelationshipObject>> recordsBySpec(
      final List<EntityRelationshipObject> incomingRecords,
      final List<EntityRelationshipObject> outgoingRecords) {
    final Map<RelationshipWarmupSpec, List<EntityRelationshipObject>> recordsBySpec =
        new HashMap<>();
    addRecordsBySpec(recordsBySpec, Direction.INCOMING, incomingRecords);
    addRecordsBySpec(recordsBySpec, Direction.OUTGOING, outgoingRecords);
    return recordsBySpec;
  }

  private static void addRecordsBySpec(
      final Map<RelationshipWarmupSpec, List<EntityRelationshipObject>> recordsBySpec,
      final Direction direction,
      final List<EntityRelationshipObject> records) {
    for (final EntityRelationshipObject record : records) {
      final RelationshipWarmupSpec spec = matchingSpec(record, direction);
      if (spec != null) {
        recordsBySpec.computeIfAbsent(spec, ignored -> new ArrayList<>()).add(record);
      }
    }
  }

  private static RelationshipWarmupSpec matchingSpec(
      final EntityRelationshipObject record, final Direction direction) {
    return RELATIONSHIP_SPECS.stream()
        .filter(spec -> spec.direction() == direction)
        .filter(spec -> relationshipRecordMatches(record, spec))
        .findFirst()
        .orElse(null);
  }

  private static void sortReferences(
      final Map<UUID, Map<String, List<EntityReference>>> relationsByEntity) {
    relationsByEntity.values().stream()
        .flatMap(fieldMap -> fieldMap.values().stream())
        .forEach(refs -> refs.sort(EntityUtil.compareEntityReference));
  }

  private static List<EntityRelationshipObject> listOrEmpty(
      final List<EntityRelationshipObject> records) {
    return records == null ? Collections.emptyList() : records;
  }

  private static Map<String, List<EntityReference>> emptyRelationshipMap() {
    final Map<String, List<EntityReference>> relations = new HashMap<>();
    RELATIONSHIP_SPECS.forEach(spec -> relations.put(spec.field(), new ArrayList<>()));
    return relations;
  }

  private void populateRelationshipField(
      final Map<UUID, Map<String, List<EntityReference>>> relationsByEntity,
      final RelationshipWarmupSpec spec,
      final List<EntityRelationshipObject> records,
      final Map<String, EntityReference> referencesByKey) {
    for (final EntityRelationshipObject record : records) {
      addRelationshipReference(relationsByEntity, spec, referencesByKey, record);
    }
  }

  private static boolean relationshipRecordMatches(
      final EntityRelationshipObject record, final RelationshipWarmupSpec spec) {
    return record.getRelation() == spec.relationship().ordinal()
        && relatedEntityMatches(record, spec)
        && owningEntityId(record, spec.direction()) != null
        && relatedEntityId(record, spec.direction()) != null
        && relatedEntityType(record, spec.direction()) != null;
  }

  private static void addRelationshipReference(
      final Map<UUID, Map<String, List<EntityReference>>> relationsByEntity,
      final RelationshipWarmupSpec spec,
      final Map<String, EntityReference> referencesByKey,
      final EntityRelationshipObject record) {
    final EntityReference reference = referencesByKey.get(relatedReferenceKey(record, spec));
    if (reference == null) {
      return;
    }
    relationsByEntity
        .computeIfAbsent(
            UUID.fromString(owningEntityId(record, spec.direction())),
            ignored -> emptyRelationshipMap())
        .computeIfAbsent(spec.field(), ignored -> new ArrayList<>())
        .add(reference);
  }

  private static String relatedReferenceKey(
      final EntityRelationshipObject record, final RelationshipWarmupSpec spec) {
    return referenceKey(
        relatedEntityType(record, spec.direction()), relatedEntityId(record, spec.direction()));
  }

  private static Map<String, EntityReference> resolveRelatedReferences(
      final Map<RelationshipWarmupSpec, List<EntityRelationshipObject>> recordsBySpec) {
    if (recordsBySpec.isEmpty() || Entity.getEntityRelationshipRepository() == null) {
      return Collections.emptyMap();
    }
    final List<EntityRelationshipRecord> relationRecords = relationshipRecords(recordsBySpec);
    final Map<String, EntityReference> referencesByKey = new HashMap<>();
    Entity.getEntityRelationshipRepository()
        .getEntityReferences(relationRecords, NON_DELETED)
        .forEach(
            ref -> referencesByKey.put(referenceKey(ref.getType(), ref.getId().toString()), ref));
    return referencesByKey;
  }

  private static List<EntityRelationshipRecord> relationshipRecords(
      final Map<RelationshipWarmupSpec, List<EntityRelationshipObject>> recordsBySpec) {
    final Map<String, EntityRelationshipRecord> recordsByKey = new HashMap<>();
    recordsBySpec.forEach(
        (spec, records) ->
            records.forEach(
                record ->
                    recordsByKey.putIfAbsent(
                        relatedReferenceKey(record, spec), relationshipRecord(record, spec))));
    return new ArrayList<>(recordsByKey.values());
  }

  private static EntityRelationshipRecord relationshipRecord(
      final EntityRelationshipObject record, final RelationshipWarmupSpec spec) {
    return EntityRelationshipRecord.builder()
        .id(UUID.fromString(relatedEntityId(record, spec.direction())))
        .type(relatedEntityType(record, spec.direction()))
        .json(record.getJson())
        .build();
  }

  private static boolean relatedEntityMatches(
      final EntityRelationshipObject record, final RelationshipWarmupSpec spec) {
    final String expected = spec.relatedEntityType();
    return expected == null || expected.equals(relatedEntityType(record, spec.direction()));
  }

  private static String owningEntityId(
      final EntityRelationshipObject record, final Direction direction) {
    return direction == Direction.INCOMING ? record.getToId() : record.getFromId();
  }

  private static String relatedEntityId(
      final EntityRelationshipObject record, final Direction direction) {
    return direction == Direction.INCOMING ? record.getFromId() : record.getToId();
  }

  private static String relatedEntityType(
      final EntityRelationshipObject record, final Direction direction) {
    return direction == Direction.INCOMING ? record.getFromEntity() : record.getToEntity();
  }

  private static String referenceKey(final String type, final String id) {
    return type + ":" + id;
  }
}
