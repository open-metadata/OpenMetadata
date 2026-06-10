/*
 *  Copyright 2021 Collate
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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.DATA_CONTRACT;
import static org.openmetadata.service.Entity.DATA_PRODUCT;
import static org.openmetadata.service.Entity.DOMAIN;
import static org.openmetadata.service.Entity.FIELD_CERTIFICATION;
import static org.openmetadata.service.Entity.FIELD_CHILDREN;
import static org.openmetadata.service.Entity.FIELD_DATA_CONTRACT;
import static org.openmetadata.service.Entity.FIELD_DATA_PRODUCTS;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_EXPERTS;
import static org.openmetadata.service.Entity.FIELD_EXTENSION;
import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.FIELD_REVIEWERS;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.Entity.FIELD_VOTES;
import static org.openmetadata.service.Entity.USER;
import static org.openmetadata.service.resources.tags.TagLabelUtil.populateTagLabel;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.ws.rs.core.UriInfo;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.apache.commons.collections4.CollectionUtils;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.FieldInterface;
import org.openmetadata.schema.api.VoteRequest.VoteType;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.Votes;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.TypeRegistry;
import org.openmetadata.service.resources.tags.TagLabelUtil;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.utils.Either;

/**
 * Bulk field-fetch helpers (the fetchAndSet and batchFetch families) for list reads, extracted
 * from EntityRepository. Holds a back-reference to the owning repository (preserves polymorphism).
 */
final class BulkFieldFetcher<T extends org.openmetadata.schema.EntityInterface> {
  private static final Logger LOG = LoggerFactory.getLogger(BulkFieldFetcher.class);
  private final EntityRepository<T> r;

  BulkFieldFetcher(EntityRepository<T> r) {
    this.r = r;
  }

