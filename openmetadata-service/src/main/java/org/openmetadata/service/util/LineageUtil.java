package org.openmetadata.service.util;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.jdbi3.LineageRepository.buildEntityLineageData;
import static org.openmetadata.service.jdbi3.LineageRepository.getDocumentUniqueId;
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;
import static org.openmetadata.service.search.SearchClient.REMOVE_LINEAGE_SCRIPT;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LayerPaging;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.lineage.NodeInformation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.tags.TagLabelUtil;

@Slf4j
public class LineageUtil {

  private LineageUtil() {}

  public static void addDomainLineage(
      UUID entityId, String entityType, EntityReference updatedDomain) {
    if (!nullOrEmpty(updatedDomain)) {
      List<CollectionDAO.EntityRelationshipObject> downstreamDomains =
          Entity.getCollectionDAO().relationshipDAO().findDownstreamDomains(entityId, entityType);
      List<CollectionDAO.EntityRelationshipObject> upstreamDomains =
          Entity.getCollectionDAO().relationshipDAO().findUpstreamDomains(entityId, entityType);
      for (CollectionDAO.EntityRelationshipObject downstreamDomain : downstreamDomains) {
        insertDomainLineage(
            updatedDomain,
            Entity.getEntityReferenceById(
                downstreamDomain.getFromEntity(),
                UUID.fromString(downstreamDomain.getFromId()),
                Include.ALL));
      }
      for (CollectionDAO.EntityRelationshipObject upstreamDomain : upstreamDomains) {
        insertDomainLineage(
            Entity.getEntityReferenceById(
                upstreamDomain.getFromEntity(),
                UUID.fromString(upstreamDomain.getFromId()),
                Include.ALL),
            updatedDomain);
      }
    }
  }

  public static void removeDomainLineage(
      UUID entityId, String entityType, EntityReference updatedDomain) {
    if (!nullOrEmpty(updatedDomain)) {
      List<CollectionDAO.EntityRelationshipObject> downstreamDomains =
          Entity.getCollectionDAO().relationshipDAO().findDownstreamDomains(entityId, entityType);
      List<CollectionDAO.EntityRelationshipObject> upstreamDomains =
          Entity.getCollectionDAO().relationshipDAO().findUpstreamDomains(entityId, entityType);
      for (CollectionDAO.EntityRelationshipObject downstreamDomain : downstreamDomains) {
        updateLineage(
            updatedDomain,
            Entity.getEntityReferenceById(
                downstreamDomain.getFromEntity(),
                UUID.fromString(downstreamDomain.getFromId()),
                Include.ALL));
      }
      for (CollectionDAO.EntityRelationshipObject upstreamDomain : upstreamDomains) {
        updateLineage(
            Entity.getEntityReferenceById(
                upstreamDomain.getFromEntity(),
                UUID.fromString(upstreamDomain.getFromId()),
                Include.ALL),
            updatedDomain);
      }
    }
  }

  private static void updateLineage(EntityReference fromRef, EntityReference toRef) {
    if (fromRef == null || toRef == null) return;

    CollectionDAO.EntityRelationshipObject relation =
        Entity.getCollectionDAO()
            .relationshipDAO()
            .getRecord(fromRef.getId(), toRef.getId(), Relationship.UPSTREAM.ordinal());

    if (relation == null) return;

    LineageDetails lineageDetails = JsonUtils.readValue(relation.getJson(), LineageDetails.class);
    if (lineageDetails.getAssetEdges() - 1 < 1) {
      Entity.getCollectionDAO()
          .relationshipDAO()
          .delete(
              fromRef.getId(),
              fromRef.getType(),
              toRef.getId(),
              toRef.getType(),
              Relationship.UPSTREAM.ordinal());
      deleteLineageFromSearch(fromRef, toRef, lineageDetails);
    } else {
      lineageDetails.withAssetEdges(lineageDetails.getAssetEdges() - 1);
      Entity.getCollectionDAO()
          .relationshipDAO()
          .insert(
              fromRef.getId(),
              toRef.getId(),
              fromRef.getType(),
              toRef.getType(),
              Relationship.UPSTREAM.ordinal(),
              JsonUtils.pojoToJson(lineageDetails));
      addLineageToSearch(fromRef, toRef, lineageDetails);
    }
  }

