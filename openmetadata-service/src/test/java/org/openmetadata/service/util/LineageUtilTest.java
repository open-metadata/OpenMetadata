package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.commons.lang3.tuple.Pair;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LayerPaging;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.lineage.NodeInformation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;

class LineageUtilTest {

  @Test
  void addDomainLineageCreatesSearchableRelationshipsForUpstreamAndDownstreamDomains() {
    UUID entityId = UUID.randomUUID();
    EntityReference updatedDomain = entityRef(Entity.DOMAIN, UUID.randomUUID(), "domain.updated");
    EntityReference downstreamDomain =
        entityRef(Entity.DOMAIN, UUID.randomUUID(), "domain.downstream");
    EntityReference upstreamDomain = entityRef(Entity.DOMAIN, UUID.randomUUID(), "domain.upstream");
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    SearchRepository searchRepository = mock(SearchRepository.class);
    SearchClient searchClient = mock(SearchClient.class);

    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    when(relationshipDAO.findDownstreamDomains(entityId, Entity.TABLE))
        .thenReturn(List.of(relationshipObject(downstreamDomain)));
    when(relationshipDAO.findUpstreamDomains(entityId, Entity.TABLE))
        .thenReturn(List.of(relationshipObject(upstreamDomain)));
    when(relationshipDAO.countDomainChildAssets(updatedDomain.getId(), downstreamDomain.getId()))
        .thenReturn(2);
    when(relationshipDAO.countDomainChildAssets(upstreamDomain.getId(), updatedDomain.getId()))
        .thenReturn(1);
    when(searchRepository.getSearchClient()).thenReturn(searchClient);
    when(searchRepository.getIndexMapping(Entity.DOMAIN))
        .thenReturn(IndexMapping.builder().indexName("domain_search").build());
    when(searchRepository.getClusterAlias()).thenReturn("cluster");

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      mockedEntity.when(Entity::getSearchRepository).thenReturn(searchRepository);
      mockedEntity
          .when(
              () ->
                  Entity.getEntityReferenceById(
                      Entity.DOMAIN, downstreamDomain.getId(), Include.ALL))
          .thenReturn(downstreamDomain);
      mockedEntity
          .when(
              () ->
                  Entity.getEntityReferenceById(Entity.DOMAIN, upstreamDomain.getId(), Include.ALL))
          .thenReturn(upstreamDomain);

      LineageUtil.addDomainLineage(entityId, Entity.TABLE, updatedDomain);

      verify(relationshipDAO)
          .insert(
              eq(updatedDomain.getId()),
              eq(downstreamDomain.getId()),
              eq(Entity.DOMAIN),
              eq(Entity.DOMAIN),
              eq(Relationship.UPSTREAM.ordinal()),
              any(String.class));
      verify(relationshipDAO)
          .insert(
              eq(upstreamDomain.getId()),
              eq(updatedDomain.getId()),
              eq(Entity.DOMAIN),
              eq(Entity.DOMAIN),
              eq(Relationship.UPSTREAM.ordinal()),
              any(String.class));

      ArgumentCaptor<EsLineageData> lineageCaptor = ArgumentCaptor.forClass(EsLineageData.class);
      verify(searchClient, org.mockito.Mockito.times(2))
          .updateLineage(eq("cluster_domain_search"), any(), lineageCaptor.capture());
      assertEquals(2, lineageCaptor.getAllValues().get(0).getAssetEdges());
      assertEquals(1, lineageCaptor.getAllValues().get(1).getAssetEdges());
      assertNull(lineageCaptor.getAllValues().get(0).getToEntity());
      assertNull(lineageCaptor.getAllValues().get(1).getToEntity());
    }
  }

  @Test
  void addDataProductsLineageSkipsInsertWhenNoChildAssetsExist() {
    UUID entityId = UUID.randomUUID();
    EntityReference dataProduct = entityRef(Entity.DATA_PRODUCT, UUID.randomUUID(), "dp.updated");
    EntityReference downstreamProduct =
        entityRef(Entity.DATA_PRODUCT, UUID.randomUUID(), "dp.downstream");
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    SearchRepository searchRepository = mock(SearchRepository.class);

    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    when(relationshipDAO.findDownstreamDataProducts(entityId, Entity.TABLE))
        .thenReturn(List.of(relationshipObject(downstreamProduct)));
    when(relationshipDAO.findUpstreamDataProducts(entityId, Entity.TABLE)).thenReturn(List.of());
    when(relationshipDAO.countDataProductsChildAssets(
            dataProduct.getId(), downstreamProduct.getId()))
        .thenReturn(0);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      mockedEntity.when(Entity::getSearchRepository).thenReturn(searchRepository);
      mockedEntity
          .when(
              () ->
                  Entity.getEntityReferenceById(
                      Entity.DATA_PRODUCT, downstreamProduct.getId(), Include.ALL))
          .thenReturn(downstreamProduct);

      LineageUtil.addDataProductsLineage(entityId, Entity.TABLE, List.of(dataProduct));

      verify(relationshipDAO, never())
          .insert(any(), any(), any(), any(), any(Integer.class), any(String.class));
      verifyNoInteractions(searchRepository);
    }
  }

  @Test
  void removeDomainLineageDecrementsAssetEdgesWhenRelationshipStillExists() {
    UUID entityId = UUID.randomUUID();
    EntityReference updatedDomain = entityRef(Entity.DOMAIN, UUID.randomUUID(), "domain.updated");
    EntityReference downstreamDomain =
        entityRef(Entity.DOMAIN, UUID.randomUUID(), "domain.downstream");
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    SearchRepository searchRepository = mock(SearchRepository.class);
    SearchClient searchClient = mock(SearchClient.class);
    LineageDetails lineageDetails =
        new LineageDetails().withAssetEdges(2).withSource(LineageDetails.Source.CHILD_ASSETS);

    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    when(relationshipDAO.findDownstreamDomains(entityId, Entity.TABLE))
        .thenReturn(List.of(relationshipObject(downstreamDomain)));
    when(relationshipDAO.findUpstreamDomains(entityId, Entity.TABLE)).thenReturn(List.of());
    when(relationshipDAO.getRecord(
            updatedDomain.getId(), downstreamDomain.getId(), Relationship.UPSTREAM.ordinal()))
        .thenReturn(
            CollectionDAO.EntityRelationshipObject.builder()
                .json(JsonUtils.pojoToJson(lineageDetails))
                .build());
    when(searchRepository.getSearchClient()).thenReturn(searchClient);
    when(searchRepository.getIndexMapping(Entity.DOMAIN))
        .thenReturn(IndexMapping.builder().indexName("domain_search").build());
    when(searchRepository.getClusterAlias()).thenReturn("cluster");

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      mockedEntity.when(Entity::getSearchRepository).thenReturn(searchRepository);
      mockedEntity
          .when(
              () ->
                  Entity.getEntityReferenceById(
                      Entity.DOMAIN, downstreamDomain.getId(), Include.ALL))
          .thenReturn(downstreamDomain);

      LineageUtil.removeDomainLineage(entityId, Entity.TABLE, updatedDomain);

      ArgumentCaptor<String> jsonCaptor = ArgumentCaptor.forClass(String.class);
      verify(relationshipDAO)
          .insert(
              eq(updatedDomain.getId()),
              eq(downstreamDomain.getId()),
              eq(Entity.DOMAIN),
              eq(Entity.DOMAIN),
              eq(Relationship.UPSTREAM.ordinal()),
              jsonCaptor.capture());
      assertEquals(
          1, JsonUtils.readValue(jsonCaptor.getValue(), LineageDetails.class).getAssetEdges());
      verify(searchClient)
          .updateLineage(eq("cluster_domain_search"), any(), any(EsLineageData.class));
      verify(relationshipDAO, never())
          .delete(
              eq(updatedDomain.getId()),
              eq(Entity.DOMAIN),
              eq(downstreamDomain.getId()),
              eq(Entity.DOMAIN),
              eq(Relationship.UPSTREAM.ordinal()));
    }
  }

  @Test
  void removeDataProductsLineageDeletesRelationshipAndSearchEntryWhenLastEdgeIsRemoved() {
    UUID entityId = UUID.randomUUID();
    EntityReference dataProduct = entityRef(Entity.DATA_PRODUCT, UUID.randomUUID(), "dp.updated");
    EntityReference downstreamProduct =
        entityRef(Entity.DATA_PRODUCT, UUID.randomUUID(), "dp.downstream");
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    SearchRepository searchRepository = mock(SearchRepository.class);
    SearchClient searchClient = mock(SearchClient.class);
    LineageDetails lineageDetails =
        new LineageDetails().withAssetEdges(1).withSource(LineageDetails.Source.CHILD_ASSETS);

    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    when(relationshipDAO.findDownstreamDataProducts(entityId, Entity.TABLE))
        .thenReturn(List.of(relationshipObject(downstreamProduct)));
    when(relationshipDAO.findUpstreamDataProducts(entityId, Entity.TABLE)).thenReturn(List.of());
    when(relationshipDAO.getRecord(
            dataProduct.getId(), downstreamProduct.getId(), Relationship.UPSTREAM.ordinal()))
        .thenReturn(
            CollectionDAO.EntityRelationshipObject.builder()
                .json(JsonUtils.pojoToJson(lineageDetails))
                .build());
    when(searchRepository.getSearchClient()).thenReturn(searchClient);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      mockedEntity.when(Entity::getSearchRepository).thenReturn(searchRepository);
      mockedEntity
          .when(
              () ->
                  Entity.getEntityReferenceById(
                      Entity.DATA_PRODUCT, downstreamProduct.getId(), Include.ALL))
          .thenReturn(downstreamProduct);

      LineageUtil.removeDataProductsLineage(entityId, Entity.TABLE, List.of(dataProduct));

      verify(relationshipDAO)
          .delete(
              eq(dataProduct.getId()),
              eq(Entity.DATA_PRODUCT),
              eq(downstreamProduct.getId()),
              eq(Entity.DATA_PRODUCT),
              eq(Relationship.UPSTREAM.ordinal()));

      ArgumentCaptor<Pair<String, String>> fieldCaptor = ArgumentCaptor.forClass(Pair.class);
      ArgumentCaptor<Pair<String, Map<String, Object>>> updateCaptor =
          ArgumentCaptor.forClass(Pair.class);
      verify(searchClient)
          .updateChildren(
              eq(SearchClient.GLOBAL_SEARCH_ALIAS), fieldCaptor.capture(), updateCaptor.capture());
      assertEquals("upstreamLineage.docUniqueId.keyword", fieldCaptor.getValue().getLeft());
      assertEquals(
          dataProduct.getId() + "--->" + downstreamProduct.getId(),
          fieldCaptor.getValue().getRight());
      assertEquals(SearchClient.REMOVE_LINEAGE_SCRIPT, updateCaptor.getValue().getLeft());
      assertEquals(
          dataProduct.getId() + "--->" + downstreamProduct.getId(),
          updateCaptor.getValue().getRight().get("docUniqueId"));
    }
  }

  @Test
  void removeDomainLineageSkipsMissingRelationshipRecord() {
    UUID entityId = UUID.randomUUID();
    EntityReference updatedDomain = entityRef(Entity.DOMAIN, UUID.randomUUID(), "domain.updated");
    EntityReference downstreamDomain =
        entityRef(Entity.DOMAIN, UUID.randomUUID(), "domain.downstream");
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    SearchRepository searchRepository = mock(SearchRepository.class);

    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    when(relationshipDAO.findDownstreamDomains(entityId, Entity.TABLE))
        .thenReturn(List.of(relationshipObject(downstreamDomain)));
    when(relationshipDAO.findUpstreamDomains(entityId, Entity.TABLE)).thenReturn(List.of());
    when(relationshipDAO.getRecord(
            updatedDomain.getId(), downstreamDomain.getId(), Relationship.UPSTREAM.ordinal()))
        .thenReturn(null);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      mockedEntity.when(Entity::getSearchRepository).thenReturn(searchRepository);
      mockedEntity
          .when(
              () ->
                  Entity.getEntityReferenceById(
                      Entity.DOMAIN, downstreamDomain.getId(), Include.ALL))
          .thenReturn(downstreamDomain);

      LineageUtil.removeDomainLineage(entityId, Entity.TABLE, updatedDomain);

      verify(relationshipDAO, never())
          .insert(any(), any(), any(), any(), any(Integer.class), any(String.class));
      verify(relationshipDAO, never()).delete(any(), any(), any(), any(), any(Integer.class));
      verifyNoInteractions(searchRepository);
    }
  }

  @Test
  void getNodeInformationBuildsPagingAndDepth() {
    NodeInformation nodeInformation =
        LineageUtil.getNodeInformation(Map.of("name", "orders"), 3, 4, 2);

    LayerPaging paging = nodeInformation.getPaging();
    assertEquals("orders", nodeInformation.getEntity().get("name"));
    assertEquals(3, paging.getEntityDownstreamCount());
    assertEquals(4, paging.getEntityUpstreamCount());
    assertEquals(2, nodeInformation.getNodeDepth());
  }

  @Test
  void addDomainLineageIgnoresNullUpdatedDomain() {
    LineageUtil.addDomainLineage(UUID.randomUUID(), Entity.TABLE, null);
  }

  private static EntityReference entityRef(String type, UUID id, String fqn) {
    return new EntityReference()
        .withType(type)
        .withId(id)
        .withName(fqn)
        .withFullyQualifiedName(fqn);
  }

  // ── replaceWithEntityLevelTagsBatch tests ──

  @Test
  void replaceWithEntityLevelTagsBatch_nullList_noOp() {
    LineageUtil.replaceWithEntityLevelTagsBatch(null);
  }

  @Test
  void replaceWithEntityLevelTagsBatch_emptyList_noOp() {
    LineageUtil.replaceWithEntityLevelTagsBatch(new java.util.ArrayList<>());
  }

  @Test
  void replaceWithEntityLevelTagsBatch_docsWithoutFqn_noOp() {
    java.util.List<java.util.Map<String, Object>> docs = new java.util.ArrayList<>();
    docs.add(new java.util.HashMap<>(java.util.Map.of("name", "test")));
    LineageUtil.replaceWithEntityLevelTagsBatch(docs);
    // Should not crash, tags unchanged
  }

  @Test
  void replaceWithEntityLevelTagsBatch_validFqns_replacesTagsFromDB() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.TagUsageDAO tagUsageDAO = mock(CollectionDAO.TagUsageDAO.class);

    String fqn1 = "service.db.schema.table1";
    String fqn1Hash = FullyQualifiedName.buildHash(fqn1);

    CollectionDAO.TagUsageDAO.TagLabelWithFQNHash tagResult =
        new CollectionDAO.TagUsageDAO.TagLabelWithFQNHash();
    tagResult.setTargetFQNHash(fqn1Hash);
    tagResult.setSource(org.openmetadata.schema.type.TagLabel.TagSource.CLASSIFICATION.ordinal());
    tagResult.setTagFQN("PersonalData.Personal");
    tagResult.setLabelType(org.openmetadata.schema.type.TagLabel.LabelType.MANUAL.ordinal());
    tagResult.setState(org.openmetadata.schema.type.TagLabel.State.CONFIRMED.ordinal());

    when(collectionDAO.tagUsageDAO()).thenReturn(tagUsageDAO);
    when(tagUsageDAO.getTagsInternalBatch(any())).thenReturn(java.util.List.of(tagResult));

    java.util.List<java.util.Map<String, Object>> docs = new java.util.ArrayList<>();
    java.util.Map<String, Object> doc1 = new java.util.HashMap<>();
    doc1.put("fullyQualifiedName", fqn1);
    doc1.put("tags", java.util.List.of("old-tag"));
    docs.add(doc1);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);

      try (MockedStatic<org.openmetadata.service.resources.tags.TagLabelUtil> mockedTagUtil =
          mockStatic(org.openmetadata.service.resources.tags.TagLabelUtil.class)) {
        mockedTagUtil
            .when(
                () ->
                    org.openmetadata.service.resources.tags.TagLabelUtil.applyTagCommonFieldsBatch(
                        any()))
            .then(invocation -> null);

        LineageUtil.replaceWithEntityLevelTagsBatch(docs);
      }
    }

    Object tags = doc1.get("tags");
    assertTrue(tags instanceof java.util.List);
    @SuppressWarnings("unchecked")
    java.util.List<org.openmetadata.schema.type.TagLabel> tagList =
        (java.util.List<org.openmetadata.schema.type.TagLabel>) tags;
    assertEquals(1, tagList.size());
    assertEquals("PersonalData.Personal", tagList.get(0).getTagFQN());
  }

  @Test
  void replaceWithEntityLevelTagsBatch_mixedTaggedAndUntagged() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.TagUsageDAO tagUsageDAO = mock(CollectionDAO.TagUsageDAO.class);

    String fqn1 = "service.db.schema.tagged_table";
    String fqn2 = "service.db.schema.untagged_table";
    String fqn1Hash = FullyQualifiedName.buildHash(fqn1);

    CollectionDAO.TagUsageDAO.TagLabelWithFQNHash tagResult =
        new CollectionDAO.TagUsageDAO.TagLabelWithFQNHash();
    tagResult.setTargetFQNHash(fqn1Hash);
    tagResult.setSource(org.openmetadata.schema.type.TagLabel.TagSource.CLASSIFICATION.ordinal());
    tagResult.setTagFQN("PII.Sensitive");
    tagResult.setLabelType(org.openmetadata.schema.type.TagLabel.LabelType.MANUAL.ordinal());
    tagResult.setState(org.openmetadata.schema.type.TagLabel.State.CONFIRMED.ordinal());

    when(collectionDAO.tagUsageDAO()).thenReturn(tagUsageDAO);
    when(tagUsageDAO.getTagsInternalBatch(any())).thenReturn(java.util.List.of(tagResult));

    java.util.List<java.util.Map<String, Object>> docs = new java.util.ArrayList<>();
    java.util.Map<String, Object> doc1 = new java.util.HashMap<>();
    doc1.put("fullyQualifiedName", fqn1);
    docs.add(doc1);
    java.util.Map<String, Object> doc2 = new java.util.HashMap<>();
    doc2.put("fullyQualifiedName", fqn2);
    docs.add(doc2);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);

      try (MockedStatic<org.openmetadata.service.resources.tags.TagLabelUtil> mockedTagUtil =
          mockStatic(org.openmetadata.service.resources.tags.TagLabelUtil.class)) {
        mockedTagUtil
            .when(
                () ->
                    org.openmetadata.service.resources.tags.TagLabelUtil.applyTagCommonFieldsBatch(
                        any()))
            .then(invocation -> null);

        LineageUtil.replaceWithEntityLevelTagsBatch(docs);
      }
    }

    @SuppressWarnings("unchecked")
    java.util.List<org.openmetadata.schema.type.TagLabel> tags1 =
        (java.util.List<org.openmetadata.schema.type.TagLabel>) doc1.get("tags");
    assertEquals(1, tags1.size());
    assertEquals("PII.Sensitive", tags1.get(0).getTagFQN());

    @SuppressWarnings("unchecked")
    java.util.List<org.openmetadata.schema.type.TagLabel> tags2 =
        (java.util.List<org.openmetadata.schema.type.TagLabel>) doc2.get("tags");
    assertTrue(tags2.isEmpty());
  }

  @Test
  void replaceWithEntityLevelTagsBatch_dbThrowsException_tagsUnchanged() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.TagUsageDAO tagUsageDAO = mock(CollectionDAO.TagUsageDAO.class);

    when(collectionDAO.tagUsageDAO()).thenReturn(tagUsageDAO);
    when(tagUsageDAO.getTagsInternalBatch(any())).thenThrow(new RuntimeException("DB error"));

    java.util.List<java.util.Map<String, Object>> docs = new java.util.ArrayList<>();
    java.util.Map<String, Object> doc = new java.util.HashMap<>();
    doc.put("fullyQualifiedName", "service.db.schema.table1");
    doc.put("tags", java.util.List.of("original-tag"));
    docs.add(doc);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);

      LineageUtil.replaceWithEntityLevelTagsBatch(docs);
    }

    assertEquals(java.util.List.of("original-tag"), doc.get("tags"));
  }

  @Test
  void replaceWithEntityLevelTagsBatch_filtersTierTags() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.TagUsageDAO tagUsageDAO = mock(CollectionDAO.TagUsageDAO.class);

    String fqn1 = "service.db.schema.table1";
    String fqn1Hash = FullyQualifiedName.buildHash(fqn1);

    CollectionDAO.TagUsageDAO.TagLabelWithFQNHash tierTag =
        new CollectionDAO.TagUsageDAO.TagLabelWithFQNHash();
    tierTag.setTargetFQNHash(fqn1Hash);
    tierTag.setSource(org.openmetadata.schema.type.TagLabel.TagSource.CLASSIFICATION.ordinal());
    tierTag.setTagFQN("Tier.Tier1");
    tierTag.setLabelType(org.openmetadata.schema.type.TagLabel.LabelType.MANUAL.ordinal());
    tierTag.setState(org.openmetadata.schema.type.TagLabel.State.CONFIRMED.ordinal());

    CollectionDAO.TagUsageDAO.TagLabelWithFQNHash normalTag =
        new CollectionDAO.TagUsageDAO.TagLabelWithFQNHash();
    normalTag.setTargetFQNHash(fqn1Hash);
    normalTag.setSource(org.openmetadata.schema.type.TagLabel.TagSource.CLASSIFICATION.ordinal());
    normalTag.setTagFQN("PII.Sensitive");
    normalTag.setLabelType(org.openmetadata.schema.type.TagLabel.LabelType.MANUAL.ordinal());
    normalTag.setState(org.openmetadata.schema.type.TagLabel.State.CONFIRMED.ordinal());

    when(collectionDAO.tagUsageDAO()).thenReturn(tagUsageDAO);
    when(tagUsageDAO.getTagsInternalBatch(any())).thenReturn(java.util.List.of(tierTag, normalTag));

    java.util.List<java.util.Map<String, Object>> docs = new java.util.ArrayList<>();
    java.util.Map<String, Object> doc = new java.util.HashMap<>();
    doc.put("fullyQualifiedName", fqn1);
    docs.add(doc);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);

      try (MockedStatic<org.openmetadata.service.resources.tags.TagLabelUtil> mockedTagUtil =
          mockStatic(org.openmetadata.service.resources.tags.TagLabelUtil.class)) {
        mockedTagUtil
            .when(
                () ->
                    org.openmetadata.service.resources.tags.TagLabelUtil.applyTagCommonFieldsBatch(
                        any()))
            .then(invocation -> null);

        LineageUtil.replaceWithEntityLevelTagsBatch(docs);
      }
    }

    @SuppressWarnings("unchecked")
    java.util.List<org.openmetadata.schema.type.TagLabel> tags =
        (java.util.List<org.openmetadata.schema.type.TagLabel>) doc.get("tags");
    assertEquals(1, tags.size());
    assertEquals("PII.Sensitive", tags.get(0).getTagFQN());
  }

  private static CollectionDAO.EntityRelationshipObject relationshipObject(EntityReference ref) {
    return CollectionDAO.EntityRelationshipObject.builder()
        .fromId(ref.getId().toString())
        .fromEntity(ref.getType())
        .build();
  }
}
