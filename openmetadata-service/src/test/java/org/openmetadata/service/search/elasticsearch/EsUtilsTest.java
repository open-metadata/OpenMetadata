package org.openmetadata.service.search.elasticsearch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.Entity.FIELD_FULLY_QUALIFIED_NAME_HASH_KEYWORD;
import static org.openmetadata.service.search.SearchUtils.DOWNSTREAM_ENTITY_RELATIONSHIP_KEY;
import static org.openmetadata.service.search.SearchUtils.getLineageDirectionAggregationField;

import com.fasterxml.jackson.core.JsonProcessingException;
import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch.core.SearchRequest;
import es.co.elastic.clients.elasticsearch.core.SearchResponse;
import es.co.elastic.clients.elasticsearch.core.search.Hit;
import es.co.elastic.clients.elasticsearch.core.search.HitsMetadata;
import es.co.elastic.clients.json.JsonData;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.api.entityRelationship.EntityRelationshipDirection;
import org.openmetadata.schema.api.lineage.LineageDirection;
import org.openmetadata.sdk.exception.SearchException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;

@ExtendWith(MockitoExtension.class)
class EsUtilsTest {
  @Mock private SearchRepository searchRepository;
  @Mock private ElasticsearchClient client;
  @Mock private SearchResponse<JsonData> searchResponse;
  @Mock private HitsMetadata<JsonData> hitsMetadata;
  @Mock private Hit<JsonData> firstHit;
  @Mock private Hit<JsonData> secondHit;

  @Test
  void testParseJsonQuery_withOuterQueryWrapper() throws JsonProcessingException {
    String queryWithWrapper =
        """
        {
          "query": {
            "term": {
              "field": "value"
            }
          }
        }
        """;

    String result = EsUtils.parseJsonQuery(queryWithWrapper);

    assertNotNull(result);
    assertTrue(result.contains("term"));
    assertTrue(result.contains("field"));
    assertTrue(result.contains("value"));
  }

  @Test
  void testParseJsonQuery_withoutOuterQueryWrapper() throws JsonProcessingException {
    String queryWithoutWrapper =
        """
        {
          "term": {
            "field": "value"
          }
        }
        """;

    String result = EsUtils.parseJsonQuery(queryWithoutWrapper);

    assertNotNull(result);
    assertTrue(result.contains("term"));
    assertTrue(result.contains("field"));
    assertTrue(result.contains("value"));
    assertEquals(queryWithoutWrapper.trim().replaceAll("\\s+", ""), result.replaceAll("\\s+", ""));
  }

  @Test
  void testParseJsonQuery_withBoolQuery() throws JsonProcessingException {
    String boolQuery =
        """
        {
          "query": {
            "bool": {
              "must": [
                {"term": {"status": "active"}},
                {"range": {"age": {"gte": 18}}}
              ]
            }
          }
        }
        """;

    String result = EsUtils.parseJsonQuery(boolQuery);

    assertNotNull(result);
    assertTrue(result.contains("bool"));
    assertTrue(result.contains("must"));
    assertTrue(result.contains("status"));
    assertTrue(result.contains("active"));
  }

  @Test
  void testParseJsonQuery_withMatchQuery() throws JsonProcessingException {
    String matchQuery =
        """
        {
          "query": {
            "match": {
              "description": "test query"
            }
          }
        }
        """;

    String result = EsUtils.parseJsonQuery(matchQuery);

    assertNotNull(result);
    assertTrue(result.contains("match"));
    assertTrue(result.contains("description"));
    assertTrue(result.contains("test query"));
  }

  @Test
  void testParseJsonQuery_withNestedQuery() throws JsonProcessingException {
    String nestedQuery =
        """
        {
          "query": {
            "nested": {
              "path": "user",
              "query": {
                "term": {"user.name": "john"}
              }
            }
          }
        }
        """;

    String result = EsUtils.parseJsonQuery(nestedQuery);

    assertNotNull(result);
    assertTrue(result.contains("nested"));
    assertTrue(result.contains("path"));
    assertTrue(result.contains("user"));
  }

  @Test
  void testParseJsonQuery_simpleTermQuery() throws JsonProcessingException {
    String simpleQuery = """
        {
          "term": {"owner": "admin"}
        }
        """;

    String result = EsUtils.parseJsonQuery(simpleQuery);

    assertNotNull(result);
    assertTrue(result.contains("term"));
    assertTrue(result.contains("owner"));
    assertTrue(result.contains("admin"));
  }

