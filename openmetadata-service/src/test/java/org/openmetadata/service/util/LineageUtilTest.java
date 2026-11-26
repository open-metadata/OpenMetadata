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
import java.util.Set;
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
    when(searchRepository.getWriteIndexName(any(IndexMapping.class)))
        .thenAnswer(
            invocation -> invocation.getArgument(0, IndexMapping.class).getIndexName("cluster"));

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
    when(searchRepository.getWriteIndexName(any(IndexMapping.class)))
        .thenAnswer(
            invocation -> invocation.getArgument(0, IndexMapping.class).getIndexName("cluster"));

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
  void dataProductPairsPairsEachProductWithItsNeighboursProducts() {
    UUID entityId = UUID.randomUUID();
    UUID moved = UUID.randomUUID();
    EntityReference downstream = entityRef(Entity.DATA_PRODUCT, UUID.randomUUID(), "dp.down");
    EntityReference upstream = entityRef(Entity.DATA_PRODUCT, UUID.randomUUID(), "dp.up");
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    when(relationshipDAO.findDownstreamDataProducts(entityId, Entity.TABLE))
        .thenReturn(List.of(relationshipObject(downstream)));
    when(relationshipDAO.findUpstreamDataProducts(entityId, Entity.TABLE))
        .thenReturn(List.of(relationshipObject(upstream)));

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);

      assertEquals(
          Set.of(Pair.of(moved, downstream.getId()), Pair.of(upstream.getId(), moved)),
          LineageUtil.dataProductPairs(entityId, Entity.TABLE, List.of(moved)));
      assertTrue(LineageUtil.dataProductPairs(entityId, Entity.TABLE, List.of()).isEmpty());
    }
  }

  @Test
  void recountWritesNoEdgeWhenNoAssetEdgeConnectsTheProducts() {
    DataProductPair pair = new DataProductPair(0, null);

    try (MockedStatic<Entity> mockedEntity = pair.mockEntity()) {
      LineageUtil.recountDataProductsLineage(Set.of(pair.ids()));

      verify(pair.relationshipDAO, never())
          .insert(any(), any(), any(), any(), any(Integer.class), any(String.class));
      verifyNoInteractions(pair.searchClient);
    }
  }

  @Test
  void recountDeletesTheRollupWhenNoAssetEdgeIsLeft() {
    DataProductPair pair =
        new DataProductPair(
            0,
            new LineageDetails().withSource(LineageDetails.Source.CHILD_ASSETS).withAssetEdges(1));

    try (MockedStatic<Entity> mockedEntity = pair.mockEntity()) {
      LineageUtil.recountDataProductsLineage(Set.of(pair.ids()));

      verify(pair.relationshipDAO)
          .delete(
              pair.from.getId(),
              Entity.DATA_PRODUCT,
              pair.to.getId(),
              Entity.DATA_PRODUCT,
              Relationship.UPSTREAM.ordinal());
      ArgumentCaptor<Pair<String, String>> fieldCaptor = ArgumentCaptor.forClass(Pair.class);
      verify(pair.searchClient)
          .updateChildren(eq(SearchClient.GLOBAL_SEARCH_ALIAS), fieldCaptor.capture(), any());
      assertEquals(pair.from.getId() + "--->" + pair.to.getId(), fieldCaptor.getValue().getRight());
    }
  }

  @Test
  void recountKeepsADrawnEdgeAndOnlyClearsItsCount() {
    DataProductPair pair =
        new DataProductPair(
            0,
            new LineageDetails()
                .withSource(LineageDetails.Source.MANUAL)
                .withDescription("drawn")
                .withCreatedAt(7L)
                .withAssetEdges(1));

    try (MockedStatic<Entity> mockedEntity = pair.mockEntity()) {
      LineageUtil.recountDataProductsLineage(Set.of(pair.ids()));

      LineageDetails written = pair.writtenDetails();
      assertNull(written.getAssetEdges());
      assertEquals(LineageDetails.Source.MANUAL, written.getSource());
      assertEquals("drawn", written.getDescription());
      assertEquals(7L, written.getCreatedAt());
      verify(pair.relationshipDAO, never())
          .delete(any(UUID.class), any(), any(UUID.class), any(), any(Integer.class));
    }
  }

  @Test
  void recountCountsAssetEdgesOnARollupAndKeepsItsCreation() {
    DataProductPair pair =
        new DataProductPair(
            3,
            new LineageDetails()
                .withSource(LineageDetails.Source.CHILD_ASSETS)
                .withCreatedAt(7L)
                .withAssetEdges(1));

    try (MockedStatic<Entity> mockedEntity = pair.mockEntity()) {
      LineageUtil.recountDataProductsLineage(Set.of(pair.ids()));

      LineageDetails written = pair.writtenDetails();
      assertEquals(3, written.getAssetEdges());
      assertEquals(7L, written.getCreatedAt());
    }
  }

  @Test
  void recountLeavesAnEdgeWithTheRightCountAsItIs() {
    DataProductPair pair =
        new DataProductPair(
            2,
            new LineageDetails().withSource(LineageDetails.Source.CHILD_ASSETS).withAssetEdges(2));

    try (MockedStatic<Entity> mockedEntity = pair.mockEntity()) {
      LineageUtil.recountDataProductsLineage(Set.of(pair.ids()));

      verify(pair.relationshipDAO, never())
          .insert(any(), any(), any(), any(), any(Integer.class), any(String.class));
      verify(pair.relationshipDAO, never())
          .delete(any(UUID.class), any(), any(UUID.class), any(), any(Integer.class));
      verifyNoInteractions(pair.searchClient);
    }
  }

  @Test
  void recountSkipsAPairOfOneProduct() {
    UUID id = UUID.randomUUID();

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      LineageUtil.recountDataProductsLineage(Set.of(Pair.of(id, id)));

      mockedEntity.verifyNoInteractions();
    }
  }

  @Test
  void adjustSubtractsFromARollupAndKeepsItsCreation() {
    DataProductPair pair = new DataProductPair(0, rollup(3).withCreatedAt(7L));

    try (MockedStatic<Entity> mockedEntity = pair.mockEntity()) {
      pair.adjust(-1);

      LineageDetails written = pair.writtenDetails();
      assertEquals(2, written.getAssetEdges());
      assertEquals(7L, written.getCreatedAt());
      verify(pair.relationshipDAO, never()).countDataProductsChildAssets(any(), any());
    }
  }

  @Test
  void adjustDeletesTheRollupWhenItsLastAssetEdgeGoes() {
    DataProductPair pair = new DataProductPair(0, rollup(1));

    try (MockedStatic<Entity> mockedEntity = pair.mockEntity()) {
      pair.adjust(-1);

      verify(pair.relationshipDAO)
          .delete(
              pair.from.getId(),
              Entity.DATA_PRODUCT,
              pair.to.getId(),
              Entity.DATA_PRODUCT,
              Relationship.UPSTREAM.ordinal());
    }
  }

  @Test
  void adjustKeepsADrawnEdgeWhenItsLastAssetEdgeGoes() {
    DataProductPair pair = new DataProductPair(0, drawn().withAssetEdges(1));

    try (MockedStatic<Entity> mockedEntity = pair.mockEntity()) {
      pair.adjust(-1);

      LineageDetails written = pair.writtenDetails();
      assertNull(written.getAssetEdges());
      assertEquals("drawn", written.getDescription());
      verify(pair.relationshipDAO, never())
          .delete(any(UUID.class), any(), any(UUID.class), any(), any(Integer.class));
    }
  }

  @Test
  void adjustCountsAssetEdgesOnADrawnEdge() {
    DataProductPair pair = new DataProductPair(0, drawn());

    try (MockedStatic<Entity> mockedEntity = pair.mockEntity()) {
      pair.adjust(2);

      LineageDetails written = pair.writtenDetails();
      assertEquals(2, written.getAssetEdges());
      assertEquals(LineageDetails.Source.MANUAL, written.getSource());
    }
  }

  @Test
  void adjustWritesARollupForAPairWithNoEdge() {
    DataProductPair pair = new DataProductPair(0, null);

    try (MockedStatic<Entity> mockedEntity = pair.mockEntity()) {
      pair.adjust(1);

      LineageDetails written = pair.writtenDetails();
      assertEquals(LineageDetails.Source.CHILD_ASSETS, written.getSource());
      assertEquals(1, written.getAssetEdges());
    }
  }

  @Test
  void adjustWritesNothingWhenItRemovesFromAPairWithNoEdge() {
    DataProductPair pair = new DataProductPair(0, null);

    try (MockedStatic<Entity> mockedEntity = pair.mockEntity()) {
      pair.adjust(-1);

      verify(pair.relationshipDAO, never())
          .insert(any(), any(), any(), any(), any(Integer.class), any(String.class));
      verify(pair.relationshipDAO, never())
          .delete(any(UUID.class), any(), any(UUID.class), any(), any(Integer.class));
    }
  }

  @Test
  void adjustSkipsAPairOfOneProductAndAZeroDelta() {
    UUID id = UUID.randomUUID();

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      LineageUtil.adjustDataProductLineage(id, id, 1);
      LineageUtil.adjustDataProductLineage(id, UUID.randomUUID(), 0);

      mockedEntity.verifyNoInteractions();
    }
  }

  @Test
  void adjustDataProductsLineageAddsTheEntitysOwnEdgesPerNeighbourProduct() {
    UUID entityId = UUID.randomUUID();
    EntityReference gained = entityRef(Entity.DATA_PRODUCT, UUID.randomUUID(), "dp.gained");
    EntityReference downstream = entityRef(Entity.DATA_PRODUCT, UUID.randomUUID(), "dp.down");
    EntityReference upstream = entityRef(Entity.DATA_PRODUCT, UUID.randomUUID(), "dp.up");
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    SearchRepository searchRepository = mock(SearchRepository.class);
    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    when(searchRepository.getSearchClient()).thenReturn(mock(SearchClient.class));
    when(searchRepository.getIndexMapping(Entity.DATA_PRODUCT))
        .thenReturn(IndexMapping.builder().indexName("data_product_search").build());
    when(relationshipDAO.findDownstreamDataProducts(entityId, Entity.TABLE))
        .thenReturn(List.of(relationshipObject(downstream), relationshipObject(downstream)));
    when(relationshipDAO.findUpstreamDataProducts(entityId, Entity.TABLE))
        .thenReturn(List.of(relationshipObject(upstream)));

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      mockedEntity.when(Entity::getSearchRepository).thenReturn(searchRepository);
      for (EntityReference ref : List.of(gained, downstream, upstream)) {
        mockedEntity
            .when(
                () -> Entity.getEntityReferenceById(Entity.DATA_PRODUCT, ref.getId(), Include.ALL))
            .thenReturn(ref);
      }

      LineageUtil.adjustDataProductsLineage(
          entityId, Entity.TABLE, List.of(gained.getId()), List.of());

      assertEquals(2, written(relationshipDAO, gained, downstream).getAssetEdges());
      assertEquals(1, written(relationshipDAO, upstream, gained).getAssetEdges());
      verify(relationshipDAO, never()).countDataProductsChildAssets(any(), any());
    }
  }

  private static LineageDetails written(
      CollectionDAO.EntityRelationshipDAO relationshipDAO,
      EntityReference from,
      EntityReference to) {
    ArgumentCaptor<String> json = ArgumentCaptor.forClass(String.class);
    verify(relationshipDAO)
        .insert(
            eq(from.getId()),
            eq(to.getId()),
            eq(Entity.DATA_PRODUCT),
            eq(Entity.DATA_PRODUCT),
            eq(Relationship.UPSTREAM.ordinal()),
            json.capture());
    return JsonUtils.readValue(json.getValue(), LineageDetails.class);
  }

  private static LineageDetails rollup(int assetEdges) {
    return new LineageDetails()
        .withSource(LineageDetails.Source.CHILD_ASSETS)
        .withAssetEdges(assetEdges);
  }

  private static LineageDetails drawn() {
    return new LineageDetails().withSource(LineageDetails.Source.MANUAL).withDescription("drawn");
  }

  /** Two data products with a stored edge between them, or none, and the asset edges they count. */
  private static final class DataProductPair {
    private final EntityReference from =
        entityRef(Entity.DATA_PRODUCT, UUID.randomUUID(), "dp.from");
    private final EntityReference to = entityRef(Entity.DATA_PRODUCT, UUID.randomUUID(), "dp.to");
    private final CollectionDAO collectionDAO = mock(CollectionDAO.class);
    private final CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    private final SearchRepository searchRepository = mock(SearchRepository.class);
    private final SearchClient searchClient = mock(SearchClient.class);

    private DataProductPair(int assetEdges, LineageDetails stored) {
      when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
      when(relationshipDAO.countDataProductsChildAssets(from.getId(), to.getId()))
          .thenReturn(assetEdges);
      when(relationshipDAO.getRecord(from.getId(), to.getId(), Relationship.UPSTREAM.ordinal()))
          .thenReturn(
              stored == null
                  ? null
                  : CollectionDAO.EntityRelationshipObject.builder()
                      .json(JsonUtils.pojoToJson(stored))
                      .build());
      when(searchRepository.getSearchClient()).thenReturn(searchClient);
      when(searchRepository.getIndexMapping(Entity.DATA_PRODUCT))
          .thenReturn(IndexMapping.builder().indexName("data_product_search").build());
      when(searchRepository.getClusterAlias()).thenReturn("cluster");
      when(searchRepository.getWriteIndexName(any(IndexMapping.class)))
          .thenAnswer(
              invocation -> invocation.getArgument(0, IndexMapping.class).getIndexName("cluster"));
    }

    private void adjust(int delta) {
      LineageUtil.adjustDataProductLineage(from.getId(), to.getId(), delta);
    }

    private Pair<UUID, UUID> ids() {
      return Pair.of(from.getId(), to.getId());
    }

    private MockedStatic<Entity> mockEntity() {
      MockedStatic<Entity> mockedEntity = mockStatic(Entity.class);
      mockedEntity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      mockedEntity.when(Entity::getSearchRepository).thenReturn(searchRepository);
      for (EntityReference ref : List.of(from, to)) {
        mockedEntity
            .when(
                () -> Entity.getEntityReferenceById(Entity.DATA_PRODUCT, ref.getId(), Include.ALL))
            .thenReturn(ref);
      }
      return mockedEntity;
    }

    private LineageDetails writtenDetails() {
      ArgumentCaptor<String> json = ArgumentCaptor.forClass(String.class);
      verify(relationshipDAO)
          .insert(
              eq(from.getId()),
              eq(to.getId()),
              eq(Entity.DATA_PRODUCT),
              eq(Entity.DATA_PRODUCT),
              eq(Relationship.UPSTREAM.ordinal()),
              json.capture());
      return JsonUtils.readValue(json.getValue(), LineageDetails.class);
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

  @Test
  void removeDomainLineageDeletesDomainEdgeThatCarriesNoAssetEdgesCount() {
    UUID entityId = UUID.randomUUID();
    EntityReference updatedDomain = entityRef(Entity.DOMAIN, UUID.randomUUID(), "domain.updated");
    EntityReference downstreamDomain =
        entityRef(Entity.DOMAIN, UUID.randomUUID(), "domain.downstream");
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    SearchRepository searchRepository = mock(SearchRepository.class);
    SearchClient searchClient = mock(SearchClient.class);

    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    when(relationshipDAO.findDownstreamDomains(entityId, Entity.TABLE))
        .thenReturn(List.of(relationshipObject(downstreamDomain)));
    when(relationshipDAO.getRecord(
            updatedDomain.getId(), downstreamDomain.getId(), Relationship.UPSTREAM.ordinal()))
        .thenReturn(
            CollectionDAO.EntityRelationshipObject.builder()
                .json(JsonUtils.pojoToJson(new LineageDetails()))
                .build());
    when(searchRepository.getSearchClient()).thenReturn(searchClient);

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

      verify(relationshipDAO)
          .delete(
              updatedDomain.getId(),
              Entity.DOMAIN,
              downstreamDomain.getId(),
              Entity.DOMAIN,
              Relationship.UPSTREAM.ordinal());
    }
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
