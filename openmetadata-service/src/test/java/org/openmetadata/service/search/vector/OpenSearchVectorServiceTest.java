package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.openmetadata.service.search.vector.utils.DTOs;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.generic.OpenSearchGenericClient;
import os.org.opensearch.client.opensearch.generic.Response;

class OpenSearchVectorServiceTest {

  private OpenSearchVectorService vectorService;
  private OpenSearchClient mockClient;
  private EmbeddingClient mockEmbeddingClient;
  private OpenSearchGenericClient mockGenericClient;

  @BeforeEach
  void setup() {
    mockClient = mock(OpenSearchClient.class);
    mockEmbeddingClient = mock(EmbeddingClient.class);
    mockGenericClient = mock(OpenSearchGenericClient.class);

    when(mockClient.generic()).thenReturn(mockGenericClient);

    // Mock embedding client to return dummy vector
    when(mockEmbeddingClient.embed(any(String.class))).thenReturn(new float[] {0.1f, 0.2f, 0.3f});

    vectorService = new OpenSearchVectorService(mockClient, mockEmbeddingClient);
  }

  @Test
  void testThresholdFilteringRemovesLowScoreResults() throws IOException {
    // Mock OpenSearch response with varying scores
    String openSearchResponse =
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

    mockOpenSearchResponse(openSearchResponse);

    // Search with threshold 0.5 - should filter out chunks with score < 0.5
    DTOs.VectorSearchResponse results = vectorService.search("test query", Map.of(), 10, 100, 0.5);

    assertNotNull(results);
    assertEquals(2, results.hits.size(), "Should return 2 results (scores 0.9 and 0.7)");

    // Verify all results have score >= 0.5
    for (Map<String, Object> result : results.hits) {
      double score = (double) result.get("_score");
      assertTrue(score >= 0.5, "All results should have score >= 0.5, got: " + score);
    }
  }

  @Test
  void testScoreFieldIncludedInResults() throws IOException {
    String openSearchResponse =
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

    mockOpenSearchResponse(openSearchResponse);

    DTOs.VectorSearchResponse results = vectorService.search("test query", Map.of(), 10, 100, 0.0);

    assertEquals(1, results.hits.size());
    assertTrue(results.hits.get(0).containsKey("_score"), "Result should contain _score field");
    assertEquals(0.85, (double) results.hits.get(0).get("_score"), 0.001);
  }

  @Test
  void testParentGroupingLimitsDistinctParents() throws IOException {
    // Mock response with multiple chunks from same parents
    String openSearchResponse =
        """
        {
          "hits": {
            "total": {"value": 8},
            "hits": [
              {"_score": 0.9, "_source": {"parent_id": "parent1", "chunk_index": 0}},
              {"_score": 0.88, "_source": {"parent_id": "parent1", "chunk_index": 1}},
              {"_score": 0.85, "_source": {"parent_id": "parent1", "chunk_index": 2}},
              {"_score": 0.8, "_source": {"parent_id": "parent2", "chunk_index": 0}},
              {"_score": 0.78, "_source": {"parent_id": "parent2", "chunk_index": 1}},
              {"_score": 0.7, "_source": {"parent_id": "parent3", "chunk_index": 0}},
              {"_score": 0.68, "_source": {"parent_id": "parent3", "chunk_index": 1}},
              {"_score": 0.6, "_source": {"parent_id": "parent4", "chunk_index": 0}}
            ]
          }
        }
        """;

    mockOpenSearchResponse(openSearchResponse);

    // Request 2 distinct parents
    DTOs.VectorSearchResponse results = vectorService.search("test query", Map.of(), 2, 100, 0.0);

    // Should return all chunks from first 2 parents (parent1: 3 chunks, parent2: 2 chunks = 5
    // total)
    assertEquals(
        5,
        results.hits.size(),
        "Should return 5 chunks from 2 distinct parents (3 from p1, 2 from p2)");

    // Verify we got chunks from exactly 2 parents
    long distinctParents = results.hits.stream().map(r -> r.get("parent_id")).distinct().count();
    assertEquals(2, distinctParents, "Should have chunks from exactly 2 distinct parents");
  }

  @Test
  void testZeroThresholdReturnsAllResults() throws IOException {
    String openSearchResponse =
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

    mockOpenSearchResponse(openSearchResponse);

    DTOs.VectorSearchResponse results = vectorService.search("test query", Map.of(), 10, 100, 0.0);

    assertEquals(3, results.hits.size(), "With threshold 0.0, should return all 3 results");
  }

  @Test
  void testHighThresholdFiltersAllResults() throws IOException {
    String openSearchResponse =
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

    mockOpenSearchResponse(openSearchResponse);

    DTOs.VectorSearchResponse results = vectorService.search("test query", Map.of(), 10, 100, 0.9);

    assertEquals(0, results.hits.size(), "With threshold 0.9, all results should be filtered out");
  }

  @Test
  void testChunksWithoutParentIdAreSkipped() throws IOException {
    String openSearchResponse =
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

    mockOpenSearchResponse(openSearchResponse);

    DTOs.VectorSearchResponse results = vectorService.search("test query", Map.of(), 10, 100, 0.0);

    assertEquals(2, results.hits.size(), "Chunks without parent_id should be skipped");
  }

  @Test
  void testRequestedSizeLimitsDistinctParents() throws IOException {
    // 10 distinct parents, request only 3
    String openSearchResponse =
        """
        {
          "hits": {
            "total": {"value": 10},
            "hits": [
              {"_score": 0.9, "_source": {"parent_id": "p1", "chunk_index": 0}},
              {"_score": 0.8, "_source": {"parent_id": "p2", "chunk_index": 0}},
              {"_score": 0.7, "_source": {"parent_id": "p3", "chunk_index": 0}},
              {"_score": 0.6, "_source": {"parent_id": "p4", "chunk_index": 0}},
              {"_score": 0.5, "_source": {"parent_id": "p5", "chunk_index": 0}},
              {"_score": 0.4, "_source": {"parent_id": "p6", "chunk_index": 0}},
              {"_score": 0.3, "_source": {"parent_id": "p7", "chunk_index": 0}},
              {"_score": 0.2, "_source": {"parent_id": "p8", "chunk_index": 0}},
              {"_score": 0.15, "_source": {"parent_id": "p9", "chunk_index": 0}},
              {"_score": 0.1, "_source": {"parent_id": "p10", "chunk_index": 0}}
            ]
          }
        }
        """;

    mockOpenSearchResponse(openSearchResponse);

    DTOs.VectorSearchResponse results = vectorService.search("test query", Map.of(), 3, 100, 0.0);

    assertEquals(3, results.hits.size(), "Should limit to 3 distinct parents");

    long distinctParents = results.hits.stream().map(r -> r.get("parent_id")).distinct().count();
    assertEquals(3, distinctParents, "Should have exactly 3 distinct parents");
  }

  private void mockOpenSearchResponse(String responseJson) throws IOException {
    Response mockResponse = mock(Response.class);
    os.org.opensearch.client.opensearch.generic.Body mockBody =
        mock(os.org.opensearch.client.opensearch.generic.Body.class);

    when(mockGenericClient.execute(any())).thenReturn(mockResponse);
    when(mockResponse.getStatus()).thenReturn(200);
    when(mockResponse.getBody()).thenReturn(Optional.of(mockBody));
    when(mockBody.bodyAsBytes())
        .thenReturn(responseJson.getBytes(java.nio.charset.StandardCharsets.UTF_8));
  }
}