  @Test
  void testParseJsonQuery_invalidJson() {
    String invalidJson = "{ invalid json";

    assertThrows(JsonProcessingException.class, () -> EsUtils.parseJsonQuery(invalidJson));
  }

  @Test
  void testParseJsonQuery_emptyObject() throws JsonProcessingException {
    String emptyQuery = "{}";

    String result = EsUtils.parseJsonQuery(emptyQuery);

    assertNotNull(result);
    assertEquals("{}", result);
  }

  @Test
  void testParseJsonQuery_queryWrapperOnly() throws JsonProcessingException {
    String queryWrapperOnly = """
        {
          "query": {}
        }
        """;

    String result = EsUtils.parseJsonQuery(queryWrapperOnly);

    assertNotNull(result);
    assertEquals("{}", result);
  }

  @Test
  void testParseJsonQuery_complexNestedStructure() throws JsonProcessingException {
    String complexQuery =
        """
        {
          "query": {
            "bool": {
              "must": [
                {
                  "nested": {
                    "path": "tags",
                    "query": {
                      "term": {"tags.name": "important"}
                    }
                  }
                }
              ],
              "filter": [
                {"term": {"deleted": false}}
              ]
            }
          }
        }
        """;

    String result = EsUtils.parseJsonQuery(complexQuery);

    assertNotNull(result);
    assertTrue(result.contains("bool"));
    assertTrue(result.contains("must"));
    assertTrue(result.contains("filter"));
    assertTrue(result.contains("nested"));
    assertTrue(result.contains("tags"));
  }

  @Test
  void testJsonDataToMapRoundTripsDocument() {
    Map<String, Object> result =
        EsUtils.jsonDataToMap(EsUtils.toJsonData("{\"name\":\"orders\",\"deleted\":false}"));

    assertEquals("orders", result.get("name"));
    assertEquals(false, result.get("deleted"));
  }

  @Test
  void testJsonDataToMapReturnsEmptyMapForNullInput() {
    assertTrue(EsUtils.jsonDataToMap(null).isEmpty());
  }

  @Test
  void testToJsonDataRoundTripsValidJson() {
    JsonData jsonData = EsUtils.toJsonData("{\"name\":\"orders\",\"deleted\":false}");
    Map<String, Object> result = EsUtils.jsonDataToMap(jsonData);

    assertEquals("orders", result.get("name"));
    assertEquals(false, result.get("deleted"));
  }

  @Test
  void testToJsonDataRejectsInvalidJson() {
    IllegalArgumentException exception =
        assertThrows(IllegalArgumentException.class, () -> EsUtils.toJsonData("{invalid-json"));

    assertInstanceOf(JsonProcessingException.class, exception.getCause());
  }

  @Test
  void testGetEntityRelationshipAggregationFieldReturnsDirectionSpecificField() {
    assertEquals(
        FIELD_FULLY_QUALIFIED_NAME_HASH_KEYWORD,
        EsUtils.getEntityRelationshipAggregationField(EntityRelationshipDirection.UPSTREAM));
    assertEquals(
        DOWNSTREAM_ENTITY_RELATIONSHIP_KEY,
        EsUtils.getEntityRelationshipAggregationField(EntityRelationshipDirection.DOWNSTREAM));
  }

  @Test
  void testGetSearchRequestForEntityRelationshipIncludesFiltersAggregationAndAliases() {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getSearchRepository).thenReturn(searchRepository);
      when(searchRepository.getIndexOrAliasName("table_search")).thenReturn("resolved.table");

      SearchRequest request =
          EsUtils.getSearchRequest(
              EntityRelationshipDirection.UPSTREAM,
              "table_search",
              "{\"query\":{\"term\":{\"owner\":\"data-eng\"}}}",
              "owners",
              Map.of("fullyQualifiedName.keyword", Set.of("sample.table")),
              3,
              15,
              true,
              List.of("name", "owner"),
              List.of("columns"));

