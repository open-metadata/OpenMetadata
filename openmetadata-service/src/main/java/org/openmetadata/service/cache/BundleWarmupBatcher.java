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
import java.util.Collections;
import java.util.Collection;
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
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipObject;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
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
          new RelationshipWarmupSpec(FIELD_FOLLOWERS, Direction.INCOMING, Relationship.FOLLOWS, USER),
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
      CollectionDAO dao, CacheProvider cache, CacheKeys keys, boolean warmRelationships) {
    this.dao = dao;
    this.cache = cache;
    this.keys = keys;
    this.warmRelationships = warmRelationships;
  }

  /** Outcome of a batch warmup — caller uses for stats reporting. */
  public record BatchResult(int success, int failed) {}

  public BatchResult warmupBatch(
      String entityType, List<? extends EntityInterface> entities, Duration ttl) {
    if (entities == null || entities.isEmpty()) {
      return new BatchResult(0, 0);
    }
    Map<String, EntityInterface> entitiesByFqnHash = new HashMap<>(entities.size() * 2);
    List<String> fqnHashes = new ArrayList<>(entities.size());
    for (EntityInterface entity : entities) {
      if (entity.getId() == null || entity.getFullyQualifiedName() == null) {
        continue;
      }
      String hash = FullyQualifiedName.buildHash(entity.getFullyQualifiedName());
      entitiesByFqnHash.put(hash, entity);
      fqnHashes.add(hash);
    }
    if (fqnHashes.isEmpty()) {
      return new BatchResult(0, 0);
    }

    Map<String, List<TagLabel>> tagsByFqnHash;
    try {
      tagsByFqnHash = dao.tagUsageDAO().getTagsByTargetFQNHashes(fqnHashes);
    } catch (Exception e) {
      LOG.warn("Bundle warmup: tag batch fetch failed for type={}", entityType, e);
      return new BatchResult(0, entities.size());
    }

    Map<UUID, Map<String, List<EntityReference>>> relationsByEntity = Collections.emptyMap();
    if (warmRelationships) {
      try {
        relationsByEntity = warmRelationships(entityType, entitiesByFqnHash.values());
      } catch (Exception e) {
        LOG.warn("Bundle warmup: relationship batch fetch failed for type={}", entityType, e);
        return new BatchResult(0, entities.size());
      }
    }

    Map<String, String> bundleKeyValues = new HashMap<>(entitiesByFqnHash.size() * 2);
    int failed = 0;
    for (Map.Entry<String, EntityInterface> entry : entitiesByFqnHash.entrySet()) {
      EntityInterface entity = entry.getValue();
      try {
        CachedReadBundle.Dto dto = new CachedReadBundle.Dto();
        Map<String, List<EntityReference>> warmedRelations = relationsByEntity.get(entity.getId());
        dto.relations =
            warmRelationships
                ? (warmedRelations == null ? emptyRelationshipMap() : warmedRelations)
                : null;
        dto.tags = tagsByFqnHash.getOrDefault(entry.getKey(), Collections.emptyList());
        dto.tagsLoaded = true;
        dto.certification = entity.getCertification();
        dto.certificationLoaded = true;
        bundleKeyValues.put(keys.bundle(entityType, entity.getId()), JsonUtils.pojoToJson(dto));
      } catch (Exception e) {
        failed++;
        LOG.debug("Bundle warmup row failed: type={} id={}", entityType, entity.getId(), e);
      }
    }
    if (bundleKeyValues.isEmpty()) {
      return new BatchResult(0, failed);
    }
    try {
      cache.pipelineSet(bundleKeyValues, ttl);
    } catch (RuntimeException e) {
      LOG.warn("Bundle warmup: pipelined write failed for type={}", entityType, e);
      return new BatchResult(0, bundleKeyValues.size() + failed);
    }
    return new BatchResult(bundleKeyValues.size(), failed);
  }

  private Map<UUID, Map<String, List<EntityReference>>> warmRelationships(
      String entityType, Collection<EntityInterface> entities) {
    List<String> entityIds =
        entities.stream().map(EntityInterface::getId).map(UUID::toString).toList();
    Map<UUID, Map<String, List<EntityReference>>> relationsByEntity =
        new HashMap<>(entities.size() * 2);
    entities.forEach(entity -> relationsByEntity.put(entity.getId(), emptyRelationshipMap()));

    List<Integer> incomingRelations =
        RELATIONSHIP_SPECS.stream()
            .filter(spec -> spec.direction() == Direction.INCOMING)
            .map(spec -> spec.relationship().ordinal())
            .distinct()
            .toList();
    List<Integer> outgoingRelations =
        RELATIONSHIP_SPECS.stream()
            .filter(spec -> spec.direction() == Direction.OUTGOING)
            .map(spec -> spec.relationship().ordinal())
            .distinct()
            .toList();

    List<EntityRelationshipObject> incomingRecords =
        incomingRelations.isEmpty()
            ? Collections.emptyList()
            : listOrEmpty(
                dao.relationshipDAO()
                    .findFromBatchWithRelations(
                        entityIds, entityType, incomingRelations, NON_DELETED));
    List<EntityRelationshipObject> outgoingRecords =
        outgoingRelations.isEmpty()
            ? Collections.emptyList()
            : listOrEmpty(
                dao.relationshipDAO()
                    .findToBatchWithRelations(
                        entityIds, entityType, outgoingRelations, NON_DELETED));

    for (RelationshipWarmupSpec spec : RELATIONSHIP_SPECS) {
      List<EntityRelationshipObject> records =
          spec.direction() == Direction.INCOMING ? incomingRecords : outgoingRecords;
      populateRelationshipField(relationsByEntity, spec, records);
    }
    relationsByEntity.values().stream()
        .flatMap(fieldMap -> fieldMap.values().stream())
        .forEach(refs -> refs.sort(EntityUtil.compareEntityReference));
    return relationsByEntity;
  }

  private static List<EntityRelationshipObject> listOrEmpty(List<EntityRelationshipObject> records) {
    return records == null ? Collections.emptyList() : records;
  }

  private static Map<String, List<EntityReference>> emptyRelationshipMap() {
    Map<String, List<EntityReference>> relations = new HashMap<>();
    RELATIONSHIP_SPECS.forEach(spec -> relations.put(spec.field(), new ArrayList<>()));
    return relations;
  }

  private void populateRelationshipField(
      Map<UUID, Map<String, List<EntityReference>>> relationsByEntity,
      RelationshipWarmupSpec spec,
      List<EntityRelationshipObject> records) {
    List<EntityRelationshipObject> matchingRecords =
        records.stream()
            .filter(record -> record.getRelation() == spec.relationship().ordinal())
            .filter(record -> relatedEntityMatches(record, spec))
            .filter(record -> owningEntityId(record, spec.direction()) != null)
            .filter(record -> relatedEntityId(record, spec.direction()) != null)
            .filter(record -> relatedEntityType(record, spec.direction()) != null)
            .toList();
    if (matchingRecords.isEmpty()) {
      return;
    }

    Map<String, EntityReference> referencesByKey = resolveRelatedReferences(matchingRecords, spec);
    for (EntityRelationshipObject record : matchingRecords) {
      UUID owningId = UUID.fromString(owningEntityId(record, spec.direction()));
      EntityReference reference =
          referencesByKey.get(
              referenceKey(
                  relatedEntityType(record, spec.direction()),
                  relatedEntityId(record, spec.direction())));
      if (reference != null) {
        relationsByEntity
            .computeIfAbsent(owningId, ignored -> emptyRelationshipMap())
            .computeIfAbsent(spec.field(), ignored -> new ArrayList<>())
            .add(reference);
      }
    }
  }

  private Map<String, EntityReference> resolveRelatedReferences(
      List<EntityRelationshipObject> records, RelationshipWarmupSpec spec) {
    if (Entity.getEntityRelationshipRepository() == null) {
      return Collections.emptyMap();
    }
    List<EntityRelationshipRecord> relationRecords =
        records.stream()
            .map(
                record ->
                    EntityRelationshipRecord.builder()
                        .id(UUID.fromString(relatedEntityId(record, spec.direction())))
                        .type(relatedEntityType(record, spec.direction()))
                        .json(record.getJson())
                        .build())
            .toList();
    Map<String, EntityReference> referencesByKey = new HashMap<>();
    Entity.getEntityRelationshipRepository()
        .getEntityReferences(relationRecords, NON_DELETED)
        .forEach(
            ref -> referencesByKey.put(referenceKey(ref.getType(), ref.getId().toString()), ref));
    return referencesByKey;
  }

  private static boolean relatedEntityMatches(
      EntityRelationshipObject record, RelationshipWarmupSpec spec) {
    String expected = spec.relatedEntityType();
    return expected == null || expected.equals(relatedEntityType(record, spec.direction()));
  }

  private static String owningEntityId(EntityRelationshipObject record, Direction direction) {
    return direction == Direction.INCOMING ? record.getToId() : record.getFromId();
  }

  private static String relatedEntityId(EntityRelationshipObject record, Direction direction) {
    return direction == Direction.INCOMING ? record.getFromId() : record.getToId();
  }

  private static String relatedEntityType(EntityRelationshipObject record, Direction direction) {
    return direction == Direction.INCOMING ? record.getFromEntity() : record.getToEntity();
  }

  private static String referenceKey(String type, String id) {
    return type + ":" + id;
  }
}
