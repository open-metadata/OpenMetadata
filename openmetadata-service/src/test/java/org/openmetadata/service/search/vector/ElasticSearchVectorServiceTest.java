package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.transport.rest5_client.Rest5ClientTransport;
import es.co.elastic.clients.transport.rest5_client.low_level.Request;
import es.co.elastic.clients.transport.rest5_client.low_level.Response;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.apache.hc.core5.http.HttpEntity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.openmetadata.service.search.vector.utils.DTOs;

class ElasticSearchVectorServiceTest {

  private ElasticSearchVectorService vectorService;
  private Rest5Client mockRestClient;
  private EmbeddingClient mockEmbeddingClient;

  @BeforeEach
  void setup() throws Exception {
    ElasticsearchClient mockClient = mock(ElasticsearchClient.class);
    Rest5ClientTransport mockTransport = mock(Rest5ClientTransport.class);
    mockRestClient = mock(Rest5Client.class);

    when(mockClient._transport()).thenReturn(mockTransport);
    when(mockTransport.restClient()).thenReturn(mockRestClient);

    mockEmbeddingClient = mock(EmbeddingClient.class);
    when(mockEmbeddingClient.embed(any(String.class))).thenReturn(new float[] {0.1f, 0.2f, 0.3f});

    vectorService = new ElasticSearchVectorService(mockClient, mockEmbeddingClient);
  }

  @Test
  void testThresholdFilteringRemovesLowScoreResults() throws Exception {
    String esResponse =
        """
        {
          "hits": {
            "total": {"value": 4},
            "hits": [
              {
                "_score": 0.9,
                "_source": {
                  "parent_id": "parent1",
                  "chunk_index": 0,
                  "text": "High score chunk"
                }
              },
              {
                "_score": 0.7,
                "_source": {
                  "parent_id": "parent2",
                  "chunk_index": 0,
                  "text": "Medium score chunk"
                }
              },
              {
                "_score": 0.4,
                "_source": {
                  "parent_id": "parent3",
                  "chunk_index": 0,
                  "text": "Low score chunk"
                }
              },
              {
                "_score": 0.2,
                "_source": {
                  "parent_id": "parent4",
                  "chunk_index": 0,
                  "text": "Very low score chunk"
                }
              }
            ]
          }
        }
        """;

    mockRestClientResponse(esResponse);

    DTOs.VectorSearchResponse results = vectorService.search("test query", Map.of(), 10, 0, 100, 0.5);

    assertNotNull(results);
    assertEquals(2, results.hits.size(), "Should return 2 results (scores 0.9 and 0.7)");
    for (Map<String, Object> result : results.hits) {
      double score = (double) result.get("_score");
      assertTrue(score >= 0.5, "All results should have score >= 0.5, got: " + score);
    }
  }

  @Test
  void testScoreFieldIncludedInResults() throws Exception {
    String esResponse =
        """
        {
          "hits": {
            "total": {"value": 1},
            "hits": [
              {
                "_score": 0.85,
                "_source": {
                  "parent_id": "parent1",
                  "chunk_index": 0,
                  "text": "Test chunk"
                }
              }
            ]
          }
        }
        """;

    mockRestClientResponse(esResponse);

    DTOs.VectorSearchResponse results = vectorService.search("test query", Map.of(), 10, 0, 100, 0.0);

    assertEquals(1, results.hits.size());
    assertTrue(results.hits.get(0).containsKey("_score"), "Result should contain _score field");
    assertEquals(0.85, (double) results.hits.get(0).get("_score"), 0.001);
  }

  @Test
  void testParentGroupingLimitsDistinctParents() throws Exception {
    String esResponse =
        """
        {
          "hits": {
            "total": {"value": 8},
            "hits": [
              {"_score": 0.9,  "_source": {"parent_id": "parent1", "chunk_index": 0}},
              {"_score": 0.88, "_source": {"parent_id": "parent1", "chunk_index": 1}},
              {"_score": 0.85, "_source": {"parent_id": "parent1", "chunk_index": 2}},
              {"_score": 0.8,  "_source": {"parent_id": "parent2", "chunk_index": 0}},
              {"_score": 0.78, "_source": {"parent_id": "parent2", "chunk_index": 1}},
              {"_score": 0.7,  "_source": {"parent_id": "parent3", "chunk_index": 0}},
              {"_score": 0.68, "_source": {"parent_id": "parent3", "chunk_index": 1}},
              {"_score": 0.6,  "_source": {"parent_id": "parent4", "chunk_index": 0}}
            ]
          }
        }
        """;

    mockRestClientResponse(esResponse);

    DTOs.VectorSearchResponse results = vectorService.search("test query", Map.of(), 2, 0, 100, 0.0);

    assertEquals(5, results.hits.size(), "Should return all chunks from first 2 parents (3+2=5)");
    long distinctParents = results.hits.stream().map(r -> r.get("parent_id")).distinct().count();
    assertEquals(2, distinctParents, "Should have chunks from exactly 2 distinct parents");
  }

