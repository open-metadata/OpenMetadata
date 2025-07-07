package org.openmetadata.service.util;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.jdbi3.LineageRepository.buildEntityLineageData;
import static org.openmetadata.service.jdbi3.LineageRepository.getDocumentUniqueId;
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;
import static org.openmetadata.service.search.SearchClient.REMOVE_LINEAGE_SCRIPT;

import java.util.List;
import java.util.UUID;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;

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
            new ImmutablePair<>(String.format(REMOVE_LINEAGE_SCRIPT, uniqueValue), null));
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
}
