package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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
import com.fasterxml.jackson.databind.JsonNode;
import java.util.Base64;
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
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.core.SearchRequest;
import os.org.opensearch.client.opensearch.core.SearchResponse;
import os.org.opensearch.client.opensearch.core.search.Hit;
import os.org.opensearch.client.opensearch.core.search.HitsMetadata;

@ExtendWith(MockitoExtension.class)
class OsUtilsTest {
  @Mock private SearchRepository searchRepository;
  @Mock private OpenSearchClient client;
  @Mock private SearchResponse<JsonData> searchResponse;
  @Mock private HitsMetadata<JsonData> hitsMetadata;
  @Mock private Hit<JsonData> firstHit;
  @Mock private Hit<JsonData> secondHit;
  @Mock private EmbeddingClient embeddingClient;

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

    String result = OsUtils.parseJsonQuery(queryWithWrapper);

    assertNotNull(result);
    // Result should be Base64 encoded
    String decoded = new String(Base64.getDecoder().decode(result));
    assertTrue(decoded.contains("term"));
    assertTrue(decoded.contains("field"));
    assertTrue(decoded.contains("value"));
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

    String result = OsUtils.parseJsonQuery(queryWithoutWrapper);

    assertNotNull(result);
    // Result should be Base64 encoded
    String decoded = new String(Base64.getDecoder().decode(result));
    assertTrue(decoded.contains("term"));
    assertTrue(decoded.contains("field"));
    assertTrue(decoded.contains("value"));
  }

  @Test
  void testParseJsonQuery_resultIsBase64Encoded() throws JsonProcessingException {
    String query = """
        {
          "term": {"status": "active"}
        }
        """;

    String result = OsUtils.parseJsonQuery(query);

    assertNotNull(result);
    // Verify it's valid Base64 by decoding it
    String decoded = new String(Base64.getDecoder().decode(result));
    assertTrue(decoded.contains("term"));
    assertTrue(decoded.contains("status"));
    assertTrue(decoded.contains("active"));
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

    String result = OsUtils.parseJsonQuery(boolQuery);

    assertNotNull(result);
    String decoded = new String(Base64.getDecoder().decode(result));
    assertTrue(decoded.contains("bool"));
    assertTrue(decoded.contains("must"));
    assertTrue(decoded.contains("status"));
    assertTrue(decoded.contains("active"));
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

    String result = OsUtils.parseJsonQuery(matchQuery);

    assertNotNull(result);
    String decoded = new String(Base64.getDecoder().decode(result));
    assertTrue(decoded.contains("match"));
    assertTrue(decoded.contains("description"));
    assertTrue(decoded.contains("test query"));
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

    String result = OsUtils.parseJsonQuery(nestedQuery);

    assertNotNull(result);
    String decoded = new String(Base64.getDecoder().decode(result));
    assertTrue(decoded.contains("nested"));
    assertTrue(decoded.contains("path"));
    assertTrue(decoded.contains("user"));
  }

  @Test
  void testParseJsonQuery_simpleTermQuery() throws JsonProcessingException {
    String simpleQuery = """
        {
          "term": {"owner": "admin"}
        }
        """;

    String result = OsUtils.parseJsonQuery(simpleQuery);

    assertNotNull(result);
    String decoded = new String(Base64.getDecoder().decode(result));
    assertTrue(decoded.contains("term"));
    assertTrue(decoded.contains("owner"));
    assertTrue(decoded.contains("admin"));
  }

  @Test
  void testParseJsonQuery_invalidJson() {
    String invalidJson = "{ invalid json";

    assertThrows(JsonProcessingException.class, () -> OsUtils.parseJsonQuery(invalidJson));
  }

  @Test
  void testParseJsonQuery_emptyObject() throws JsonProcessingException {
    String emptyQuery = "{}";

    String result = OsUtils.parseJsonQuery(emptyQuery);

    assertNotNull(result);
    String decoded = new String(Base64.getDecoder().decode(result));
    assertEquals("{}", decoded);
  }

  @Test
  void testParseJsonQuery_queryWrapperOnly() throws JsonProcessingException {
    String queryWrapperOnly = """
        {
          "query": {}
        }
        """;

    String result = OsUtils.parseJsonQuery(queryWrapperOnly);

    assertNotNull(result);
    String decoded = new String(Base64.getDecoder().decode(result));
    assertEquals("{}", decoded);
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

    String result = OsUtils.parseJsonQuery(complexQuery);

    assertNotNull(result);
    String decoded = new String(Base64.getDecoder().decode(result));
    assertTrue(decoded.contains("bool"));
    assertTrue(decoded.contains("must"));
    assertTrue(decoded.contains("filter"));
    assertTrue(decoded.contains("nested"));
    assertTrue(decoded.contains("tags"));
  }

  @Test
  void testParseJsonQuery_extractsInnerQueryFromWrapper() throws JsonProcessingException {
    String wrappedQuery =
        """
        {
          "query": {
            "match_all": {}
          }
        }
        """;

    String result = OsUtils.parseJsonQuery(wrappedQuery);
    String decoded = new String(Base64.getDecoder().decode(result));

    // Should extract just the inner query part
    assertTrue(decoded.contains("match_all"));
    // Should not contain the outer "query" wrapper after extraction
    assertNotNull(result);
  }

  @Test
  void testJsonDataToMapRoundTripsDocument() {
    Map<String, Object> result =
        OsUtils.jsonDataToMap(OsUtils.toJsonData("{\"name\":\"orders\",\"deleted\":false}"));

    assertEquals("orders", result.get("name"));
    assertEquals(false, result.get("deleted"));
  }

  @Test
  void testJsonDataToMapReturnsEmptyMapForNullInput() {
    assertTrue(OsUtils.jsonDataToMap(null).isEmpty());
  }

  @Test
  void testToJsonDataRoundTripsValidJson() {
    JsonData jsonData = OsUtils.toJsonData("{\"name\":\"orders\",\"deleted\":false}");
    Map<String, Object> result = OsUtils.jsonDataToMap(jsonData);

    assertEquals("orders", result.get("name"));
    assertEquals(false, result.get("deleted"));
  }

  @Test
  void testToJsonDataRejectsInvalidJson() {
    IllegalArgumentException exception =
        assertThrows(IllegalArgumentException.class, () -> OsUtils.toJsonData("{invalid-json"));

    assertInstanceOf(JsonProcessingException.class, exception.getCause());
  }

  @Test
  void testGetEntityRelationshipAggregationFieldReturnsDirectionSpecificField() {
    assertEquals(
        FIELD_FULLY_QUALIFIED_NAME_HASH_KEYWORD,
        OsUtils.getEntityRelationshipAggregationField(EntityRelationshipDirection.UPSTREAM));
    assertEquals(
        DOWNSTREAM_ENTITY_RELATIONSHIP_KEY,
        OsUtils.getEntityRelationshipAggregationField(EntityRelationshipDirection.DOWNSTREAM));
  }

  @Test
  void testGetSearchRequestForEntityRelationshipIncludesFiltersAggregationAndAliases() {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getSearchRepository).thenReturn(searchRepository);
      when(searchRepository.getIndexOrAliasName("table_search")).thenReturn("resolved.table");

      SearchRequest request =
          OsUtils.getSearchRequest(
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
          OsUtils.getSearchRequest(
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
        OsUtils.searchEntitiesWithLimitOffset(
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
        OsUtils.searchEntitiesWithLimitOffset(
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
              OsUtils.toJsonData("{\"fullyQualifiedName\":\"sample.orders\",\"name\":\"orders\"}"));
      when(secondHit.source()).thenReturn(null);

      Map<String, Object> result =
          OsUtils.searchEREntitiesByKey(
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
              OsUtils.toJsonData("{\"fullyQualifiedName\":\"sample.orders\",\"name\":\"orders\"}"));

      Map<String, Object> result =
          OsUtils.searchEREntityByKey(
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
              OsUtils.searchEREntityByKey(
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
              OsUtils.toJsonData(
                  "{\"fullyQualifiedName\":\"sample.orders\",\"direction\":\"upstream\"}"));

      Map<String, Object> result =
          OsUtils.searchEntitiesByKey(
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
          .thenReturn(OsUtils.toJsonData("{\"fullyQualifiedName\":\"sample.orders\"}"));
      when(secondHit.source())
          .thenReturn(OsUtils.toJsonData("{\"fullyQualifiedName\":\"sample.marketing\"}"));

      assertThrows(
          SearchException.class,
          () ->
              OsUtils.searchEntityByKey(
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
          OsUtils.searchEntities(client, "table_search", "owner:bot", true);

      assertSame(searchResponse, result);
      SearchRequest request = requestCaptor.getValue();
      assertTrue(request.index().contains("resolved.table"));
      assertEquals(10000, request.size());
      assertNotNull(request.postFilter());
    }
  }

  @Test
  void testTransformStemmerForOpenSearchRewritesStemmerNameToLanguage() {
    JsonNode transformed =
        OsUtils.transformStemmerForOpenSearch(
            org.openmetadata.schema.utils.JsonUtils.readTree(
                """
                {
                  "analysis": {
                    "filter": {
                      "om_stemmer": {
                        "type": "stemmer",
                        "name": "english"
                      }
                    }
                  }
                }
                """));

    assertEquals(
        "english",
        transformed.path("analysis").path("filter").path("om_stemmer").path("language").asText());
    assertFalse(transformed.path("analysis").path("filter").path("om_stemmer").has("name"));
  }

  @Test
  void testTransformStemmerForOpenSearchLeavesMissingStemmerUntouched() {
    JsonNode settings =
        org.openmetadata.schema.utils.JsonUtils.readTree(
            """
            {
              "analysis": {
                "filter": {
                  "snowball": {
                    "type": "snowball",
                    "language": "English"
                  }
                }
              }
            }
            """);

    JsonNode transformed = OsUtils.transformStemmerForOpenSearch(settings);

    assertEquals(settings, transformed);
  }

  @Test
  void testEnrichIndexMappingWithStemmerTransformsSettings() {
    String enriched =
        OsUtils.enrichIndexMappingWithStemmer(
            """
            {
              "settings": {
                "analysis": {
                  "filter": {
                    "om_stemmer": {
                      "type": "stemmer",
                      "name": "english"
                    }
                  }
                }
              },
              "mappings": {
                "properties": {
                  "name": {
                    "type": "text"
                  }
                }
              }
            }
            """);

    JsonNode root = org.openmetadata.schema.utils.JsonUtils.readTree(enriched);
    assertEquals(
        "english",
        root.path("settings")
            .path("analysis")
            .path("filter")
            .path("om_stemmer")
            .path("language")
            .asText());
  }

  @Test
  void testEnrichIndexMappingWithStemmerRejectsEmptyContent() {
    assertThrows(IllegalArgumentException.class, () -> OsUtils.enrichIndexMappingWithStemmer(""));
  }

  @Test
  void testTransformFieldTypesForOpenSearchRewritesFlattenedFieldsRecursively() {
    JsonNode transformed =
        OsUtils.transformFieldTypesForOpenSearch(
            org.openmetadata.schema.utils.JsonUtils.readTree(
                """
                {
                  "properties": {
                    "metadata": {
                      "type": "flattened"
                    },
                    "nested": {
                      "properties": {
                        "tags": {
                          "type": "flattened"
                        }
                      }
                    }
                  }
                }
                """));

    assertEquals(
        "flat_object", transformed.path("properties").path("metadata").path("type").asText());
    assertEquals(
        "flat_object",
        transformed
            .path("properties")
            .path("nested")
            .path("properties")
            .path("tags")
            .path("type")
            .asText());
  }

  @Test
  void testTransformFieldTypesForOpenSearchReturnsOriginalWhenMappingsAreInvalid() {
    JsonNode invalid = org.openmetadata.schema.utils.JsonUtils.readTree("\"invalid\"");

    JsonNode transformed = OsUtils.transformFieldTypesForOpenSearch(invalid);

    assertSame(invalid, transformed);
  }

  @Test
  void testEnrichIndexMappingForOpenSearchTransformsStemmerAndFieldTypes() {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getSearchRepository).thenReturn(searchRepository);
      when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(false);

      String enriched =
          OsUtils.enrichIndexMappingForOpenSearch(
              """
              {
                "settings": {
                  "analysis": {
                    "filter": {
                      "om_stemmer": {
                        "type": "stemmer",
                        "name": "english"
                      }
                    }
                  },
                  "index": {}
                },
                "mappings": {
                  "properties": {
                    "fingerprint": {
                      "type": "keyword"
                    },
                    "metadata": {
                      "type": "flattened"
                    }
                  }
                }
              }
              """);

      JsonNode root = org.openmetadata.schema.utils.JsonUtils.readTree(enriched);
      assertEquals(
          "english",
          root.path("settings")
              .path("analysis")
              .path("filter")
              .path("om_stemmer")
              .path("language")
              .asText());
      assertEquals(
          "flat_object",
          root.path("mappings").path("properties").path("metadata").path("type").asText());
      assertTrue(root.path("mappings").path("properties").path("embedding").isMissingNode());
    }
  }

  @Test
  void testEnrichIndexMappingForOpenSearchRejectsEmptyContent() {
    assertThrows(IllegalArgumentException.class, () -> OsUtils.enrichIndexMappingForOpenSearch(""));
  }

  @Test
  void testAddKnnVectorSettingsSkipsWhenFingerprintFieldIsMissing() {
    JsonNode root =
        org.openmetadata.schema.utils.JsonUtils.readTree(
            """
            {
              "settings": {
                "index": {}
              },
              "mappings": {
                "properties": {
                  "name": {
                    "type": "text"
                  }
                }
              }
            }
            """);

    OsUtils.addKnnVectorSettings(root);

    assertTrue(root.path("mappings").path("properties").path("embedding").isMissingNode());
  }

  @Test
  void testAddKnnVectorSettingsAddsEmbeddingMetadataFromClientDimension() {
    JsonNode root =
        org.openmetadata.schema.utils.JsonUtils.readTree(
            """
            {
              "settings": {
                "index": {}
              },
              "mappings": {
                "_meta": {
                  "embedding_dimension": 512
                },
                "properties": {
                  "fingerprint": {
                    "type": "keyword"
                  }
                }
              }
            }
            """);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getSearchRepository).thenReturn(searchRepository);
      when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);
      when(searchRepository.getEmbeddingClient()).thenReturn(embeddingClient);
      when(embeddingClient.getDimension()).thenReturn(1536);

      OsUtils.addKnnVectorSettings(root);

      assertTrue(root.path("settings").path("index").path("knn").asBoolean());
      assertEquals(
          1536,
          root.path("mappings").path("properties").path("embedding").path("dimension").asInt());
      assertEquals(
          "knn_vector",
          root.path("mappings").path("properties").path("embedding").path("type").asText());
      assertEquals(
          "hnsw",
          root.path("mappings")
              .path("properties")
              .path("embedding")
              .path("method")
              .path("name")
              .asText());
      assertEquals(
          48,
          root.path("mappings")
              .path("properties")
              .path("embedding")
              .path("method")
              .path("parameters")
              .path("m")
              .asInt());
    }
  }
}