  @Test
  void testZeroThresholdReturnsAllResults() throws Exception {
    String esResponse =
        """
        {
          "hits": {
            "total": {"value": 3},
            "hits": [
              {"_score": 0.9, "_source": {"parent_id": "p1", "chunk_index": 0}},
              {"_score": 0.5, "_source": {"parent_id": "p2", "chunk_index": 0}},
              {"_score": 0.1, "_source": {"parent_id": "p3", "chunk_index": 0}}
            ]
          }
        }
        """;

    mockRestClientResponse(esResponse);

    DTOs.VectorSearchResponse results = vectorService.search("test query", Map.of(), 10, 0, 100, 0.0);

    assertEquals(3, results.hits.size(), "With threshold 0.0, should return all 3 results");
  }

  @Test
  void testHighThresholdFiltersAllResults() throws Exception {
    String esResponse =
        """
        {
          "hits": {
            "total": {"value": 3},
            "hits": [
              {"_score": 0.5, "_source": {"parent_id": "p1", "chunk_index": 0}},
              {"_score": 0.3, "_source": {"parent_id": "p2", "chunk_index": 0}},
              {"_score": 0.1, "_source": {"parent_id": "p3", "chunk_index": 0}}
            ]
          }
        }
        """;

    mockRestClientResponse(esResponse);

    DTOs.VectorSearchResponse results = vectorService.search("test query", Map.of(), 10, 0, 100, 0.9);

    assertEquals(0, results.hits.size(), "With threshold 0.9, all results should be filtered out");
  }

  @Test
  void testChunksWithoutParentIdAreSkipped() throws Exception {
    String esResponse =
        """
        {
          "hits": {
            "total": {"value": 3},
            "hits": [
              {"_score": 0.9, "_source": {"parent_id": "p1", "chunk_index": 0}},
              {"_score": 0.8, "_source": {"chunk_index": 0, "text": "orphan chunk"}},
              {"_score": 0.7, "_source": {"parent_id": "p2", "chunk_index": 0}}
            ]
          }
        }
        """;

    mockRestClientResponse(esResponse);

    DTOs.VectorSearchResponse results = vectorService.search("test query", Map.of(), 10, 0, 100, 0.0);

    assertEquals(2, results.hits.size(), "Chunks without parent_id should be skipped");
  }

  @Test
  void testRequestedSizeLimitsDistinctParents() throws Exception {
    String esResponse =
        """
        {
          "hits": {
            "total": {"value": 10},
            "hits": [
              {"_score": 0.9,  "_source": {"parent_id": "p1",  "chunk_index": 0}},
              {"_score": 0.8,  "_source": {"parent_id": "p2",  "chunk_index": 0}},
              {"_score": 0.7,  "_source": {"parent_id": "p3",  "chunk_index": 0}},
              {"_score": 0.6,  "_source": {"parent_id": "p4",  "chunk_index": 0}},
              {"_score": 0.5,  "_source": {"parent_id": "p5",  "chunk_index": 0}},
              {"_score": 0.4,  "_source": {"parent_id": "p6",  "chunk_index": 0}},
              {"_score": 0.3,  "_source": {"parent_id": "p7",  "chunk_index": 0}},
              {"_score": 0.2,  "_source": {"parent_id": "p8",  "chunk_index": 0}},
              {"_score": 0.15, "_source": {"parent_id": "p9",  "chunk_index": 0}},
              {"_score": 0.1,  "_source": {"parent_id": "p10", "chunk_index": 0}}
            ]
          }
        }
        """;

    mockRestClientResponse(esResponse);

    DTOs.VectorSearchResponse results = vectorService.search("test query", Map.of(), 3, 0, 100, 0.0);

    assertEquals(3, results.hits.size(), "Should limit to 3 distinct parents");
    long distinctParents = results.hits.stream().map(r -> r.get("parent_id")).distinct().count();
    assertEquals(3, distinctParents, "Should have exactly 3 distinct parents");
  }

