package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.api.lineage.EntityCountLineageRequest;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.api.lineage.LineageDirection;
import org.openmetadata.schema.api.lineage.LineagePaginationInfo;
import org.openmetadata.schema.api.lineage.RelationshipRef;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.lineage.LineageQueryContext;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.LineageUtil;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.core.SearchRequest;
import os.org.opensearch.client.opensearch.core.SearchResponse;
import os.org.opensearch.client.opensearch.core.search.Hit;
import os.org.opensearch.client.opensearch.core.search.HitsMetadata;

@ExtendWith(MockitoExtension.class)
class OSLineageGraphBuilderTest {
  private static final String NODE_LEVEL_QUERY_FILTER =
      "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"name\":\"lineage-node\"}}]}}}";

  @Mock private OpenSearchClient esClient;
  @Mock private SearchResponse<JsonData> searchResponse;
  @Mock private HitsMetadata<JsonData> hitsMetadata;
  @Mock private SearchRepository searchRepository;

  private static final String ROOT_FQN = "service.database.schema.root_table";
  private static final String UPSTREAM_FQN = "service.database.schema.upstream_table";
  private static final String DOWNSTREAM_FQN = "service.database.schema.downstream_table";

  private void stubOsUtilsGetSearchRequest(MockedStatic<OsUtils> osUtilsMock) {
    SearchRequest mockRequest = SearchRequest.of(b -> b.index("test_index"));
    osUtilsMock
        .when(
            () ->
                OsUtils.getSearchRequest(
                    any(LineageDirection.class),
                    anyString(),
                    any(),
                    any(),
                    any(),
                    anyInt(),
                    anyInt(),
                    any(),
                    any(),
                    any()))
        .thenReturn(mockRequest);
  }

  private void stubOsClientSearch() throws IOException {
    when(esClient.search(any(SearchRequest.class), eq(JsonData.class))).thenReturn(searchResponse);
    when(searchResponse.hits()).thenReturn(hitsMetadata);
  }