  Set<String> fetchAndSetRelationshipFieldsInBulk(List<T> entities, Fields fields) {
    if (nullOrEmpty(entities) || fields == null) {
      return Collections.emptySet();
    }

    boolean loadOwners = r.supportsOwners && fields.contains(FIELD_OWNERS);
    boolean loadFollowers = r.supportsFollower && fields.contains(FIELD_FOLLOWERS);
    boolean loadDomains = r.supportsDomains && fields.contains(FIELD_DOMAINS);
    boolean loadReviewers = r.supportsReviewers && fields.contains(FIELD_REVIEWERS);
    boolean loadDataProducts = r.supportsDataProducts && fields.contains(FIELD_DATA_PRODUCTS);
    boolean loadDataContract = r.supportsDataContract && fields.contains(FIELD_DATA_CONTRACT);
    boolean loadVotes = r.supportsVotes && fields.contains(FIELD_VOTES);
    boolean loadChildren = r.supportsChildren && fields.contains(FIELD_CHILDREN);
    boolean loadExperts = r.supportsExperts && fields.contains(FIELD_EXPERTS);

    if (!loadOwners
        && !loadFollowers
        && !loadDomains
        && !loadReviewers
        && !loadDataProducts
        && !loadDataContract
        && !loadVotes
        && !loadChildren
        && !loadExperts) {
      return Collections.emptySet();
    }

    List<Integer> incomingRelations = new ArrayList<>();
    if (loadOwners) {
      incomingRelations.add(Relationship.OWNS.ordinal());
    }
    if (loadFollowers) {
      incomingRelations.add(Relationship.FOLLOWS.ordinal());
    }
    if (loadDomains || loadDataProducts) {
      incomingRelations.add(Relationship.HAS.ordinal());
    }
    if (loadReviewers) {
      incomingRelations.add(Relationship.REVIEWS.ordinal());
    }
    if (loadVotes) {
      incomingRelations.add(Relationship.VOTED.ordinal());
    }

    List<Integer> outgoingRelations = new ArrayList<>();
    if (loadChildren || loadDataContract) {
      outgoingRelations.add(Relationship.CONTAINS.ordinal());
    }
    if (loadExperts) {
      outgoingRelations.add(Relationship.EXPERT.ordinal());
    }

    List<String> entityIds = entityListToStrings(entities);
    List<CollectionDAO.EntityRelationshipObject> incomingRecords =
        incomingRelations.isEmpty()
            ? Collections.emptyList()
            : r.daoCollection
                .relationshipDAO()
                .findFromBatchWithRelations(entityIds, r.entityType, incomingRelations, ALL);
    List<CollectionDAO.EntityRelationshipObject> outgoingRecords =
        outgoingRelations.isEmpty()
            ? Collections.emptyList()
            : r.daoCollection
                .relationshipDAO()
                .findToBatchWithRelations(entityIds, r.entityType, outgoingRelations, ALL);

    Map<String, Map<UUID, EntityReference>> incomingRefsByType =
        resolveRelationshipEntityReferencesByType(incomingRecords, true);
    Map<String, Map<UUID, EntityReference>> outgoingRefsByType =
        resolveRelationshipEntityReferencesByType(outgoingRecords, false);

    Map<UUID, List<EntityReference>> ownersByEntity = loadOwners ? new HashMap<>() : null;
    Map<UUID, List<EntityReference>> followersByEntity = loadFollowers ? new HashMap<>() : null;
    Map<UUID, List<EntityReference>> domainsByEntity = loadDomains ? new HashMap<>() : null;
    Map<UUID, List<EntityReference>> reviewersByEntity = loadReviewers ? new HashMap<>() : null;
    Map<UUID, List<EntityReference>> dataProductsByEntity =
        loadDataProducts ? new HashMap<>() : null;
    Map<UUID, List<EntityReference>> upVotersByEntity = loadVotes ? new HashMap<>() : null;
    Map<UUID, List<EntityReference>> downVotersByEntity = loadVotes ? new HashMap<>() : null;
    Map<UUID, List<EntityReference>> childrenByEntity = loadChildren ? new HashMap<>() : null;
    Map<UUID, EntityReference> dataContractByEntity = loadDataContract ? new HashMap<>() : null;
    Map<UUID, List<EntityReference>> expertsByEntity = loadExperts ? new HashMap<>() : null;

    for (CollectionDAO.EntityRelationshipObject record : incomingRecords) {
      UUID entityId = UUID.fromString(record.getToId());
      UUID sourceId = UUID.fromString(record.getFromId());
      String sourceType = record.getFromEntity();
      EntityReference sourceRef = lookupRelationshipRef(incomingRefsByType, sourceType, sourceId);
      if (sourceRef == null) {
        continue;
      }

      Relationship relationship = relationshipFromOrdinal(record.getRelation());
      if (relationship == null) {
        continue;
      }
      switch (relationship) {
        case OWNS -> {
          if (loadOwners) {
            ownersByEntity.computeIfAbsent(entityId, ignored -> new ArrayList<>()).add(sourceRef);
          }
        }
        case FOLLOWS -> {
          if (loadFollowers && USER.equals(sourceType)) {
            followersByEntity
                .computeIfAbsent(entityId, ignored -> new ArrayList<>())
                .add(sourceRef);
          }
        }
        case HAS -> {
          if (loadDomains && DOMAIN.equals(sourceType)) {
            domainsByEntity.computeIfAbsent(entityId, ignored -> new ArrayList<>()).add(sourceRef);
          } else if (loadDataProducts && DATA_PRODUCT.equals(sourceType)) {
            dataProductsByEntity
                .computeIfAbsent(entityId, ignored -> new ArrayList<>())
                .add(sourceRef);
          }
        }
        case REVIEWS -> {
          if (loadReviewers) {
            reviewersByEntity
                .computeIfAbsent(entityId, ignored -> new ArrayList<>())
                .add(sourceRef);
          }
        }
        case VOTED -> {
          if (loadVotes && USER.equals(sourceType)) {
            VoteType voteType = JsonUtils.readValue(record.getJson(), VoteType.class);
            if (voteType == VoteType.VOTED_UP) {
              upVotersByEntity
                  .computeIfAbsent(entityId, ignored -> new ArrayList<>())
                  .add(sourceRef);
            } else if (voteType == VoteType.VOTED_DOWN) {
              downVotersByEntity
                  .computeIfAbsent(entityId, ignored -> new ArrayList<>())
                  .add(sourceRef);
            }
          }
        }
        default -> {
          // no-op
        }
      }
    }

    for (CollectionDAO.EntityRelationshipObject record : outgoingRecords) {
      UUID entityId = UUID.fromString(record.getFromId());
      UUID targetId = UUID.fromString(record.getToId());
      String targetType = record.getToEntity();
      EntityReference targetRef = lookupRelationshipRef(outgoingRefsByType, targetType, targetId);
      if (targetRef == null) {
        continue;
      }

      Relationship relationship = relationshipFromOrdinal(record.getRelation());
      if (relationship == null) {
        continue;
      }
      switch (relationship) {
        case CONTAINS -> {
          if (loadChildren && r.entityType.equals(targetType)) {
            childrenByEntity.computeIfAbsent(entityId, ignored -> new ArrayList<>()).add(targetRef);
          } else if (loadDataContract && DATA_CONTRACT.equals(targetType)) {
            dataContractByEntity.putIfAbsent(entityId, targetRef);
          }
        }
        case EXPERT -> {
          if (loadExperts && USER.equals(targetType)) {
            expertsByEntity.computeIfAbsent(entityId, ignored -> new ArrayList<>()).add(targetRef);
          }
        }
        default -> {
          // no-op
        }
      }
    }

    Set<String> handledFields = new HashSet<>();
    for (T entity : entities) {
      UUID entityId = entity.getId();
      if (loadOwners) {
        entity.setOwners(ownersByEntity.getOrDefault(entityId, Collections.emptyList()));
      }
      if (loadFollowers) {
        entity.setFollowers(followersByEntity.getOrDefault(entityId, Collections.emptyList()));
      }
      if (loadDomains) {
        entity.setDomains(domainsByEntity.getOrDefault(entityId, Collections.emptyList()));
      }
      if (loadReviewers) {
        entity.setReviewers(reviewersByEntity.getOrDefault(entityId, Collections.emptyList()));
      }
      if (loadDataProducts) {
        entity.setDataProducts(
            dataProductsByEntity.getOrDefault(entityId, Collections.emptyList()));
      }
      if (loadVotes) {
        List<EntityReference> upVoters =
            upVotersByEntity.getOrDefault(entityId, Collections.emptyList());
        List<EntityReference> downVoters =
            downVotersByEntity.getOrDefault(entityId, Collections.emptyList());
        entity.setVotes(
            new Votes()
                .withUpVotes(upVoters.size())
                .withDownVotes(downVoters.size())
                .withUpVoters(upVoters)
                .withDownVoters(downVoters));
      }
      if (loadChildren) {
        entity.setChildren(childrenByEntity.get(entityId));
      }
      if (loadDataContract) {
        entity.setDataContract(dataContractByEntity.get(entityId));
      }
      if (loadExperts) {
        entity.setExperts(expertsByEntity.getOrDefault(entityId, Collections.emptyList()));
      }
    }

    if (loadOwners) {
      handledFields.add(FIELD_OWNERS);
    }
    if (loadFollowers) {
      handledFields.add(FIELD_FOLLOWERS);
    }
    if (loadDomains) {
      handledFields.add(FIELD_DOMAINS);
    }
    if (loadReviewers) {
      handledFields.add(FIELD_REVIEWERS);
    }
    if (loadDataProducts) {
      handledFields.add(FIELD_DATA_PRODUCTS);
    }
    if (loadVotes) {
      handledFields.add(FIELD_VOTES);
    }
    if (loadChildren) {
      handledFields.add(FIELD_CHILDREN);
    }
    if (loadDataContract) {
      handledFields.add(FIELD_DATA_CONTRACT);
    }
    if (loadExperts) {
      handledFields.add(FIELD_EXPERTS);
    }
    return handledFields;
  }