  private static void deleteLineageFromSearch(
      EntityReference fromEntity, EntityReference toEntity, LineageDetails lineageDetails) {
    String uniqueValue = getDocumentUniqueId(fromEntity, toEntity);
    Entity.getSearchRepository()
        .getSearchClient()
        .updateChildren(
            GLOBAL_SEARCH_ALIAS,
            new ImmutablePair<>("upstreamLineage.docUniqueId.keyword", uniqueValue),
            new ImmutablePair<>(
                REMOVE_LINEAGE_SCRIPT, Collections.singletonMap("docUniqueId", uniqueValue)));
  }

  private static void insertDomainLineage(EntityReference fromDomain, EntityReference toDomain) {
    int count =
        Entity.getCollectionDAO()
            .relationshipDAO()
            .countDomainChildAssets(fromDomain.getId(), toDomain.getId());
    insertLineage(count, fromDomain, toDomain);
  }

  private static void insertDataProductLineage(
      EntityReference fromDataProduct, EntityReference toDataProduct) {
    int count =
        Entity.getCollectionDAO()
            .relationshipDAO()
            .countDataProductsChildAssets(fromDataProduct.getId(), toDataProduct.getId());
    insertLineage(count, fromDataProduct, toDataProduct);
  }

  private static void insertLineage(int count, EntityReference fromRef, EntityReference toRef) {
    if (count > 0) {
      LineageDetails domainLineageDetails =
          new LineageDetails()
              .withCreatedAt(System.currentTimeMillis())
              .withUpdatedAt(System.currentTimeMillis())
              .withCreatedBy(ADMIN_USER_NAME)
              .withUpdatedBy(ADMIN_USER_NAME)
              .withSource(LineageDetails.Source.CHILD_ASSETS)
              .withAssetEdges(count);
      Entity.getCollectionDAO()
          .relationshipDAO()
          .insert(
              fromRef.getId(),
              toRef.getId(),
              fromRef.getType(),
              toRef.getType(),
              Relationship.UPSTREAM.ordinal(),
              JsonUtils.pojoToJson(domainLineageDetails));
      addLineageToSearch(fromRef, toRef, domainLineageDetails);
    }
  }

  private static void addLineageToSearch(
      EntityReference fromEntity, EntityReference toEntity, LineageDetails lineageDetails) {
    IndexMapping destinationIndexMapping =
        Entity.getSearchRepository().getIndexMapping(toEntity.getType());
    String destinationIndexName =
        destinationIndexMapping.getIndexName(Entity.getSearchRepository().getClusterAlias());
    // For lineage from -> to (not stored) since the doc itself is the toEntity
    EsLineageData lineageData =
        buildEntityLineageData(fromEntity, toEntity, lineageDetails).withToEntity(null);
    Pair<String, String> to = new ImmutablePair<>("_id", toEntity.getId().toString());
    Entity.getSearchRepository()
        .getSearchClient()
        .updateLineage(destinationIndexName, to, lineageData);
  }

  public static void addDataProductsLineage(
      UUID entityId, String entityType, List<EntityReference> updatedDataProducts) {
    for (EntityReference ref : listOrEmpty(updatedDataProducts)) {
      List<CollectionDAO.EntityRelationshipObject> downstreamDataProducts =
          Entity.getCollectionDAO()
              .relationshipDAO()
              .findDownstreamDataProducts(entityId, entityType);
      List<CollectionDAO.EntityRelationshipObject> upstreamDataProducts =
          Entity.getCollectionDAO()
              .relationshipDAO()
              .findUpstreamDataProducts(entityId, entityType);
      for (CollectionDAO.EntityRelationshipObject downstreamDataProduct : downstreamDataProducts) {
        insertDataProductLineage(
            ref,
            Entity.getEntityReferenceById(
                downstreamDataProduct.getFromEntity(),
                UUID.fromString(downstreamDataProduct.getFromId()),
                Include.ALL));
      }
      for (CollectionDAO.EntityRelationshipObject upstreamDataProduct : upstreamDataProducts) {
        insertDataProductLineage(
            Entity.getEntityReferenceById(
                upstreamDataProduct.getFromEntity(),
                UUID.fromString(upstreamDataProduct.getFromId()),
                Include.ALL),
            ref);
      }
    }
  }

