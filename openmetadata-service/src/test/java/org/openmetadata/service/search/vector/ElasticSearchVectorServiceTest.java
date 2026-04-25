package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;

import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.transport.rest5_client.Rest5ClientTransport;
import es.co.elastic.clients.transport.rest5_client.low_level.Request;
import es.co.elastic.clients.transport.rest5_client.low_level.Response;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.apache.hc.core5.http.HttpEntity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.openmetadata.service.search.vector.utils.DTOs;

class ElasticSearchVectorServiceTest {

  private static final String EMPTY_HITS_RESPONSE =
      "{\"hits\":{\"total\":{\"value\":0},\"hits\":[]}}";

  private ElasticSearchVectorService vectorService;
  private ElasticsearchClient mockEsClient;
  private Rest5Client mockRestClient;
  private EmbeddingClient mockEmbeddingClient;

  @BeforeEach
  void setup() throws Exception {
    mockEsClient = mock(ElasticsearchClient.class);
    Rest5ClientTransport mockTransport = mock(Rest5ClientTransport.class);
    mockRestClient = mock(Rest5Client.class);

    when(mockEsClient._transport()).thenReturn(mockTransport);
    when(mockTransport.restClient()).thenReturn(mockRestClient);

    mockEmbeddingClient = mock(EmbeddingClient.class);
    when(mockEmbeddingClient.embed(any(String.class))).thenReturn(new float[] {0.1f, 0.2f, 0.3f});

    vectorService = new ElasticSearchVectorService(mockEsClient, mockEmbeddingClient);
  }

  @Test
  void testThresholdFilteringRemovesLowScoreResults() throws Exception {
    String esResponse =
        """
        {
          "hits": {
            "total": {"value": 4},
            "hits": [
              {"_score": 0.9, "_source": {"parentId": "parent1", "chunkIndex": 0, "text": "High score chunk"}},
              {"_score": 0.7, "_source": {"parentId": "parent2", "chunkIndex": 0, "text": "Medium score chunk"}},
              {"_score": 0.4, "_source": {"parentId": "parent3", "chunkIndex": 0, "text": "Low score chunk"}},
              {"_score": 0.2, "_source": {"parentId": "parent4", "chunkIndex": 0, "text": "Very low score chunk"}}
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
              {"_score": 0.85, "_source": {"parentId": "parent1", "chunkIndex": 0, "text": "Test chunk"}}
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
    // size=2 → requestedParents=3; 4 distinct parents in response causes loop to exit after 1 page
    String esResponse =
        """
        {
          "hits": {
            "total": {"value": 8},
            "hits": [
              {"_score": 0.9,  "_source": {"parentId": "parent1", "chunkIndex": 0}},
              {"_score": 0.88, "_source": {"parentId": "parent1", "chunkIndex": 1}},
              {"_score": 0.85, "_source": {"parentId": "parent1", "chunkIndex": 2}},
              {"_score": 0.8,  "_source": {"parentId": "parent2", "chunkIndex": 0}},
              {"_score": 0.78, "_source": {"parentId": "parent2", "chunkIndex": 1}},
              {"_score": 0.7,  "_source": {"parentId": "parent3", "chunkIndex": 0}},
              {"_score": 0.68, "_source": {"parentId": "parent3", "chunkIndex": 1}},
              {"_score": 0.6,  "_source": {"parentId": "parent4", "chunkIndex": 0}}
            ]
          }
        }
        """;

    mockRestClientResponse(esResponse);

    DTOs.VectorSearchResponse results = vectorService.search("test query", Map.of(), 2, 0, 100, 0.0);

    assertEquals(5, results.hits.size(), "Should return all chunks from first 2 parents (3+2=5)");
    long distinctParents = results.hits.stream().map(r -> r.get("parentId")).distinct().count();
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
              {"_score": 0.9, "_source": {"parentId": "p1", "chunkIndex": 0}},
              {"_score": 0.5, "_source": {"parentId": "p2", "chunkIndex": 0}},
              {"_score": 0.1, "_source": {"parentId": "p3", "chunkIndex": 0}}
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
              {"_score": 0.5, "_source": {"parentId": "p1", "chunkIndex": 0}},
              {"_score": 0.3, "_source": {"parentId": "p2", "chunkIndex": 0}},
              {"_score": 0.1, "_source": {"parentId": "p3", "chunkIndex": 0}}
            ]
          }
        }
        """;

    mockRestClientResponse(esResponse);

    DTOs.VectorSearchResponse results = vectorService.search("test query", Map.of(), 10, 0, 100, 0.9);

    assertEquals(0, results.hits.size(), "With threshold 0.9, all results should be filtered out");
  }