  Map<String, Map<UUID, EntityReference>> resolveRelationshipEntityReferencesByType(
      List<CollectionDAO.EntityRelationshipObject> records, boolean fromSide) {
    if (records == null || records.isEmpty()) {
      return Collections.emptyMap();
    }

    Map<String, Set<UUID>> idsByType = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : records) {
      String entityTypeForRef = fromSide ? record.getFromEntity() : record.getToEntity();
      String entityId = fromSide ? record.getFromId() : record.getToId();
      if (nullOrEmpty(entityTypeForRef)
          || nullOrEmpty(entityId)
          || !Entity.hasEntityRepository(entityTypeForRef)) {
        continue;
      }
      idsByType
          .computeIfAbsent(entityTypeForRef, ignored -> new HashSet<>())
          .add(UUID.fromString(entityId));
    }

    if (idsByType.isEmpty()) {
      return Collections.emptyMap();
    }

    Map<String, Map<UUID, EntityReference>> refsByType = new HashMap<>();
    for (Entry<String, Set<UUID>> entry : idsByType.entrySet()) {
      List<EntityReference> refs =
          Entity.getEntityReferencesByIds(
              entry.getKey(), new ArrayList<>(entry.getValue()), NON_DELETED);
      refsByType.put(
          entry.getKey(),
          refs.stream()
              .collect(Collectors.toMap(EntityReference::getId, Function.identity(), (a, b) -> a)));
    }
    return refsByType;
  }

  EntityReference lookupRelationshipRef(
      Map<String, Map<UUID, EntityReference>> refsByType, String entityType, UUID id) {
    if (refsByType == null || nullOrEmpty(entityType) || id == null) {
      return null;
    }
    Map<UUID, EntityReference> refs = refsByType.get(entityType);
    return refs == null ? null : refs.get(id);
  }

  Relationship relationshipFromOrdinal(int relationOrdinal) {
    Relationship[] values = Relationship.values();
    return relationOrdinal >= 0 && relationOrdinal < values.length ? values[relationOrdinal] : null;
  }

  void fetchAndSetOwners(List<T> entities, Fields fields) {
    if (!fields.contains(FIELD_OWNERS) || !r.supportsOwners) {
      return;
    }
    Map<UUID, List<EntityReference>> ownersMap = batchFetchOwners(entities);
    for (T entity : entities) {
      entity.setOwners(ownersMap.getOrDefault(entity.getId(), Collections.emptyList()));
    }
  }

  void fetchAndSetFollowers(List<T> entities, Fields fields) {
    if (!fields.contains(FIELD_FOLLOWERS) || !r.supportsFollower) {
      return;
    }
    Map<UUID, List<EntityReference>> followersMap = batchFetchFollowers(entities);
    for (T entity : entities) {
      entity.setFollowers(followersMap.getOrDefault(entity.getId(), Collections.emptyList()));
    }
  }

  void fetchAndSetTags(List<T> entities, Fields fields) {
    if (!fields.contains(FIELD_TAGS) || !r.supportsTags) {
      return;
    }

    List<String> entityFQNs =
        entities.stream().map(EntityInterface::getFullyQualifiedName).toList();

    Map<String, List<TagLabel>> tagsMap = batchFetchTags(entityFQNs);

    // Batch fetch all derived tags in ONE query instead of N queries
    List<TagLabel> allTags =
        tagsMap.values().stream().flatMap(List::stream).collect(Collectors.toList());
    Map<String, List<TagLabel>> derivedTagsMap = TagLabelUtil.batchFetchDerivedTags(allTags);

    for (T entity : entities) {
      List<TagLabel> entityTags =
          tagsMap.getOrDefault(entity.getFullyQualifiedName(), Collections.emptyList());
      entity.setTags(TagLabelUtil.addDerivedTagsWithPreFetched(entityTags, derivedTagsMap));
    }
  }

  void fetchAndSetDomains(List<T> entities, Fields fields) {
    if (!fields.contains(FIELD_DOMAINS) || !r.supportsDomains) {
      return;
    }

    Map<UUID, List<EntityReference>> domainsMap = batchFetchDomains(entities);

    for (T entity : entities) {
      entity.setDomains(domainsMap.getOrDefault(entity.getId(), Collections.emptyList()));
    }
  }

  void fetchAndSetExtension(List<T> entities, Fields fields) {
    if (!fields.contains(FIELD_EXTENSION)
        || !r.supportsExtension
        || entities == null
        || entities.isEmpty()) {
      return;
    }

    Map<UUID, Object> extensionsMap = batchFetchExtensions(entities);

    for (T entity : entities) {
      Object extension = extensionsMap.get(entity.getId());
      entity.setExtension(extension);
    }
  }

  void fetchAndSetChildren(List<T> entities, Fields fields) {
    if (!fields.contains(FIELD_CHILDREN) || entities == null || nullOrEmpty(entities)) {
      return;
    }

    Map<UUID, List<EntityReference>> childrenMap = batchFetchChildren(entities);

    for (T entity : entities) {
      entity.setChildren(childrenMap.get(entity.getId()));
    }
  }

  void fetchAndSetExperts(List<T> entities, Fields fields) {
    if (!fields.contains(FIELD_EXPERTS) || !r.supportsExperts || nullOrEmpty(entities)) {
      return;
    }

    Map<UUID, List<EntityReference>> expertsMap = batchFetchExperts(entities);

    for (T entity : entities) {
      entity.setExperts(expertsMap.getOrDefault(entity.getId(), Collections.emptyList()));
    }
  }

  void fetchAndSetReviewers(List<T> entities, Fields fields) {
    if (!fields.contains(FIELD_REVIEWERS) || !r.supportsReviewers || nullOrEmpty(entities)) {
      return;
    }

    Map<UUID, List<EntityReference>> reviewersMap = batchFetchReviewers(entities);

    for (T entity : entities) {
      List<EntityReference> reviewers =
          reviewersMap.getOrDefault(entity.getId(), Collections.emptyList());
      entity.setReviewers(reviewers);
    }
  }

  void fetchAndSetVotes(List<T> entities, Fields fields) {
    if (!fields.contains(FIELD_VOTES) || !r.supportsVotes || nullOrEmpty(entities)) {
      return;
    }

    Map<UUID, Votes> votesMap = batchFetchVotes(entities);

    for (T entity : entities) {
      entity.setVotes(votesMap.getOrDefault(entity.getId(), new Votes()));
    }
  }

  void enrichEntitiesForAuth(List<T> entities) {
    if (entities == null || entities.isEmpty()) return;
    Map<UUID, List<EntityReference>> ownersMap = batchFetchOwners(entities);
    Map<UUID, List<EntityReference>> domainsMap = batchFetchDomains(entities);
    for (T entity : entities) {
      entity.setOwners(ownersMap.getOrDefault(entity.getId(), entity.getOwners()));
      entity.setDomains(domainsMap.getOrDefault(entity.getId(), entity.getDomains()));
    }
  }

  void fetchAndSetDataProducts(List<T> entities, Fields fields) {
    if (!fields.contains(FIELD_DATA_PRODUCTS) || !r.supportsDataProducts || nullOrEmpty(entities)) {
      return;
    }

    Map<UUID, List<EntityReference>> dataProductsMap = batchFetchDataProducts(entities);

    for (T entity : entities) {
      entity.setDataProducts(dataProductsMap.getOrDefault(entity.getId(), Collections.emptyList()));
    }
  }

  void fetchAndSetCertification(List<T> entities, Fields fields) {
    if (!fields.contains(FIELD_CERTIFICATION)
        || !r.supportsCertification
        || nullOrEmpty(entities)) {
      return;
    }

    Map<UUID, AssetCertification> certificationMap = batchFetchCertification(entities);

    for (T entity : entities) {
      entity.setCertification(certificationMap.get(entity.getId()));
    }
  }

  Map<UUID, List<EntityReference>> batchFetchOwners(List<T> entities) {
    var ownersMap = new HashMap<UUID, List<EntityReference>>();

    if (entities == null || entities.isEmpty()) {
      return ownersMap;
    }
    // Use Include.ALL to get all relationships including those for soft-deleted entities
    // Use the 3-parameter version to find owners of any entity type (equivalent to passing null in
    // single entity version)
    var records =
        r.daoCollection
            .relationshipDAO()
            .findFromBatch(entityListToStrings(entities), Relationship.OWNS.ordinal(), ALL);

    LOG.debug(
        "batchFetchOwners: Found {} owner relationships for {} entities",
        records.size(),
        entities.size());

    // Cache UUID conversions to avoid repeated parsing
    Map<String, UUID> uuidCache = new HashMap<>();

    // Group records by entity type to batch fetch entity references (with deduplication)
    var ownerIdsByType = new HashMap<String, Set<UUID>>();
    records.forEach(
        rec -> {
          var fromEntity = rec.getFromEntity();
          var fromId = uuidCache.computeIfAbsent(rec.getFromId(), UUID::fromString);
          ownerIdsByType.computeIfAbsent(fromEntity, k -> new HashSet<>()).add(fromId);
        });

    // Batch fetch entity references for each entity type
    var ownerRefsByType = new HashMap<String, Map<UUID, EntityReference>>();
    ownerIdsByType.forEach(
        (entityType, ownerIds) -> {
          var ownerRefs =
              Entity.getEntityReferencesByIds(entityType, new ArrayList<>(ownerIds), NON_DELETED);
          var refMap =
              ownerRefs.stream()
                  .collect(Collectors.toMap(EntityReference::getId, ref -> ref, (a, b) -> a));
          ownerRefsByType.put(entityType, refMap);
        });

    // Map owners to entities (reuse cached UUIDs)
    records.forEach(
        rec -> {
          var toId = uuidCache.computeIfAbsent(rec.getToId(), UUID::fromString);
          var fromId = uuidCache.get(rec.getFromId()); // Already cached
          var fromEntity = rec.getFromEntity();

          var refMap = ownerRefsByType.get(fromEntity);
          if (refMap != null) {
            var ownerRef = refMap.get(fromId);
            if (ownerRef != null) {
              ownersMap.computeIfAbsent(toId, k -> new ArrayList<>()).add(ownerRef);
            }
          }
        });

    return ownersMap;
  }

  Map<UUID, List<EntityReference>> batchFetchFollowers(List<T> entities) {
    if (entities == null || entities.isEmpty()) {
      return Collections.emptyMap();
    }

    List<CollectionDAO.EntityRelationshipObject> records =
        r.daoCollection
            .relationshipDAO()
            .findFromBatch(
                entityListToStrings(entities), Relationship.FOLLOWS.ordinal(), Include.ALL);

    Map<UUID, List<EntityReference>> followersMap = new HashMap<>();

    List<UUID> followerIds =
        records.stream()
            .map(record -> UUID.fromString(record.getFromId()))
            .collect(Collectors.toList());

    Map<UUID, EntityReference> followerRefs =
        Entity.getEntityReferencesByIds(USER, followerIds, NON_DELETED).stream()
            .collect(Collectors.toMap(EntityReference::getId, Function.identity()));

    records.forEach(
        record -> {
          UUID entityId = UUID.fromString(record.getToId());
          UUID followerId = UUID.fromString(record.getFromId());
          EntityReference followerRef = followerRefs.get(followerId);
          if (followerRef != null) {
            followersMap.computeIfAbsent(entityId, k -> new ArrayList<>()).add(followerRef);
          }
        });

    return followersMap;
  }

  Map<UUID, Votes> batchFetchVotes(List<T> entities) {
    var votesMap = new HashMap<UUID, Votes>();
    if (entities == null || entities.isEmpty()) {
      return votesMap;
    }

    var records =
        r.daoCollection
            .relationshipDAO()
            .findFromBatch(
                entityListToStrings(entities), Relationship.VOTED.ordinal(), Entity.USER, ALL);

    var upVoterIds = new HashMap<UUID, List<UUID>>();
    var downVoterIds = new HashMap<UUID, List<UUID>>();
    records.forEach(
        rec -> {
          UUID entityId = UUID.fromString(rec.getToId());
          UUID userId = UUID.fromString(rec.getFromId());
          VoteType type = JsonUtils.readValue(rec.getJson(), VoteType.class);
          if (type == VoteType.VOTED_UP) {
            upVoterIds.computeIfAbsent(entityId, k -> new ArrayList<>()).add(userId);
          } else if (type == VoteType.VOTED_DOWN) {
            downVoterIds.computeIfAbsent(entityId, k -> new ArrayList<>()).add(userId);
          }
        });

    Set<UUID> allUserIds = new HashSet<>();
    upVoterIds.values().forEach(allUserIds::addAll);
    downVoterIds.values().forEach(allUserIds::addAll);
    Map<UUID, EntityReference> userRefs =
        Entity.getEntityReferencesByIds(Entity.USER, new ArrayList<>(allUserIds), NON_DELETED)
            .stream()
            .collect(Collectors.toMap(EntityReference::getId, Function.identity()));

    for (T entity : entities) {
      List<EntityReference> up =
          upVoterIds.getOrDefault(entity.getId(), Collections.emptyList()).stream()
              .map(userRefs::get)
              .filter(Objects::nonNull)
              .toList();
      List<EntityReference> down =
          downVoterIds.getOrDefault(entity.getId(), Collections.emptyList()).stream()
              .map(userRefs::get)
              .filter(Objects::nonNull)
              .toList();
      votesMap.put(
          entity.getId(),
          new Votes()
              .withUpVotes(up.size())
              .withDownVotes(down.size())
              .withUpVoters(up)
              .withDownVoters(down));
    }

    return votesMap;
  }

  Map<UUID, List<EntityReference>> batchFetchDataProducts(List<T> entities) {
    return batchFetchToIdsOneToMany(entities, Relationship.HAS, Entity.DATA_PRODUCT);
  }

  Map<UUID, AssetCertification> batchFetchCertification(List<T> entities) {
    var result = new HashMap<UUID, AssetCertification>();
    if (entities == null || entities.isEmpty() || !r.supportsCertification) {
      return result;
    }

    long startTime = System.currentTimeMillis();

    String certClassification = r.getCertificationClassification();
    if (certClassification == null) {
      return result;
    }

    // Build FQN hash → entity ID map (batch query uses hashed FQNs for lookup)
    Map<String, UUID> entityIdByFqnHash = new HashMap<>();
    List<String> fqnList = new ArrayList<>();
    for (T entity : entities) {
      fqnList.add(entity.getFullyQualifiedName());
      entityIdByFqnHash.put(
          FullyQualifiedName.buildHash(entity.getFullyQualifiedName()), entity.getId());
    }

    List<CollectionDAO.TagUsageDAO.TagLabelWithFQNHash> certTags;
    try {
      certTags =
          r.daoCollection
              .tagUsageDAO()
              .getCertTagsInternalBatch(
                  TagLabel.TagSource.CLASSIFICATION.ordinal(),
                  fqnList,
                  FullyQualifiedName.buildHash(certClassification) + ".%");
    } catch (Exception e) {
      LOG.warn(
          "batchFetchCertification: batch query failed, falling back to individual fetch: {}",
          e.getMessage());
      for (T entity : entities) {
        result.put(entity.getId(), r.getCertification(entity));
      }
      return result;
    }

    for (CollectionDAO.TagUsageDAO.TagLabelWithFQNHash tagWithHash : certTags) {
      UUID entityId = entityIdByFqnHash.get(tagWithHash.getTargetFQNHash());
      if (entityId == null || result.containsKey(entityId)) {
        continue;
      }
      TagLabel tagLabel = tagWithHash.toTagLabel();
      TagLabelUtil.applyTagCommonFieldsGracefully(tagLabel);
      result.put(
          entityId,
          new AssetCertification()
              .withTagLabel(tagLabel)
              .withAppliedDate(
                  tagLabel.getAppliedAt() != null ? tagLabel.getAppliedAt().getTime() : null)
              .withExpiryDate(
                  tagLabel.getMetadata() != null ? tagLabel.getMetadata().getExpiryDate() : null));
    }

    LOG.debug(
        "batchFetchCertification: {} entities, {} certs found in {}ms",
        entities.size(),
        result.size(),
        System.currentTimeMillis() - startTime);

    return result;
  }

  /**
   * Creates a unique key for a TagLabel combining TagFQN and Source for fast Set-based lookups.
   * This replaces O(n) stream().anyMatch() operations with O(1) Set.contains() operations.
   */
  String createTagKey(TagLabel tag) {
    return tag.getTagFQN() + ":" + tag.getSource();
  }

  /**
   * Creates a Set of tag keys from a list of TagLabels for efficient O(1) lookups.
   */
  Set<String> createTagKeySet(List<TagLabel> tags) {
    return tags.stream().map(this::createTagKey).collect(Collectors.toSet());
  }

  Map<String, List<TagLabel>> batchFetchTags(List<String> entityFQNs) {
    if (entityFQNs == null || entityFQNs.isEmpty()) {
      return Collections.emptyMap();
    }

    Map<String, List<TagLabel>> targetHashToTagLabel =
        populateTagLabel(
            listOrEmpty(r.daoCollection.tagUsageDAO().getTagsInternalBatch(entityFQNs)));
    String certClassification = r.getCertificationClassification();
    return entityFQNs.stream()
        .collect(
            Collectors.toMap(
                Function.identity(),
                fqn -> {
                  String targetFQNHash = FullyQualifiedName.buildHash(fqn);
                  List<TagLabel> tags =
                      Optional.ofNullable(targetHashToTagLabel.get(targetFQNHash))
                          .filter(list -> !list.isEmpty())
                          .orElseGet(ArrayList::new);
                  if (certClassification != null) {
                    tags.removeIf(
                        tag ->
                            certClassification.equals(
                                FullyQualifiedName.getParentFQN(tag.getTagFQN())));
                  }
                  return tags;
                },
                (a, b) -> a));
  }

  Map<UUID, List<EntityReference>> batchFetchDomains(List<T> entities) {
    Map<UUID, List<EntityReference>> domainsMap = new HashMap<>();

    if (entities == null || entities.isEmpty()) {
      return domainsMap;
    }
    List<CollectionDAO.EntityRelationshipObject> records =
        r.daoCollection
            .relationshipDAO()
            .findFromBatch(entityListToStrings(entities), Relationship.HAS.ordinal(), DOMAIN, ALL);

    // Collect all unique domain IDs first
    var domainIds =
        records.stream().map(rec -> UUID.fromString(rec.getFromId())).distinct().toList();

    // Batch fetch all domain entity references
    var domainRefs = Entity.getEntityReferencesByIds(DOMAIN, domainIds, ALL);
    var domainRefMap =
        domainRefs.stream().collect(Collectors.toMap(EntityReference::getId, ref -> ref));

    for (CollectionDAO.EntityRelationshipObject rec : records) {
      UUID toId = UUID.fromString(rec.getToId());
      UUID fromId = UUID.fromString(rec.getFromId());
      EntityReference domainRef = domainRefMap.get(fromId);
      domainsMap.computeIfAbsent(toId, k -> new ArrayList<>()).add(domainRef);
    }

    return domainsMap;
  }

  Map<UUID, List<EntityReference>> batchFetchReviewers(List<T> entities) {
    if (entities == null || entities.isEmpty()) {
      return new HashMap<>();
    }

    // Use Include.ALL to get all relationships including those for soft-deleted entities
    var records =
        r.daoCollection
            .relationshipDAO()
            .findFromBatch(entityListToStrings(entities), Relationship.REVIEWS.ordinal(), ALL);

    var reviewersMap = new HashMap<UUID, List<EntityReference>>();

    // Cache UUID conversions to avoid repeated parsing
    Map<String, UUID> uuidCache = new HashMap<>();

    // Group records by entity type to batch fetch entity references (with deduplication)
    var reviewerIdsByType = new HashMap<String, Set<UUID>>();
    records.forEach(
        rec -> {
          var fromEntity = rec.getFromEntity();
          var fromId = uuidCache.computeIfAbsent(rec.getFromId(), UUID::fromString);
          reviewerIdsByType.computeIfAbsent(fromEntity, k -> new HashSet<>()).add(fromId);
        });

    // Batch fetch entity references for each entity type
    var reviewerRefsByType = new HashMap<String, Map<UUID, EntityReference>>();
    reviewerIdsByType.forEach(
        (entityType, reviewerIds) -> {
          var reviewerRefs =
              Entity.getEntityReferencesByIds(
                  entityType, new ArrayList<>(reviewerIds), NON_DELETED);
          var refMap =
              reviewerRefs.stream()
                  .collect(Collectors.toMap(EntityReference::getId, ref -> ref, (a, b) -> a));
          reviewerRefsByType.put(entityType, refMap);
        });

    // Map reviewers to entities (reuse cached UUIDs)
    records.forEach(
        rec -> {
          var entityId = uuidCache.computeIfAbsent(rec.getToId(), UUID::fromString);
          var fromId = uuidCache.get(rec.getFromId()); // Already cached
          var fromEntity = rec.getFromEntity();

          var refMap = reviewerRefsByType.get(fromEntity);
          if (refMap != null) {
            var reviewerRef = refMap.get(fromId);
            if (reviewerRef != null) {
              reviewersMap.computeIfAbsent(entityId, k -> new ArrayList<>()).add(reviewerRef);
            }
          }
        });

    return reviewersMap;
  }

  Map<UUID, Object> batchFetchExtensions(List<T> entities) {
    if (!r.supportsExtension || entities == null || entities.isEmpty()) {
      return Collections.emptyMap();
    }
    String fieldFQNPrefix = TypeRegistry.getCustomPropertyFQNPrefix(r.entityType);

    List<CollectionDAO.ExtensionRecordWithId> records =
        r.daoCollection
            .entityExtensionDAO()
            .getExtensionsBatch(entityListToStrings(entities), fieldFQNPrefix);

    Map<UUID, List<CollectionDAO.ExtensionRecordWithId>> extensionsMap =
        records.stream().collect(Collectors.groupingBy(CollectionDAO.ExtensionRecordWithId::id));

    Map<UUID, Object> result = new HashMap<>();

    for (Entry<UUID, List<CollectionDAO.ExtensionRecordWithId>> entry : extensionsMap.entrySet()) {
      UUID entityId = entry.getKey();
      List<CollectionDAO.ExtensionRecordWithId> extensionRecords = entry.getValue();

      ObjectNode objectNode = JsonUtils.getObjectNode();
      for (CollectionDAO.ExtensionRecordWithId record : extensionRecords) {
        String fieldName = TypeRegistry.getPropertyName(record.extensionName());
        JsonNode extensionJsonNode = JsonUtils.readTree(record.extensionJson());
        objectNode.set(fieldName, extensionJsonNode);
      }

      result.put(entityId, objectNode);
    }

    return result;
  }

  Map<UUID, List<EntityReference>> batchFetchExperts(List<T> entities) {
    if (!r.supportsExperts || nullOrEmpty(entities)) {
      return Collections.emptyMap();
    }

    // Batch fetch all expert relationships - experts are TO relationships
    List<CollectionDAO.EntityRelationshipObject> records =
        r.daoCollection
            .relationshipDAO()
            .findToBatch(entityListToStrings(entities), Relationship.EXPERT.ordinal(), USER);

    Map<UUID, List<EntityReference>> expertsMap = new HashMap<>();

    // Cache UUID conversions to avoid repeated parsing
    Map<String, UUID> uuidCache = new HashMap<>();

    // findToBatch returns fromId=entity, toId=user — collect user IDs from toId
    List<UUID> expertIds =
        records.stream()
            .map(record -> uuidCache.computeIfAbsent(record.getToId(), UUID::fromString))
            .distinct()
            .collect(Collectors.toList());

    // Batch fetch all expert references, filtering out soft-deleted users
    Map<UUID, EntityReference> expertRefs =
        Entity.getEntityReferencesByIds(USER, expertIds, NON_DELETED).stream()
            .collect(Collectors.toMap(EntityReference::getId, Function.identity(), (a, b) -> a));

    // Group experts by entity
    records.forEach(
        record -> {
          UUID entityId = uuidCache.computeIfAbsent(record.getFromId(), UUID::fromString);
          UUID expertId = uuidCache.get(record.getToId()); // Already cached above
          EntityReference expertRef = expertRefs.get(expertId);
          if (expertRef != null) {
            expertsMap.computeIfAbsent(entityId, k -> new ArrayList<>()).add(expertRef);
          }
        });

    LOG.debug(
        "batchFetchExperts: Found {} expert relationships for {} entities",
        records.size(),
        entities.size());

    return expertsMap;
  }

  Map<UUID, List<EntityReference>> batchFetchChildren(List<T> entities) {
    if (entities == null || entities.isEmpty()) {
      return new HashMap<>();
    }

    // Use Include.ALL to get all relationships including those for soft-deleted entities
    var records =
        r.daoCollection
            .relationshipDAO()
            .findToBatch(
                entityListToStrings(entities), Relationship.CONTAINS.ordinal(), r.entityType, ALL);

    var childrenMap = new HashMap<UUID, List<EntityReference>>();

    if (CollectionUtils.isEmpty(records)) {
      return childrenMap;
    }

    var idReferenceMap =
        Entity.getEntityReferencesByIds(
                records.get(0).getToEntity(),
                records.stream().map(e -> UUID.fromString(e.getToId())).distinct().toList(),
                ALL)
            .stream()
            .collect(Collectors.toMap(e -> e.getId().toString(), Function.identity()));

    records.forEach(
        rec -> {
          var entityId = UUID.fromString(rec.getFromId());
          var childrenRef = idReferenceMap.get(rec.getToId());
          if (childrenRef != null) {
            childrenMap.computeIfAbsent(entityId, k -> new ArrayList<>()).add(childrenRef);
          }
        });

    return childrenMap;
  }

  List<String> entityListToStrings(List<T> entities) {
    return entities.stream().map(EntityInterface::getId).map(UUID::toString).toList();
  }

  Iterator<Either<T, EntityError>> serializeJsons(
      List<String> jsons, Fields fields, UriInfo uriInfo) {
    List<Either<T, EntityError>> results = new ArrayList<>();
    List<T> entities = new ArrayList<>();

    for (String json : jsons) {
      try {
        T entity = JsonUtils.readValue(json, r.entityClass);
        entities.add(entity);
      } catch (Exception e) {
        EntityError entityError =
            new EntityError()
                .withMessage("Failed to deserialize entity: " + e.getMessage())
                .withEntity(null);
        results.add(Either.right(entityError));
      }
    }

    if (!entities.isEmpty()) {
      try {
        r.setFieldsInBulk(fields, entities);
        if (!nullOrEmpty(uriInfo)) {
          entities.forEach(entity -> r.withHref(uriInfo, entity));
        }

        for (T entity : entities) {
          results.add(Either.left(entity));
        }
      } catch (Exception e) {
        LOG.warn("setFieldsInBulk failed in serializeJsons, falling back to per-entity loading", e);
        for (T entity : entities) {
          try {
            r.setFieldsInternal(entity, fields);
            r.setInheritedFields(entity, fields);
            r.clearFieldsInternal(entity, fields);
            if (!nullOrEmpty(uriInfo)) {
              entity = r.withHref(uriInfo, entity);
            }
            results.add(Either.left(entity));
          } catch (Exception individualError) {
            r.clearFieldsInternal(entity, fields);
            EntityError entityError =
                new EntityError().withMessage(individualError.getMessage()).withEntity(entity);
            results.add(Either.right(entityError));
          }
        }
      }
    }
    return results.iterator();
  }

  <V> void setFieldFromMap(
      boolean includeField, List<T> entities, Map<UUID, V> valueMap, BiConsumer<T, V> setter) {
    if (!includeField || entities.isEmpty()) {
      return;
    }
    for (T entity : entities) {
      V value = valueMap.get(entity.getId());
      setter.accept(entity, value);
    }
  }

  <V> void setFieldFromMapSingleRelation(
      boolean includeField, List<T> entities, Map<UUID, V> valueMap, BiConsumer<T, V> setter) {
    if (!includeField || entities.isEmpty()) {
      return;
    }
    for (T entity : entities) {
      V value = valueMap.get(entity.getId());
      setter.accept(entity, value);
    }
  }

  Map<UUID, List<EntityReference>> batchFetchFromIdsManyToOne(
      List<T> entities, Relationship relationship, String toEntityType) {
    var resultMap = new HashMap<UUID, List<EntityReference>>();
    if (entities == null || entities.isEmpty()) {
      return resultMap;
    }

    // Use Include.ALL to get all relationships including those for soft-deleted entities
    var records =
        r.daoCollection
            .relationshipDAO()
            .findToBatch(entityListToStrings(entities), relationship.ordinal(), toEntityType, ALL);

    var idReferenceMap =
        Entity.getEntityReferencesByIds(
                toEntityType,
                records.stream().map(e -> UUID.fromString(e.getToId())).distinct().toList(),
                ALL)
            .stream()
            .collect(Collectors.toMap(e -> e.getId().toString(), Function.identity()));

    records.forEach(
        record -> {
          var entityId = UUID.fromString(record.getFromId());
          var relatedRef = idReferenceMap.get(record.getToId());
          if (relatedRef != null) {
            resultMap.computeIfAbsent(entityId, k -> new ArrayList<>()).add(relatedRef);
          }
        });

    return resultMap;
  }

  Map<UUID, List<EntityReference>> batchFetchToIdsOneToMany(
      List<T> entities, Relationship relationship, String fromEntityType) {
    var resultMap = new HashMap<UUID, List<EntityReference>>();
    if (entities == null || entities.isEmpty()) {
      return resultMap;
    }

    // Use Include.ALL to get all relationships including those for soft-deleted entities
    var records =
        r.daoCollection
            .relationshipDAO()
            .findFromBatch(
                entityListToStrings(entities), relationship.ordinal(), fromEntityType, ALL);

    var idReferenceMap =
        Entity.getEntityReferencesByIds(
                fromEntityType,
                records.stream().map(e -> UUID.fromString(e.getFromId())).distinct().toList(),
                ALL)
            .stream()
            .collect(Collectors.toMap(e -> e.getId().toString(), Function.identity()));

    records.forEach(
        record -> {
          var entityId = UUID.fromString(record.getToId());
          var relatedRef = idReferenceMap.get(record.getFromId());
          if (relatedRef != null) {
            resultMap.computeIfAbsent(entityId, k -> new ArrayList<>()).add(relatedRef);
          }
        });

    return resultMap;
  }

  Map<UUID, EntityReference> batchFetchFromIdsAndRelationSingleRelation(
      List<T> entities, Relationship relationship) {
    var resultMap = new HashMap<UUID, EntityReference>();
    if (entities == null || entities.isEmpty()) {
      return resultMap;
    }

    // Use Include.ALL to get all relationships including those for soft-deleted entities
    var records =
        r.daoCollection
            .relationshipDAO()
            .findFromBatch(entityListToStrings(entities), relationship.ordinal(), ALL);

    var idReferenceMap = new HashMap<String, EntityReference>();

    // Group by entity type to make efficient batch calls
    var entityTypeToIds =
        records.stream()
            .collect(
                Collectors.groupingBy(
                    CollectionDAO.EntityRelationshipObject::getFromEntity,
                    Collectors.mapping(
                        CollectionDAO.EntityRelationshipObject::getFromId, Collectors.toList())));

    entityTypeToIds.forEach(
        (entityType, idStrings) -> {
          var ids = idStrings.stream().map(UUID::fromString).distinct().toList();
          var refs = Entity.getEntityReferencesByIds(entityType, ids, ALL);
          refs.forEach(ref -> idReferenceMap.put(ref.getId().toString(), ref));
        });

    records.forEach(
        record -> {
          var entityId = UUID.fromString(record.getToId());
          var relatedRef = idReferenceMap.get(record.getFromId());
          if (relatedRef != null) {
            resultMap.put(entityId, relatedRef);
          }
        });

    return resultMap;
  }

  /** Bulk populate field tags for multiple entities using chunked exact-match IN on field FQN hashes. */
  <F extends FieldInterface> void bulkPopulateEntityFieldTags(
      List<T> entities, java.util.function.Function<T, List<F>> fieldExtractor) {

    if (entities == null || entities.isEmpty()) {
      return;
    }

    Set<String> fieldFQNs = new LinkedHashSet<>();
    Map<T, List<F>> flatFieldsByEntity = new HashMap<>();
    for (T entity : entities) {
      List<F> fields = fieldExtractor.apply(entity);
      if (fields != null) {
        List<F> flattenedFields = EntityUtil.getFlattenedEntityField(fields);
        flatFieldsByEntity.put(entity, flattenedFields);
        for (F field : listOrEmpty(flattenedFields)) {
          if (field.getFullyQualifiedName() != null) {
            fieldFQNs.add(field.getFullyQualifiedName());
          }
        }
      }
    }

    if (fieldFQNs.isEmpty()) {
      return;
    }

    // Fetch tags in chunked IN queries, then enrich once
    List<String> fieldFQNList = new ArrayList<>(fieldFQNs);
    int batchSize = 5000;
    List<CollectionDAO.TagUsageDAO.TagLabelWithFQNHash> tagUsages = new ArrayList<>();
    for (int i = 0; i < fieldFQNList.size(); i += batchSize) {
      List<String> chunk = fieldFQNList.subList(i, Math.min(i + batchSize, fieldFQNList.size()));
      tagUsages.addAll(listOrEmpty(r.daoCollection.tagUsageDAO().getTagsInternalBatch(chunk)));
    }
    Map<String, List<TagLabel>> tagsByFieldHash = populateTagLabel(tagUsages);

    Map<String, List<TagLabel>> derivedTagsMap;
    try {
      List<TagLabel> tagLabels =
          tagsByFieldHash.values().stream().flatMap(List::stream).collect(Collectors.toList());
      derivedTagsMap = TagLabelUtil.batchFetchDerivedTags(tagLabels);
    } catch (Exception ex) {
      LOG.warn("Failed to batch fetch derived tags for fields. Skipping derived tags.", ex);
      derivedTagsMap = Collections.emptyMap();
    }

    for (T entity : entities) {
      List<F> flattenedFields = flatFieldsByEntity.get(entity);
      if (flattenedFields != null) {
        for (F field : listOrEmpty(flattenedFields)) {
          String fieldHash = FullyQualifiedName.buildHash(field.getFullyQualifiedName());
          List<TagLabel> fieldTags = tagsByFieldHash.get(fieldHash);
          if (fieldTags == null) {
            field.setTags(new ArrayList<>());
          } else {
            field.setTags(TagLabelUtil.addDerivedTagsWithPreFetched(fieldTags, derivedTagsMap));
          }
        }
      }
    }
  }
}