  @Test
  void testEmptyHitsResponseReturnsEmptyList() throws Exception {
    String esResponse =
        """
        {
          "hits": {
            "total": {"value": 0},
            "hits": []
          }
        }
        """;

    mockRestClientResponse(esResponse);

    DTOs.VectorSearchResponse results = vectorService.search("test query", Map.of(), 10, 0, 100, 0.0);

    assertNotNull(results);
    assertTrue(results.hits.isEmpty(), "Empty hits should return empty list");
  }

  @Test
  void testGetExistingFingerprintReturnsNullWhenNotFound() throws Exception {
    String esResponse = """
        {"hits":{"total":{"value":0},"hits":[]}}
        """;

    mockRestClientResponse(esResponse);

    String fingerprint = vectorService.getExistingFingerprint("vector_search_index", "unknown-id");

    assertTrue(fingerprint == null, "Should return null when no fingerprint found");
  }

  @Test
  void testGetExistingFingerprintReturnsValueWhenFound() throws Exception {
    String esResponse =
        """
        {
          "hits": {
            "total": {"value": 1},
            "hits": [
              {"_source": {"fingerprint": "abc123"}}
            ]
          }
        }
        """;

    mockRestClientResponse(esResponse);

    String fingerprint =
        vectorService.getExistingFingerprint("vector_search_index", "some-entity-id");

    assertEquals("abc123", fingerprint);
  }

  @Test
  void testGetExistingFingerprintsBatchReturnsEmptyForNullInput() {
    Map<String, String> result = vectorService.getExistingFingerprintsBatch("index", null);
    assertTrue(result.isEmpty());
  }

  @Test
  void testGetExistingFingerprintsBatchReturnsEmptyForEmptyInput() {
    Map<String, String> result =
        vectorService.getExistingFingerprintsBatch("index", java.util.List.of());
    assertTrue(result.isEmpty());
  }

  @Test
  void testPatchDimensionReplacesDims() throws Exception {
    String mapping =
        """
        {"mappings":{"properties":{"embedding":{"type":"dense_vector","dims":512}}}}
        """;
    String patched = ElasticSearchVectorService.patchDimension(mapping, 1536);
    com.fasterxml.jackson.databind.JsonNode root =
        new com.fasterxml.jackson.databind.ObjectMapper().readTree(patched);
    int dims = root.path("mappings").path("properties").path("embedding").path("dims").asInt();
    assertEquals(1536, dims);
  }

  @Test
  void testPatchDimensionLeavesOtherFieldsUntouched() throws Exception {
    String mapping =
        """
        {"mappings":{"properties":{"embedding":{"type":"dense_vector","dims":512,"similarity":"cosine"}}}}
        """;
    String patched = ElasticSearchVectorService.patchDimension(mapping, 768);
    com.fasterxml.jackson.databind.JsonNode root =
        new com.fasterxml.jackson.databind.ObjectMapper().readTree(patched);
    com.fasterxml.jackson.databind.JsonNode embedding =
        root.path("mappings").path("properties").path("embedding");
    assertEquals(768, embedding.path("dims").asInt());
    assertEquals("dense_vector", embedding.path("type").asText());
    assertEquals("cosine", embedding.path("similarity").asText());
  }

  @Test
  void testPatchDimensionHandlesNoSpaceVariant() throws Exception {
    String mapping =
        """
        {"mappings":{"properties":{"embedding":{"type":"dense_vector","dims":512}}}}
        """;
    String patched = ElasticSearchVectorService.patchDimension(mapping, 384);
    com.fasterxml.jackson.databind.JsonNode root =
        new com.fasterxml.jackson.databind.ObjectMapper().readTree(patched);
    assertEquals(384, root.path("mappings").path("properties").path("embedding").path("dims").asInt());
  }

  private void mockRestClientResponse(String responseJson) throws Exception {
    Response mockResponse = mock(Response.class);
    HttpEntity mockEntity = mock(HttpEntity.class);

    when(mockRestClient.performRequest(any(Request.class))).thenReturn(mockResponse);
    when(mockResponse.getEntity()).thenReturn(mockEntity);
    when(mockEntity.getContent())
        .thenReturn(new ByteArrayInputStream(responseJson.getBytes(StandardCharsets.UTF_8)));
  }
}