  @Test
  void testChunksWithoutParentIdGroupedByDocumentId() throws Exception {
    // Chunks without parentId in _source fall back to the document's _id field
    String esResponse =
        """
        {
          "hits": {
            "total": {"value": 3},
            "hits": [
              {"_score": 0.9, "_source": {"parentId": "p1", "chunkIndex": 0}},
              {"_id": "orphan-123", "_score": 0.8, "_source": {"chunkIndex": 0, "text": "orphan chunk"}},
              {"_score": 0.7, "_source": {"parentId": "p2", "chunkIndex": 0}}
            ]
          }
        }
        """;

    mockRestClientResponse(esResponse);

    DTOs.VectorSearchResponse results = vectorService.search("test query", Map.of(), 10, 0, 100, 0.0);

    assertEquals(3, results.hits.size(), "Orphan chunk should be included, grouped by document _id");
  }

  @Test
  void testRequestedSizeLimitsDistinctParents() throws Exception {
    // size=3 → requestedParents=4; 10 distinct parents in response exits loop immediately
    String esResponse =
        """
        {
          "hits": {
            "total": {"value": 10},
            "hits": [
              {"_score": 0.9,  "_source": {"parentId": "p1",  "chunkIndex": 0}},
              {"_score": 0.8,  "_source": {"parentId": "p2",  "chunkIndex": 0}},
              {"_score": 0.7,  "_source": {"parentId": "p3",  "chunkIndex": 0}},
              {"_score": 0.6,  "_source": {"parentId": "p4",  "chunkIndex": 0}},
              {"_score": 0.5,  "_source": {"parentId": "p5",  "chunkIndex": 0}},
              {"_score": 0.4,  "_source": {"parentId": "p6",  "chunkIndex": 0}},
              {"_score": 0.3,  "_source": {"parentId": "p7",  "chunkIndex": 0}},
              {"_score": 0.2,  "_source": {"parentId": "p8",  "chunkIndex": 0}},
              {"_score": 0.15, "_source": {"parentId": "p9",  "chunkIndex": 0}},
              {"_score": 0.1,  "_source": {"parentId": "p10", "chunkIndex": 0}}
            ]
          }
        }
        """;

    mockRestClientResponse(esResponse);

    DTOs.VectorSearchResponse results = vectorService.search("test query", Map.of(), 3, 0, 100, 0.0);

    assertEquals(3, results.hits.size(), "Should limit to 3 distinct parents");
    long distinctParents = results.hits.stream().map(r -> r.get("parentId")).distinct().count();
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
  void testFromSkipsParentsNotChunks() throws Exception {
    // from=1 should skip 1 parent (p1), not 1 raw chunk
    // size=2, from=1 → requestedParents=4; 4 distinct parents in response exits loop after 1 page
    String esResponse =
        """
        {
          "hits": {
            "total": {"value": 4},
            "hits": [
              {"_score": 0.9, "_source": {"parentId": "p1", "chunkIndex": 0}},
              {"_score": 0.8, "_source": {"parentId": "p2", "chunkIndex": 0}},
              {"_score": 0.7, "_source": {"parentId": "p3", "chunkIndex": 0}},
              {"_score": 0.6, "_source": {"parentId": "p4", "chunkIndex": 0}}
            ]
          }
        }
        """;

    mockRestClientResponse(esResponse);

    DTOs.VectorSearchResponse results = vectorService.search("test query", Map.of(), 2, 1, 100, 0.0);

    assertEquals(2, results.hits.size(), "Should return 2 parents after skipping 1");
    assertEquals("p2", results.hits.get(0).get("parentId"));
    assertEquals("p3", results.hits.get(1).get("parentId"));
  }

  @Test
  void testHasMoreTrueWhenExtraParentFetched() throws Exception {
    // size=2, from=0 → requestedParents=3; 4 parents fetched → hasMore=true
    String esResponse =
        """
        {
          "hits": {
            "total": {"value": 4},
            "hits": [
              {"_score": 0.9, "_source": {"parentId": "p1", "chunkIndex": 0}},
              {"_score": 0.8, "_source": {"parentId": "p2", "chunkIndex": 0}},
              {"_score": 0.7, "_source": {"parentId": "p3", "chunkIndex": 0}},
              {"_score": 0.6, "_source": {"parentId": "p4", "chunkIndex": 0}}
            ]
          }
        }
        """;

    mockRestClientResponse(esResponse);

    DTOs.VectorSearchResponse results = vectorService.search("test query", Map.of(), 2, 0, 100, 0.0);

    assertEquals(2, results.hits.size());
    assertTrue(results.hasMore, "hasMore should be true when extra parent was fetched");
  }

  @Test
  void testHasMoreFalseWhenNoExtraParent() throws Exception {
    // size=10, from=0 → requestedParents=11; only 2 parents available → hasMore=false
    String esResponse =
        """
        {
          "hits": {
            "total": {"value": 2},
            "hits": [
              {"_score": 0.9, "_source": {"parentId": "p1", "chunkIndex": 0}},
              {"_score": 0.8, "_source": {"parentId": "p2", "chunkIndex": 0}}
            ]
          }
        }
        """;

    mockRestClientResponse(esResponse);

    DTOs.VectorSearchResponse results = vectorService.search("test query", Map.of(), 10, 0, 100, 0.0);

    assertEquals(2, results.hits.size());
    assertFalse(results.hasMore, "hasMore should be false when fewer parents than requested");
  }

  @Test
  void testTotalHitsPopulatedFromResponse() throws Exception {
    String esResponse =
        """
        {
          "hits": {
            "total": {"value": 3},
            "hits": [
              {"_score": 0.9, "_source": {"parentId": "p1", "chunkIndex": 0}},
              {"_score": 0.8, "_source": {"parentId": "p2", "chunkIndex": 0}},
              {"_score": 0.7, "_source": {"parentId": "p3", "chunkIndex": 0}}
            ]
          }
        }
        """;

    mockRestClientResponse(esResponse);

    DTOs.VectorSearchResponse results = vectorService.search("test query", Map.of(), 10, 0, 100, 0.0);

    assertEquals(Long.valueOf(3), results.totalHits);
  }

  @Test
  void testTotalHitsNullWhenMissingFromResponse() throws Exception {
    // No "total" field in first response; second call returns empty to terminate the loop
    String esResponse =
        """
        {
          "hits": {
            "hits": [
              {"_score": 0.9, "_source": {"parentId": "p1", "chunkIndex": 0}}
            ]
          }
        }
        """;

    mockRestClientResponseSequence(esResponse, EMPTY_HITS_RESPONSE);

    DTOs.VectorSearchResponse results = vectorService.search("test query", Map.of(), 10, 0, 100, 0.0);

    assertNull(results.totalHits, "totalHits should be null when not present in response");
  }

  @Test
  void testGetExistingFingerprintReturnsNullWhenNotFound() throws Exception {
    String esResponse = "{\"hits\":{\"total\":{\"value\":0},\"hits\":[]}}";

    mockRestClientResponse(esResponse);

    String fingerprint = vectorService.getExistingFingerprint("vector_search_index", "unknown-id");

    assertNull(fingerprint, "Should return null when no fingerprint found");
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

  /** Returns a fresh stream on every call — safe for multi-iteration loops. */
  private void mockRestClientResponse(String responseJson) throws Exception {
    Response mockResponse = mock(Response.class);
    HttpEntity mockEntity = mock(HttpEntity.class);
    when(mockRestClient.performRequest(any(Request.class))).thenReturn(mockResponse);
    when(mockResponse.getEntity()).thenReturn(mockEntity);
    when(mockEntity.getContent())
        .thenAnswer(
            inv -> new ByteArrayInputStream(responseJson.getBytes(StandardCharsets.UTF_8)));
  }

  @Test
  void testNumCandidatesMultiplierFromConfigIsApplied() throws Exception {
    int configuredMultiplier = 5;
    int k = 50;
    // num_candidates = max(50 * 5, 100) = 250
    int expectedNumCandidates = 250;

    ElasticSearchVectorService svc =
        new ElasticSearchVectorService(mockEsClient, mockEmbeddingClient, "en", configuredMultiplier);

    List<String> capturedBodies = new java.util.ArrayList<>();
    Response mockResponse = mock(Response.class);
    HttpEntity mockEntity = mock(HttpEntity.class);
    when(mockRestClient.performRequest(any(Request.class)))
        .thenAnswer(
            inv -> {
              Request req = inv.getArgument(0);
              org.apache.hc.core5.http.HttpEntity entity = req.getEntity();
              if (entity != null) {
                try (java.io.InputStream is = entity.getContent()) {
                  capturedBodies.add(new String(is.readAllBytes(), StandardCharsets.UTF_8));
                }
              }
              return mockResponse;
            });
    when(mockResponse.getEntity()).thenReturn(mockEntity);
    when(mockEntity.getContent())
        .thenAnswer(
            inv -> new ByteArrayInputStream(EMPTY_HITS_RESPONSE.getBytes(StandardCharsets.UTF_8)));

    svc.search("test query", Map.of(), 10, 0, k, 0.0);

    assertFalse(capturedBodies.isEmpty(), "Expected at least one request to be captured");
    String requestBody = capturedBodies.get(0);
    assertTrue(
        requestBody.contains("\"num_candidates\":" + expectedNumCandidates),
        "Expected num_candidates=" + expectedNumCandidates + " in: " + requestBody);
  }

  /** Returns each response in sequence; repeats the last one if more calls are made. */
  private void mockRestClientResponseSequence(String... responses) throws Exception {
    Response mockResponse = mock(Response.class);
    HttpEntity mockEntity = mock(HttpEntity.class);
    AtomicInteger callCount = new AtomicInteger(0);
    when(mockRestClient.performRequest(any(Request.class))).thenReturn(mockResponse);
    when(mockResponse.getEntity()).thenReturn(mockEntity);
    when(mockEntity.getContent())
        .thenAnswer(
            inv -> {
              int idx = Math.min(callCount.getAndIncrement(), responses.length - 1);
              return new ByteArrayInputStream(responses[idx].getBytes(StandardCharsets.UTF_8));
            });
  }
}