  @Test
  void getLineagePaginationInfo_withNodeFilter_callsFilteredDepthCounts() throws IOException {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<OsUtils> osUtilsMock = mockStatic(OsUtils.class)) {

      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      stubOsUtilsGetSearchRequest(osUtilsMock);
      stubOsClientSearch();
      when(hitsMetadata.hits()).thenReturn(List.of());

      OSLineageGraphBuilder builder = new OSLineageGraphBuilder(esClient);

      LineagePaginationInfo result =
          builder.getLineagePaginationInfo(ROOT_FQN, 2, 2, NODE_LEVEL_QUERY_FILTER, false, "table");

      assertNotNull(result);
      assertEquals(1, result.getTotalUpstreamEntities());
      assertEquals(1, result.getTotalDownstreamEntities());
      assertNotNull(result.getUpstreamDepthInfo());
      assertNotNull(result.getDownstreamDepthInfo());
    }
  }

  @SuppressWarnings("unchecked")
  @Test
  void getLineagePaginationInfo_withNodeFilter_returnsFilteredCounts() throws IOException {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<OsUtils> osUtilsMock = mockStatic(OsUtils.class)) {

      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      stubOsUtilsGetSearchRequest(osUtilsMock);

      Hit<JsonData> mockHit = (Hit<JsonData>) Mockito.mock(Hit.class);
      JsonData mockJsonData = Mockito.mock(JsonData.class);
      when(mockHit.source()).thenReturn(mockJsonData);

      Map<String, Object> upstreamDoc = new HashMap<>();
      upstreamDoc.put("fullyQualifiedName", UPSTREAM_FQN);
      upstreamDoc.put("entityType", "table");

      osUtilsMock.when(() -> OsUtils.jsonDataToMap(any(JsonData.class))).thenReturn(upstreamDoc);

      stubOsClientSearch();
      when(hitsMetadata.hits()).thenReturn(List.of(mockHit), List.of());

      Map<String, Object> matchingResult = new HashMap<>();
      matchingResult.put(UPSTREAM_FQN, upstreamDoc);

      osUtilsMock
          .when(
              () ->
                  OsUtils.searchEntitiesByKey(
                      any(OpenSearchClient.class),
                      any(),
                      anyString(),
                      anyString(),
                      anySet(),
                      anyInt(),
                      anyInt(),
                      anyList(),
                      anyString()))
          .thenReturn(matchingResult);

      OSLineageGraphBuilder builder = new OSLineageGraphBuilder(esClient);
      LineagePaginationInfo result =
          builder.getLineagePaginationInfo(ROOT_FQN, 1, 0, NODE_LEVEL_QUERY_FILTER, false, "table");

      assertNotNull(result);
      assertTrue(result.getTotalUpstreamEntities() >= 1);
      assertNotNull(result.getUpstreamDepthInfo());
      assertFalse(result.getUpstreamDepthInfo().isEmpty());
    }
  }

  @SuppressWarnings("unchecked")
  @Test
  void searchLineageByEntityCount_withQueryFilter_exercisesFilteredPath() throws IOException {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<OsUtils> osUtilsMock = mockStatic(OsUtils.class);
        MockedStatic<LineageUtil> lineageUtilMock =
            mockStatic(LineageUtil.class, Mockito.CALLS_REAL_METHODS)) {

      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      stubOsUtilsGetSearchRequest(osUtilsMock);

      Map<String, Object> rootDoc = new HashMap<>();
      rootDoc.put("id", java.util.UUID.randomUUID().toString());
      rootDoc.put("fullyQualifiedName", ROOT_FQN);
      rootDoc.put("entityType", "table");

      osUtilsMock
          .when(
              () ->
                  OsUtils.searchEntityByKey(
                      any(OpenSearchClient.class),
                      any(),
                      anyString(),
                      anyString(),
                      any(),
                      anyList()))
          .thenReturn(rootDoc);

      Hit<JsonData> mockHit = (Hit<JsonData>) Mockito.mock(Hit.class);
      JsonData mockJsonData = Mockito.mock(JsonData.class);
      when(mockHit.source()).thenReturn(mockJsonData);

      Map<String, Object> downstreamDoc = new HashMap<>();
      downstreamDoc.put("fullyQualifiedName", DOWNSTREAM_FQN);
      downstreamDoc.put("entityType", "table");
      downstreamDoc.put("id", java.util.UUID.randomUUID().toString());

      osUtilsMock.when(() -> OsUtils.jsonDataToMap(any(JsonData.class))).thenReturn(downstreamDoc);

      stubOsClientSearch();
      when(hitsMetadata.hits()).thenReturn(List.of(mockHit), List.of());

      Map<String, Object> matchingDocs = new HashMap<>();
      matchingDocs.put(DOWNSTREAM_FQN, downstreamDoc);

      osUtilsMock
          .when(
              () ->
                  OsUtils.searchEntitiesByKey(
                      any(OpenSearchClient.class),
                      any(),
                      anyString(),
                      anyString(),
                      anySet(),
                      anyInt(),
                      anyInt(),
                      anyList(),
                      anyString()))
          .thenReturn(matchingDocs);

      lineageUtilMock
          .when(() -> LineageUtil.replaceWithEntityLevelTagsBatch(anyList()))
          .then(invocation -> null);

      OSLineageGraphBuilder builder = new OSLineageGraphBuilder(esClient);

      EntityCountLineageRequest request =
          new EntityCountLineageRequest()
              .withFqn(ROOT_FQN)
              .withDirection(LineageDirection.DOWNSTREAM)
              .withMaxDepth(2)
              .withQueryFilter(NODE_LEVEL_QUERY_FILTER)
              .withIncludeDeleted(false)
              .withFrom(0)
              .withSize(50)
              .withIncludeSourceFields(Set.of())
              .withIsConnectedVia(false);

      SearchLineageResult result = builder.searchLineageByEntityCount(request);

      assertNotNull(result);
      assertNotNull(result.getNodes());
    }
  }

  @SuppressWarnings("unchecked")
  @Test
  void searchLineageByEntityCount_withQueryFilter_upstreamNegatesDepth() throws IOException {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<OsUtils> osUtilsMock = mockStatic(OsUtils.class);
        MockedStatic<LineageUtil> lineageUtilMock =
            mockStatic(LineageUtil.class, Mockito.CALLS_REAL_METHODS)) {

      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      stubOsUtilsGetSearchRequest(osUtilsMock);

      Map<String, Object> rootDoc = new HashMap<>();
      rootDoc.put("id", java.util.UUID.randomUUID().toString());
      rootDoc.put("fullyQualifiedName", ROOT_FQN);
      rootDoc.put("entityType", "table");

      osUtilsMock
          .when(
              () ->
                  OsUtils.searchEntityByKey(
                      any(OpenSearchClient.class),
                      any(),
                      anyString(),
                      anyString(),
                      any(),
                      anyList()))
          .thenReturn(rootDoc);

      Hit<JsonData> mockHit = (Hit<JsonData>) Mockito.mock(Hit.class);
      JsonData mockJsonData = Mockito.mock(JsonData.class);
      when(mockHit.source()).thenReturn(mockJsonData);

      Map<String, Object> upstreamDoc = new HashMap<>();
      upstreamDoc.put("id", java.util.UUID.randomUUID().toString());
      upstreamDoc.put("fullyQualifiedName", UPSTREAM_FQN);
      upstreamDoc.put("entityType", "table");

      osUtilsMock.when(() -> OsUtils.jsonDataToMap(any(JsonData.class))).thenReturn(upstreamDoc);

      stubOsClientSearch();
      when(hitsMetadata.hits()).thenReturn(List.of(mockHit), List.of());

      Map<String, Object> matchingDocs = new HashMap<>();
      matchingDocs.put(UPSTREAM_FQN, upstreamDoc);

      osUtilsMock
          .when(
              () ->
                  OsUtils.searchEntitiesByKey(
                      any(OpenSearchClient.class),
                      any(),
                      anyString(),
                      anyString(),
                      anySet(),
                      anyInt(),
                      anyInt(),
                      anyList(),
                      anyString()))
          .thenReturn(matchingDocs);

      lineageUtilMock
          .when(() -> LineageUtil.replaceWithEntityLevelTagsBatch(anyList()))
          .then(invocation -> null);

      OSLineageGraphBuilder builder = new OSLineageGraphBuilder(esClient);

      EntityCountLineageRequest request =
          new EntityCountLineageRequest()
              .withFqn(ROOT_FQN)
              .withDirection(LineageDirection.UPSTREAM)
              .withMaxDepth(2)
              .withQueryFilter(NODE_LEVEL_QUERY_FILTER)
              .withIncludeDeleted(false)
              .withFrom(0)
              .withSize(50)
              .withIncludeSourceFields(Set.of())
              .withIsConnectedVia(false);

      SearchLineageResult result = builder.searchLineageByEntityCount(request);

      assertNotNull(result);
      assertNotNull(result.getNodes());
    }
  }

  @SuppressWarnings("unchecked")
  @Test
  void executeInMemory_withDirectionalRequestOnlyReturnsRequestedDirection() throws IOException {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<OsUtils> osUtilsMock = mockStatic(OsUtils.class)) {
      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      stubOsUtilsGetSearchRequest(osUtilsMock);

      Map<String, Object> rootDoc =
          entityDoc(ROOT_FQN, List.of(lineageEdge(UPSTREAM_FQN, ROOT_FQN)));
      Map<String, Object> upstreamDoc = entityDoc(UPSTREAM_FQN, List.of());

      osUtilsMock
          .when(
              () ->
                  OsUtils.searchEntityByKey(
                      any(OpenSearchClient.class),
                      any(),
                      anyString(),
                      anyString(),
                      any(),
                      anyList()))
          .thenReturn(rootDoc);

      JsonData rootJson = Mockito.mock(JsonData.class);
      JsonData upstreamJson = Mockito.mock(JsonData.class);

      Hit<JsonData> rootHit = (Hit<JsonData>) Mockito.mock(Hit.class);
      Hit<JsonData> upstreamHit = (Hit<JsonData>) Mockito.mock(Hit.class);

      when(rootHit.source()).thenReturn(rootJson);
      when(upstreamHit.source()).thenReturn(upstreamJson);

      SearchResponse<JsonData> rootTraversalResponse = Mockito.mock(SearchResponse.class);
      SearchResponse<JsonData> upstreamTraversalResponse = Mockito.mock(SearchResponse.class);
      HitsMetadata<JsonData> rootTraversalHits = Mockito.mock(HitsMetadata.class);
      HitsMetadata<JsonData> upstreamTraversalHits = Mockito.mock(HitsMetadata.class);

      when(rootTraversalResponse.hits()).thenReturn(rootTraversalHits);
      when(upstreamTraversalResponse.hits()).thenReturn(upstreamTraversalHits);
      when(rootTraversalHits.hits()).thenReturn(List.of(rootHit));
      when(upstreamTraversalHits.hits()).thenReturn(List.of(upstreamHit));

      when(esClient.search(any(SearchRequest.class), eq(JsonData.class)))
          .thenReturn(rootTraversalResponse, upstreamTraversalResponse);

      osUtilsMock
          .when(() -> OsUtils.jsonDataToMap(any(JsonData.class)))
          .thenAnswer(
              invocation -> {
                JsonData jsonData = invocation.getArgument(0);
                if (jsonData == rootJson) {
                  return rootDoc;
                }
                if (jsonData == upstreamJson) {
                  return upstreamDoc;
                }

                return Map.of();
              });

      OSLineageGraphBuilder builder = new OSLineageGraphBuilder(esClient);
      SearchLineageResult result =
          builder.executeInMemory(
              LineageQueryContext.builder()
                  .request(
                      new org.openmetadata.schema.api.lineage.SearchLineageRequest()
                          .withFqn(ROOT_FQN)
                          .withDirection(LineageDirection.UPSTREAM)
                          .withUpstreamDepth(1)
                          .withDownstreamDepth(1)
                          .withIncludeDeleted(false)
                          .withIncludeSourceFields(Set.of())
                          .withIsConnectedVia(false))
                  .estimatedNodeCount(2)
                  .build(),
              1000);

      assertTrue(result.getNodes().containsKey(ROOT_FQN));
      assertTrue(result.getNodes().containsKey(UPSTREAM_FQN));
      assertFalse(result.getNodes().containsKey(DOWNSTREAM_FQN));
      assertTrue(result.getUpstreamEdges().containsKey(UPSTREAM_FQN + "->" + ROOT_FQN));
      assertTrue(result.getDownstreamEdges().isEmpty());
      verify(esClient, times(2)).search(any(SearchRequest.class), eq(JsonData.class));
    }
  }

  private Map<String, Object> entityDoc(String fqn, List<EsLineageData> upstreamLineage) {
    Map<String, Object> entityDoc = new HashMap<>();
    entityDoc.put("id", java.util.UUID.randomUUID().toString());
    entityDoc.put("fullyQualifiedName", fqn);
    entityDoc.put("entityType", "table");
    entityDoc.put("upstreamLineage", upstreamLineage);

    return entityDoc;
  }

  private EsLineageData lineageEdge(String fromFqn, String toFqn) {
    return new EsLineageData()
        .withDocId(fromFqn + "->" + toFqn)
        .withFromEntity(
            new RelationshipRef()
                .withFullyQualifiedName(fromFqn)
                .withFqnHash(FullyQualifiedName.buildHash(fromFqn))
                .withType("table"))
        .withToEntity(
            new RelationshipRef()
                .withFullyQualifiedName(toFqn)
                .withFqnHash(FullyQualifiedName.buildHash(toFqn))
                .withType("table"));
  }

  @Test
  void getLineagePaginationInfo_withNodeFilter_emptyEntities_returnsEmptyDepthCounts()
      throws IOException {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<OsUtils> osUtilsMock = mockStatic(OsUtils.class)) {

      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      stubOsUtilsGetSearchRequest(osUtilsMock);
      stubOsClientSearch();
      when(hitsMetadata.hits()).thenReturn(List.of());

      OSLineageGraphBuilder builder = new OSLineageGraphBuilder(esClient);

      LineagePaginationInfo result =
          builder.getLineagePaginationInfo(ROOT_FQN, 1, 1, NODE_LEVEL_QUERY_FILTER, false, "table");

      assertNotNull(result);
      assertEquals(1, result.getTotalUpstreamEntities());
      assertEquals(1, result.getTotalDownstreamEntities());
    }
  }

  @Test
  void searchLineageByEntityCount_withNodeDepthZero_returnsRootOnly() throws IOException {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<OsUtils> osUtilsMock = mockStatic(OsUtils.class)) {

      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);

      Map<String, Object> rootDoc = new HashMap<>();
      rootDoc.put("id", java.util.UUID.randomUUID().toString());
      rootDoc.put("fullyQualifiedName", ROOT_FQN);
      rootDoc.put("entityType", "table");

      osUtilsMock
          .when(
              () ->
                  OsUtils.searchEntityByKey(
                      any(OpenSearchClient.class),
                      any(),
                      anyString(),
                      anyString(),
                      any(),
                      anyList()))
          .thenReturn(rootDoc);

      OSLineageGraphBuilder builder = new OSLineageGraphBuilder(esClient);

      EntityCountLineageRequest request =
          new EntityCountLineageRequest()
              .withFqn(ROOT_FQN)
              .withDirection(LineageDirection.DOWNSTREAM)
              .withMaxDepth(2)
              .withNodeDepth(0)
              .withIncludeDeleted(false)
              .withFrom(0)
              .withSize(50)
              .withIncludeSourceFields(Set.of())
              .withIsConnectedVia(false);

      SearchLineageResult result = builder.searchLineageByEntityCount(request);

      assertNotNull(result);
      assertTrue(result.getNodes().containsKey(ROOT_FQN));
    }
  }

  @SuppressWarnings("unchecked")
  @Test
  void searchLineageByEntityCount_withQueryFilter_emptyMatchingDocs() throws IOException {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<OsUtils> osUtilsMock = mockStatic(OsUtils.class);
        MockedStatic<LineageUtil> lineageUtilMock =
            mockStatic(LineageUtil.class, Mockito.CALLS_REAL_METHODS)) {

      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      stubOsUtilsGetSearchRequest(osUtilsMock);

      Map<String, Object> rootDoc = new HashMap<>();
      rootDoc.put("fullyQualifiedName", ROOT_FQN);
      rootDoc.put("entityType", "table");

      osUtilsMock
          .when(
              () ->
                  OsUtils.searchEntityByKey(
                      any(OpenSearchClient.class),
                      any(),
                      anyString(),
                      anyString(),
                      any(),
                      anyList()))
          .thenReturn(rootDoc);

      Hit<JsonData> mockHit = (Hit<JsonData>) Mockito.mock(Hit.class);
      JsonData mockJsonData = Mockito.mock(JsonData.class);
      when(mockHit.source()).thenReturn(mockJsonData);

      Map<String, Object> entityDoc = new HashMap<>();
      entityDoc.put("fullyQualifiedName", DOWNSTREAM_FQN);
      entityDoc.put("entityType", "table");

      osUtilsMock.when(() -> OsUtils.jsonDataToMap(any(JsonData.class))).thenReturn(entityDoc);

      stubOsClientSearch();
      when(hitsMetadata.hits()).thenReturn(List.of(mockHit), List.of());

      osUtilsMock
          .when(
              () ->
                  OsUtils.searchEntitiesByKey(
                      any(OpenSearchClient.class),
                      any(),
                      anyString(),
                      anyString(),
                      anySet(),
                      anyInt(),
                      anyInt(),
                      anyList(),
                      anyString()))
          .thenReturn(new HashMap<>());

      lineageUtilMock
          .when(() -> LineageUtil.replaceWithEntityLevelTagsBatch(anyList()))
          .then(invocation -> null);

      OSLineageGraphBuilder builder = new OSLineageGraphBuilder(esClient);

      EntityCountLineageRequest request =
          new EntityCountLineageRequest()
              .withFqn(ROOT_FQN)
              .withDirection(LineageDirection.DOWNSTREAM)
              .withMaxDepth(1)
              .withQueryFilter(NODE_LEVEL_QUERY_FILTER)
              .withIncludeDeleted(false)
              .withFrom(0)
              .withSize(50)
              .withIncludeSourceFields(Set.of())
              .withIsConnectedVia(false);

      SearchLineageResult result = builder.searchLineageByEntityCount(request);

      assertNotNull(result);
      assertNotNull(result.getNodes());
    }
  }

  @Test
  void getLineagePaginationInfo_withNodeFilter_zeroDepths_skipsFilteredCounts() throws IOException {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);

      OSLineageGraphBuilder builder = new OSLineageGraphBuilder(esClient);

      LineagePaginationInfo result =
          builder.getLineagePaginationInfo(ROOT_FQN, 0, 0, NODE_LEVEL_QUERY_FILTER, false, "table");

      assertNotNull(result);
      assertEquals(1, result.getTotalUpstreamEntities());
      assertEquals(1, result.getTotalDownstreamEntities());
      assertEquals(0, result.getMaxUpstreamDepth());
      assertEquals(0, result.getMaxDownstreamDepth());
    }
  }

  @Test
  void getLineagePaginationInfo_noQueryFilter_callsDepthWiseEntityCounts() throws IOException {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<OsUtils> osUtilsMock = mockStatic(OsUtils.class)) {

      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      stubOsUtilsGetSearchRequest(osUtilsMock);
      stubOsClientSearch();
      when(hitsMetadata.hits()).thenReturn(List.of());

      // getDepthWiseEntityCounts calls searchResponse.hits().total().value()
      os.org.opensearch.client.opensearch.core.search.TotalHits totalHits =
          Mockito.mock(os.org.opensearch.client.opensearch.core.search.TotalHits.class);
      when(totalHits.value()).thenReturn(0L);
      when(hitsMetadata.total()).thenReturn(totalHits);

      OSLineageGraphBuilder builder = new OSLineageGraphBuilder(esClient);

      LineagePaginationInfo result =
          builder.getLineagePaginationInfo(ROOT_FQN, 2, 2, null, false, "table");

      assertNotNull(result);
      assertNotNull(result.getUpstreamDepthInfo());
      assertNotNull(result.getDownstreamDepthInfo());
    }
  }

  @SuppressWarnings("unchecked")
  @Test
  void getLineagePaginationInfo_withNodeFilter_downstreamEntities_exercisesFilteredCounts()
      throws IOException {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<OsUtils> osUtilsMock = mockStatic(OsUtils.class)) {

      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      stubOsUtilsGetSearchRequest(osUtilsMock);

      Hit<JsonData> mockHit = (Hit<JsonData>) Mockito.mock(Hit.class);
      JsonData mockJsonData = Mockito.mock(JsonData.class);
      when(mockHit.source()).thenReturn(mockJsonData);

      Map<String, Object> downstreamDoc = new HashMap<>();
      downstreamDoc.put("fullyQualifiedName", DOWNSTREAM_FQN);
      downstreamDoc.put("entityType", "table");

      osUtilsMock.when(() -> OsUtils.jsonDataToMap(any(JsonData.class))).thenReturn(downstreamDoc);

      stubOsClientSearch();
      when(hitsMetadata.hits()).thenReturn(List.of(mockHit), List.of());

      Map<String, Object> matchingResult = new HashMap<>();
      matchingResult.put(DOWNSTREAM_FQN, downstreamDoc);

      osUtilsMock
          .when(
              () ->
                  OsUtils.searchEntitiesByKey(
                      any(OpenSearchClient.class),
                      any(),
                      anyString(),
                      anyString(),
                      anySet(),
                      anyInt(),
                      anyInt(),
                      anyList(),
                      anyString()))
          .thenReturn(matchingResult);

      OSLineageGraphBuilder builder = new OSLineageGraphBuilder(esClient);
      LineagePaginationInfo result =
          builder.getLineagePaginationInfo(ROOT_FQN, 0, 1, NODE_LEVEL_QUERY_FILTER, false, "table");

      assertNotNull(result);
      assertNotNull(result.getDownstreamDepthInfo());
      assertTrue(result.getTotalDownstreamEntities() >= 1);
    }
  }

  @SuppressWarnings("unchecked")
  @Test
  void searchLineageByEntityCount_noFilter_exercisesUnfilteredPagination() throws IOException {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<OsUtils> osUtilsMock = mockStatic(OsUtils.class);
        MockedStatic<LineageUtil> lineageUtilMock =
            mockStatic(LineageUtil.class, Mockito.CALLS_REAL_METHODS)) {

      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      stubOsUtilsGetSearchRequest(osUtilsMock);

      Map<String, Object> rootDoc = new HashMap<>();
      rootDoc.put("fullyQualifiedName", ROOT_FQN);
      rootDoc.put("entityType", "table");

      osUtilsMock
          .when(
              () ->
                  OsUtils.searchEntityByKey(
                      any(OpenSearchClient.class),
                      any(),
                      anyString(),
                      anyString(),
                      any(),
                      anyList()))
          .thenReturn(rootDoc);

      Hit<JsonData> mockHit = (Hit<JsonData>) Mockito.mock(Hit.class);
      JsonData mockJsonData = Mockito.mock(JsonData.class);
      when(mockHit.source()).thenReturn(mockJsonData);

      Map<String, Object> downstreamDoc = new HashMap<>();
      downstreamDoc.put("fullyQualifiedName", DOWNSTREAM_FQN);
      downstreamDoc.put("entityType", "table");
      downstreamDoc.put("id", java.util.UUID.randomUUID().toString());

      osUtilsMock.when(() -> OsUtils.jsonDataToMap(any(JsonData.class))).thenReturn(downstreamDoc);

      stubOsClientSearch();
      when(hitsMetadata.hits()).thenReturn(List.of(mockHit), List.of());

      osUtilsMock
          .when(
              () ->
                  OsUtils.searchEntityByKey(
                      any(OpenSearchClient.class),
                      any(),
                      anyString(),
                      anyString(),
                      any(),
                      anyList()))
          .thenReturn(downstreamDoc);

      lineageUtilMock
          .when(() -> LineageUtil.replaceWithEntityLevelTagsBatch(anyList()))
          .then(invocation -> null);

      OSLineageGraphBuilder builder = new OSLineageGraphBuilder(esClient);

      EntityCountLineageRequest request =
          new EntityCountLineageRequest()
              .withFqn(ROOT_FQN)
              .withDirection(LineageDirection.DOWNSTREAM)
              .withMaxDepth(1)
              .withNodeDepth(1)
              .withIncludeDeleted(false)
              .withFrom(0)
              .withSize(50)
              .withIncludeSourceFields(Set.of())
              .withIsConnectedVia(false);

      SearchLineageResult result = builder.searchLineageByEntityCount(request);

      assertNotNull(result);
      assertNotNull(result.getNodes());
    }
  }

  @SuppressWarnings("unchecked")
  @Test
  void searchLineageByEntityCount_noFilter_sortsEntitiesBeforePagination() throws IOException {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<OsUtils> osUtilsMock = mockStatic(OsUtils.class);
        MockedStatic<LineageUtil> lineageUtilMock =
            mockStatic(LineageUtil.class, Mockito.CALLS_REAL_METHODS)) {

      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      stubOsUtilsGetSearchRequest(osUtilsMock);

      Map<String, Object> rootDoc = entityDoc(ROOT_FQN, List.of());
      Map<String, Object> docA = entityDoc("service.database.schema.a_table", List.of());
      Map<String, Object> docB = entityDoc("service.database.schema.b_table", List.of());
      Map<String, Object> docC = entityDoc("service.database.schema.c_table", List.of());

      osUtilsMock
          .when(
              () ->
                  OsUtils.searchEntityByKey(
                      any(OpenSearchClient.class),
                      any(),
                      anyString(),
                      anyString(),
                      any(),
                      anyList()))
          .thenReturn(rootDoc);

      JsonData jsonA = Mockito.mock(JsonData.class);
      JsonData jsonB = Mockito.mock(JsonData.class);
      JsonData jsonC = Mockito.mock(JsonData.class);
      Hit<JsonData> hitA = (Hit<JsonData>) Mockito.mock(Hit.class);
      Hit<JsonData> hitB = (Hit<JsonData>) Mockito.mock(Hit.class);
      Hit<JsonData> hitC = (Hit<JsonData>) Mockito.mock(Hit.class);
      when(hitA.source()).thenReturn(jsonA);
      when(hitB.source()).thenReturn(jsonB);
      when(hitC.source()).thenReturn(jsonC);

      stubOsClientSearch();
      when(hitsMetadata.hits()).thenReturn(List.of(hitC, hitA, hitB), List.of());

      osUtilsMock
          .when(() -> OsUtils.jsonDataToMap(any(JsonData.class)))
          .thenAnswer(
              invocation -> {
                JsonData jsonData = invocation.getArgument(0);
                if (jsonData == jsonA) {
                  return docA;
                }
                if (jsonData == jsonB) {
                  return docB;
                }
                if (jsonData == jsonC) {
                  return docC;
                }
                return Map.of();
              });

      lineageUtilMock
          .when(() -> LineageUtil.replaceWithEntityLevelTagsBatch(anyList()))
          .then(invocation -> null);

      OSLineageGraphBuilder builder = new OSLineageGraphBuilder(esClient);

      EntityCountLineageRequest request =
          new EntityCountLineageRequest()
              .withFqn(ROOT_FQN)
              .withDirection(LineageDirection.DOWNSTREAM)
              .withMaxDepth(1)
              .withNodeDepth(1)
              .withIncludeDeleted(false)
              .withFrom(1)
              .withSize(2)
              .withIncludeSourceFields(Set.of())
              .withIsConnectedVia(false);

      SearchLineageResult result = builder.searchLineageByEntityCount(request);

      assertTrue(result.getNodes().containsKey(ROOT_FQN));
      assertTrue(result.getNodes().containsKey("service.database.schema.a_table"));
      assertTrue(result.getNodes().containsKey("service.database.schema.b_table"));
      assertFalse(result.getNodes().containsKey("service.database.schema.c_table"));
    }
  }

  @SuppressWarnings("unchecked")
  @Test
  void searchLineageByEntityCount_includePaginationInfo_returnsCombinedCounts() throws IOException {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<OsUtils> osUtilsMock = mockStatic(OsUtils.class);
        MockedStatic<LineageUtil> lineageUtilMock =
            mockStatic(LineageUtil.class, Mockito.CALLS_REAL_METHODS)) {

      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      stubOsUtilsGetSearchRequest(osUtilsMock);

      Map<String, Object> rootDoc = entityDoc(ROOT_FQN, List.of());
      Map<String, Object> docA = entityDoc("service.database.schema.a_table", List.of());
      Map<String, Object> docB = entityDoc("service.database.schema.b_table", List.of());

      osUtilsMock
          .when(
              () ->
                  OsUtils.searchEntityByKey(
                      any(OpenSearchClient.class),
                      any(),
                      anyString(),
                      anyString(),
                      any(),
                      anyList()))
          .thenReturn(rootDoc, docA, docB);

      JsonData jsonA = Mockito.mock(JsonData.class);
      JsonData jsonB = Mockito.mock(JsonData.class);
      Hit<JsonData> hitA = (Hit<JsonData>) Mockito.mock(Hit.class);
      Hit<JsonData> hitB = (Hit<JsonData>) Mockito.mock(Hit.class);
      when(hitA.source()).thenReturn(jsonA);
      when(hitB.source()).thenReturn(jsonB);

      stubOsClientSearch();
      when(hitsMetadata.hits()).thenReturn(List.of(hitA, hitB), List.of());

      osUtilsMock
          .when(() -> OsUtils.jsonDataToMap(any(JsonData.class)))
          .thenAnswer(
              invocation -> {
                JsonData jsonData = invocation.getArgument(0);
                if (jsonData == jsonA) {
                  return docA;
                }
                if (jsonData == jsonB) {
                  return docB;
                }
                return Map.of();
              });

      lineageUtilMock
          .when(() -> LineageUtil.replaceWithEntityLevelTagsBatch(anyList()))
          .then(invocation -> null);

      OSLineageGraphBuilder builder = new OSLineageGraphBuilder(esClient);

      EntityCountLineageRequest request =
          new EntityCountLineageRequest()
              .withFqn(ROOT_FQN)
              .withDirection(LineageDirection.DOWNSTREAM)
              .withMaxDepth(1)
              .withNodeDepth(1)
              .withDownstreamDepth(1)
              .withUpstreamDepth(0)
              .withIncludePaginationInfo(true)
              .withIncludeDeleted(false)
              .withFrom(0)
              .withSize(2)
              .withIncludeSourceFields(Set.of())
              .withIsConnectedVia(false);

      SearchLineageResult result = builder.searchLineageByEntityCount(request);

      assertNotNull(result.getPaginationInfo());
      assertEquals(3, result.getPaginationInfo().getTotalDownstreamEntities());
      assertEquals(1, result.getPaginationInfo().getTotalUpstreamEntities());
      assertEquals(2, result.getPaginationInfo().getDownstreamDepthInfo().size());
      assertEquals(2, result.getPaginationInfo().getDownstreamDepthInfo().get(1).getEntityCount());
    }
  }
}