  public static void removeDataProductsLineage(
      UUID entityId, String entityType, List<EntityReference> updatedDataProducts) {
    for (EntityReference ref : listOrEmpty(updatedDataProducts)) {
      List<CollectionDAO.EntityRelationshipObject> downstreamDataProducts =
          Entity.getCollectionDAO()
              .relationshipDAO()
              .findDownstreamDataProducts(entityId, entityType);
      List<CollectionDAO.EntityRelationshipObject> upstreamDataProducts =
          Entity.getCollectionDAO()
              .relationshipDAO()
              .findUpstreamDataProducts(entityId, entityType);
      for (CollectionDAO.EntityRelationshipObject downstreamDataProduct : downstreamDataProducts) {
        updateLineage(
            ref,
            Entity.getEntityReferenceById(
                downstreamDataProduct.getFromEntity(),
                UUID.fromString(downstreamDataProduct.getFromId()),
                Include.ALL));
      }
      for (CollectionDAO.EntityRelationshipObject upstreamDataProduct : upstreamDataProducts) {
        updateLineage(
            Entity.getEntityReferenceById(
                upstreamDataProduct.getFromEntity(),
                UUID.fromString(upstreamDataProduct.getFromId()),
                Include.ALL),
            ref);
      }
    }
  }

  public static NodeInformation getNodeInformation(
      Map<String, Object> sourceMap,
      Integer entityDownstreamCount,
      Integer entityUpstreamCount,
      Integer nodeDepth) {
    // sourceMap.remove("upstreamLineage");
    return new NodeInformation()
        .withEntity(sourceMap)
        .withPaging(
            new LayerPaging()
                .withEntityDownstreamCount(entityDownstreamCount)
                .withEntityUpstreamCount(entityUpstreamCount))
        .withNodeDepth(nodeDepth);
  }

  /**
   * Batch-fetches entity-level tags from the database for multiple entities and replaces the mixed
   * ES tags with table-level-only tags. Uses a single DB query for all FQNs. Tier tags are excluded
   * since they have their own column in the Impact Analysis table.
   *
   * @param entityDocs list of entity source maps from ES
   */
  public static void replaceWithEntityLevelTagsBatch(List<Map<String, Object>> entityDocs) {
    if (entityDocs == null || entityDocs.isEmpty()) {
      return;
    }
    try {
      List<String> fqns = new ArrayList<>();
      for (Map<String, Object> doc : entityDocs) {
        String fqn = (String) doc.get("fullyQualifiedName");
        if (fqn != null) {
          fqns.add(fqn);
        }
      }
      if (fqns.isEmpty()) {
        return;
      }

      // Single DB query for all entity FQNs
      List<CollectionDAO.TagUsageDAO.TagLabelWithFQNHash> batchResults =
          Entity.getCollectionDAO().tagUsageDAO().getTagsInternalBatch(fqns);

      // Group by FQN hash and convert to TagLabel, filtering out Tier
      Map<String, List<TagLabel>> tagsByFqnHash = new HashMap<>();
      List<TagLabel> allTags = new ArrayList<>();
      for (CollectionDAO.TagUsageDAO.TagLabelWithFQNHash result : batchResults) {
        TagLabel tag = result.toTagLabel();
        if (tag.getTagFQN() != null && !tag.getTagFQN().startsWith("Tier.")) {
          allTags.add(tag);
          tagsByFqnHash.computeIfAbsent(result.getTargetFQNHash(), k -> new ArrayList<>()).add(tag);
        }
      }

      // Batch-enrich all tags with name, displayName, description, style
      TagLabelUtil.applyTagCommonFieldsBatch(allTags);

      // Replace tags in each entity doc
      for (Map<String, Object> doc : entityDocs) {
        String fqn = (String) doc.get("fullyQualifiedName");
        if (fqn != null) {
          String fqnHash = FullyQualifiedName.buildHash(fqn);
          List<TagLabel> entityTags = tagsByFqnHash.getOrDefault(fqnHash, new ArrayList<>());
          doc.put("tags", entityTags);
        }
      }
    } catch (Exception e) {
      LOG.warn("Failed to fetch entity-level tags for Impact Analysis, falling back to ES tags", e);
    }
  }
}