      assertTrue(request.index().contains("resolved.table"));
      assertEquals(3, request.from());
      assertEquals(15, request.size());
      assertTrue(request.aggregations().containsKey("owners"));
      assertEquals(List.of("name", "owner"), request.source().filter().includes());
      assertEquals(List.of("columns"), request.source().filter().excludes());
      assertNotNull(request.query());
      assertNotNull(request.postFilter());
    }
  }

  @Test
  void testGetSearchRequestForLineageUsesDownstreamAggregationField() {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getSearchRepository).thenReturn(searchRepository);
      when(searchRepository.getIndexOrAliasName("lineage_search")).thenReturn("resolved.lineage");

      SearchRequest request =
          EsUtils.getSearchRequest(
              LineageDirection.DOWNSTREAM,
              "lineage_search",
              "service.name:sample",
              "lineageAgg",
              Map.of("fromEntity", Set.of("table1"), "toEntity", Set.of("table2")),
              0,
              20,
              false,
              null,
              List.of("owners"));

      assertTrue(request.index().contains("resolved.lineage"));
      assertTrue(request.aggregations().containsKey("lineageAgg"));
      assertEquals(
          getLineageDirectionAggregationField(LineageDirection.DOWNSTREAM),
          request.aggregations().get("lineageAgg").terms().field());
      assertNotNull(request.postFilter());
    }
  }

  @Test
  void testSearchEntitiesWithLimitOffsetBuildsRequestWithJsonFilter() throws Exception {
    ArgumentCaptor<SearchRequest> requestCaptor = ArgumentCaptor.forClass(SearchRequest.class);
    when(client.search(requestCaptor.capture(), eq(JsonData.class))).thenReturn(searchResponse);

    SearchResponse<JsonData> result =
        EsUtils.searchEntitiesWithLimitOffset(
            client,
            "table_search_index",
            "{\"query\":{\"term\":{\"owner\":\"bot\"}}}",
            5,
            10,
            true);

    assertSame(searchResponse, result);
    SearchRequest request = requestCaptor.getValue();
    assertTrue(request.index().contains("table_search_index"));
    assertEquals(5, request.from());
    assertEquals(10, request.size());
    assertNotNull(request.query());
  }

  @Test
  void testSearchEntitiesWithLimitOffsetIgnoresInvalidJsonFilter() throws Exception {
    ArgumentCaptor<SearchRequest> requestCaptor = ArgumentCaptor.forClass(SearchRequest.class);
    when(client.search(requestCaptor.capture(), eq(JsonData.class))).thenReturn(searchResponse);

    SearchResponse<JsonData> result =
        EsUtils.searchEntitiesWithLimitOffset(
            client, "table_search_index", "{invalid", 0, 2, false);

    assertSame(searchResponse, result);
    assertNotNull(requestCaptor.getValue().query());
  }

  @Test
  void testSearchEREntitiesByKeyMapsHitsByFullyQualifiedName() throws Exception {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getSearchRepository).thenReturn(searchRepository);
      when(searchRepository.getIndexOrAliasName("table_search")).thenReturn("resolved.table");
      when(client.search(any(SearchRequest.class), eq(JsonData.class))).thenReturn(searchResponse);
      when(searchResponse.hits()).thenReturn(hitsMetadata);
      when(hitsMetadata.hits()).thenReturn(List.of(firstHit, secondHit));
      when(firstHit.source())
          .thenReturn(
              EsUtils.toJsonData("{\"fullyQualifiedName\":\"sample.orders\",\"name\":\"orders\"}"));
      when(secondHit.source()).thenReturn(null);

      Map<String, Object> result =
          EsUtils.searchEREntitiesByKey(
              client,
              EntityRelationshipDirection.UPSTREAM,
              "table_search",
              "owner",
              Set.of("data-eng"),
              0,
              10,
              List.of("columns"));

      assertEquals(1, result.size());
      assertEquals("orders", ((Map<?, ?>) result.get("sample.orders")).get("name"));
    }
  }

  @Test
  void testSearchEREntityByKeyReturnsSingleMatch() throws Exception {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getSearchRepository).thenReturn(searchRepository);
      when(searchRepository.getIndexOrAliasName("table_search")).thenReturn("resolved.table");
      when(client.search(any(SearchRequest.class), eq(JsonData.class))).thenReturn(searchResponse);
      when(searchResponse.hits()).thenReturn(hitsMetadata);
      when(hitsMetadata.hits()).thenReturn(List.of(firstHit));
      when(firstHit.source())
          .thenReturn(
              EsUtils.toJsonData("{\"fullyQualifiedName\":\"sample.orders\",\"name\":\"orders\"}"));

      Map<String, Object> result =
          EsUtils.searchEREntityByKey(
              client,
              EntityRelationshipDirection.UPSTREAM,
              "table_search",
              "owner",
              com.nimbusds.jose.util.Pair.of("data-eng", "sample.orders"),
              List.of());

      assertEquals("orders", result.get("name"));
    }
  }

  @Test
  void testSearchEREntityByKeyThrowsWhenMatchesAreMissing() throws Exception {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getSearchRepository).thenReturn(searchRepository);
      when(searchRepository.getIndexOrAliasName("table_search")).thenReturn("resolved.table");
      when(client.search(any(SearchRequest.class), eq(JsonData.class))).thenReturn(searchResponse);
      when(searchResponse.hits()).thenReturn(hitsMetadata);
      when(hitsMetadata.hits()).thenReturn(List.of());

      assertThrows(
          SearchException.class,
          () ->
              EsUtils.searchEREntityByKey(
                  client,
                  EntityRelationshipDirection.UPSTREAM,
                  "table_search",
                  "owner",
                  com.nimbusds.jose.util.Pair.of("data-eng", "sample.orders"),
                  List.of()));
    }
  }

  @Test
  void testSearchEntitiesByKeyMapsLineageHits() throws Exception {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getSearchRepository).thenReturn(searchRepository);
      when(searchRepository.getIndexOrAliasName("lineage_search")).thenReturn("resolved.lineage");
      when(client.search(any(SearchRequest.class), eq(JsonData.class))).thenReturn(searchResponse);
      when(searchResponse.hits()).thenReturn(hitsMetadata);
      when(hitsMetadata.hits()).thenReturn(List.of(firstHit));
      when(firstHit.source())
          .thenReturn(
              EsUtils.toJsonData(
                  "{\"fullyQualifiedName\":\"sample.orders\",\"direction\":\"upstream\"}"));

      Map<String, Object> result =
          EsUtils.searchEntitiesByKey(
              client,
              LineageDirection.UPSTREAM,
              "lineage_search",
              "fromEntity",
              Set.of("sample.dashboard"),
              1,
              5,
              List.of("owners"));

      assertEquals(1, result.size());
      assertEquals("upstream", ((Map<?, ?>) result.get("sample.orders")).get("direction"));
    }
  }

  @Test
  void testSearchEntityByKeyThrowsWhenMultipleMatchesExist() throws Exception {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getSearchRepository).thenReturn(searchRepository);
      when(searchRepository.getIndexOrAliasName("lineage_search")).thenReturn("resolved.lineage");
      when(client.search(any(SearchRequest.class), eq(JsonData.class))).thenReturn(searchResponse);
      when(searchResponse.hits()).thenReturn(hitsMetadata);
      when(hitsMetadata.hits()).thenReturn(List.of(firstHit, secondHit));
      when(firstHit.source())
          .thenReturn(EsUtils.toJsonData("{\"fullyQualifiedName\":\"sample.orders\"}"));
      when(secondHit.source())
          .thenReturn(EsUtils.toJsonData("{\"fullyQualifiedName\":\"sample.marketing\"}"));

      assertThrows(
          SearchException.class,
          () ->
              EsUtils.searchEntityByKey(
                  client,
                  LineageDirection.DOWNSTREAM,
                  "lineage_search",
                  "fromEntity",
                  com.nimbusds.jose.util.Pair.of("sample.dashboard", "sample.orders"),
                  List.of()));
    }
  }

  @Test
  void testSearchEntitiesUsesResolvedAliasAndPostFilter() throws Exception {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getSearchRepository).thenReturn(searchRepository);
      when(searchRepository.getIndexOrAliasName("table_search")).thenReturn("resolved.table");
      ArgumentCaptor<SearchRequest> requestCaptor = ArgumentCaptor.forClass(SearchRequest.class);
      when(client.search(requestCaptor.capture(), eq(JsonData.class))).thenReturn(searchResponse);

      SearchResponse<JsonData> result =
          EsUtils.searchEntities(client, "table_search", "owner:bot", true);

      assertSame(searchResponse, result);
      SearchRequest request = requestCaptor.getValue();
      assertTrue(request.index().contains("resolved.table"));
      assertEquals(10000, request.size());
      assertNotNull(request.postFilter());
    }
  }
}
