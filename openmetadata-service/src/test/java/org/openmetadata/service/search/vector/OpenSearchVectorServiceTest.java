package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
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

    when(mockEmbeddingClient.embed(any(String.class))).thenReturn(new float[] {0.1f, 0.2f, 0.3f});

    vectorService = new OpenSearchVectorService(mockClient, mockEmbeddingClient);
  }

  @Test
  void testThresholdFilteringRemovesLowScoreResults() throws IOException {
    String openSearchResponse =
        """
        {
          "hits": {
            "total": {"value": 4},
            "hits": [
              {
                "_id": "id1",
                "_score": 0.9,
                "_source": {
                  "parentId": "parent1",
                  "chunkIndex": 0,
                  "text": "High score chunk"
                }
              },
              {
                "_id": "id2",
                "_score": 0.7,
                "_source": {
                  "parentId": "parent2",
                  "chunkIndex": 0,
                  "text": "Medium score chunk"
                }
              },
              {
                "_id": "id3",
                "_score": 0.4,
                "_source": {
                  "parentId": "parent3",
                  "chunkIndex": 0,
                  "text": "Low score chunk"
                }
              },
              {
                "_id": "id4",
                "_score": 0.2,
                "_source": {
                  "parentId": "parent4",
                  "chunkIndex": 0,
                  "text": "Very low score chunk"
                }
              }
            ]
          }
        }
        """;

    mockOpenSearchResponse(openSearchResponse);

    DTOs.VectorSearchResponse results =
        vectorService.search("test query", Map.of(), 10, 0, 100, 0.5);

    assertNotNull(results);
    assertEquals(2, results.hits.size(), "Should return 2 results (scores 0.9 and 0.7)");

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
                "_id": "id1",
                "_score": 0.85,
                "_source": {
                  "parentId": "parent1",
                  "chunkIndex": 0,
                  "text": "Test chunk"
                }
              }
            ]
          }
        }
        """;

    mockOpenSearchResponse(openSearchResponse);

    DTOs.VectorSearchResponse results =
        vectorService.search("test query", Map.of(), 10, 0, 100, 0.0);

    assertEquals(1, results.hits.size());
    assertTrue(results.hits.get(0).containsKey("_score"), "Result should contain _score field");
    assertEquals(0.85, (double) results.hits.get(0).get("_score"), 0.001);
  }

  @Test
  void testParentGroupingLimitsDistinctParents() throws IOException {
    String openSearchResponse =
        """
        {
          "hits": {
            "total": {"value": 8},
            "hits": [
              {"_id": "c1", "_score": 0.9, "_source": {"parentId": "parent1", "chunkIndex": 0}},
              {"_id": "c2", "_score": 0.88, "_source": {"parentId": "parent1", "chunkIndex": 1}},
              {"_id": "c3", "_score": 0.85, "_source": {"parentId": "parent1", "chunkIndex": 2}},
              {"_id": "c4", "_score": 0.8, "_source": {"parentId": "parent2", "chunkIndex": 0}},
              {"_id": "c5", "_score": 0.78, "_source": {"parentId": "parent2", "chunkIndex": 1}},
              {"_id": "c6", "_score": 0.7, "_source": {"parentId": "parent3", "chunkIndex": 0}},
              {"_id": "c7", "_score": 0.68, "_source": {"parentId": "parent3", "chunkIndex": 1}},
              {"_id": "c8", "_score": 0.6, "_source": {"parentId": "parent4", "chunkIndex": 0}}
            ]
          }
        }
        """;

    mockOpenSearchResponse(openSearchResponse);

    DTOs.VectorSearchResponse results =
        vectorService.search("test query", Map.of(), 2, 0, 100, 0.0);

    assertEquals(
        5,
        results.hits.size(),
        "Should return 5 chunks from 2 distinct parents (3 from p1, 2 from p2)");

    long distinctParents = results.hits.stream().map(r -> r.get("parentId")).distinct().count();
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
              {"_id": "id1", "_score": 0.9, "_source": {"parentId": "p1", "chunkIndex": 0}},
              {"_id": "id2", "_score": 0.5, "_source": {"parentId": "p2", "chunkIndex": 0}},
              {"_id": "id3", "_score": 0.1, "_source": {"parentId": "p3", "chunkIndex": 0}}
            ]
          }
        }
        """;

    mockOpenSearchResponse(openSearchResponse);

    DTOs.VectorSearchResponse results =
        vectorService.search("test query", Map.of(), 10, 0, 100, 0.0);

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
              {"_id": "id1", "_score": 0.5, "_source": {"parentId": "p1", "chunkIndex": 0}},
              {"_id": "id2", "_score": 0.3, "_source": {"parentId": "p2", "chunkIndex": 0}},
              {"_id": "id3", "_score": 0.1, "_source": {"parentId": "p3", "chunkIndex": 0}}
            ]
          }
        }
        """;

    mockOpenSearchResponse(openSearchResponse);

    DTOs.VectorSearchResponse results =
        vectorService.search("test query", Map.of(), 10, 0, 100, 0.9);

    assertEquals(0, results.hits.size(), "With threshold 0.9, all results should be filtered out");
  }

  @Test
  void testHitsWithoutParentIdFallBackToDocId() throws IOException {
    String openSearchResponse =
        """
        {
          "hits": {
            "total": {"value": 3},
            "hits": [
              {"_id": "entity1", "_score": 0.9, "_source": {"parentId": "p1", "chunkIndex": 0}},
              {"_id": "entity2", "_score": 0.8, "_source": {"chunkIndex": 0, "text": "no parentId"}},
              {"_id": "entity3", "_score": 0.7, "_source": {"parentId": "p2", "chunkIndex": 0}}
            ]
          }
        }
        """;

    mockOpenSearchResponse(openSearchResponse);

    DTOs.VectorSearchResponse results =
        vectorService.search("test query", Map.of(), 10, 0, 100, 0.0);

    assertEquals(
        3, results.hits.size(), "Hits without parentId should fall back to _id for grouping");
  }

  @Test
  void testRequestedSizeLimitsDistinctParents() throws IOException {
    String openSearchResponse =
        """
        {
          "hits": {
            "total": {"value": 10},
            "hits": [
              {"_id": "id1", "_score": 0.9, "_source": {"parentId": "p1", "chunkIndex": 0}},
              {"_id": "id2", "_score": 0.8, "_source": {"parentId": "p2", "chunkIndex": 0}},
              {"_id": "id3", "_score": 0.7, "_source": {"parentId": "p3", "chunkIndex": 0}},
              {"_id": "id4", "_score": 0.6, "_source": {"parentId": "p4", "chunkIndex": 0}},
              {"_id": "id5", "_score": 0.5, "_source": {"parentId": "p5", "chunkIndex": 0}},
              {"_id": "id6", "_score": 0.4, "_source": {"parentId": "p6", "chunkIndex": 0}},
              {"_id": "id7", "_score": 0.3, "_source": {"parentId": "p7", "chunkIndex": 0}},
              {"_id": "id8", "_score": 0.2, "_source": {"parentId": "p8", "chunkIndex": 0}},
              {"_id": "id9", "_score": 0.15, "_source": {"parentId": "p9", "chunkIndex": 0}},
              {"_id": "id10", "_score": 0.1, "_source": {"parentId": "p10", "chunkIndex": 0}}
            ]
          }
        }
        """;

    mockOpenSearchResponse(openSearchResponse);

    DTOs.VectorSearchResponse results =
        vectorService.search("test query", Map.of(), 3, 0, 100, 0.0);

    assertEquals(3, results.hits.size(), "Should limit to 3 distinct parents");

    long distinctParents = results.hits.stream().map(r -> r.get("parentId")).distinct().count();
    assertEquals(3, distinctParents, "Should have exactly 3 distinct parents");
  }

  @Test
  void testPaginationSkipsParentsCorrectly() throws IOException {
    String openSearchResponse =
        """
        {
          "hits": {
            "total": {"value": 5},
            "hits": [
              {"_id": "c1", "_score": 0.9, "_source": {"parentId": "p1", "chunkIndex": 0}},
              {"_id": "c2", "_score": 0.85, "_source": {"parentId": "p1", "chunkIndex": 1}},
              {"_id": "c3", "_score": 0.8, "_source": {"parentId": "p2", "chunkIndex": 0}},
              {"_id": "c4", "_score": 0.7, "_source": {"parentId": "p3", "chunkIndex": 0}},
              {"_id": "c5", "_score": 0.6, "_source": {"parentId": "p4", "chunkIndex": 0}}
            ]
          }
        }
        """;

    mockOpenSearchResponse(openSearchResponse);

    DTOs.VectorSearchResponse results =
        vectorService.search("test query", Map.of(), 2, 1, 100, 0.0);

    long distinctParents = results.hits.stream().map(r -> r.get("parentId")).distinct().count();
    assertEquals(2, distinctParents, "Should return 2 distinct parents");
    assertEquals(
        "p2",
        results.hits.get(0).get("parentId"),
        "First result should be p2 (skipping p1 due to from=1)");
    assertEquals("p3", results.hits.get(1).get("parentId"), "Second result should be p3");
  }

  @Test
  void testPaginationFromBeyondResultsReturnsEmpty() throws IOException {
    String openSearchResponse =
        """
        {
          "hits": {
            "total": {"value": 2},
            "hits": [
              {"_id": "c1", "_score": 0.9, "_source": {"parentId": "p1", "chunkIndex": 0}},
              {"_id": "c2", "_score": 0.8, "_source": {"parentId": "p2", "chunkIndex": 0}}
            ]
          }
        }
        """;

    mockOpenSearchResponse(openSearchResponse);

    DTOs.VectorSearchResponse results =
        vectorService.search("test query", Map.of(), 5, 10, 100, 0.0);

    assertEquals(
        0, results.hits.size(), "Should return no results when from exceeds available parents");
  }

  @Test
  void testEnsureHybridSearchPipelineSendsCorrectRequest() throws IOException {
    mockOpenSearchResponse("{\"acknowledged\":true}");

    ArgumentCaptor<os.org.opensearch.client.opensearch.generic.Request> captor =
        ArgumentCaptor.forClass(os.org.opensearch.client.opensearch.generic.Request.class);

    vectorService.ensureHybridSearchPipeline(0.6, 0.4);

    verify(mockGenericClient).execute(captor.capture());
    os.org.opensearch.client.opensearch.generic.Request captured = captor.getValue();

    assertEquals("PUT", captured.getMethod());
    assertEquals("/_search/pipeline/hybrid-rrf", captured.getEndpoint());

    String body =
        new String(captured.getBody().get().bodyAsBytes(), java.nio.charset.StandardCharsets.UTF_8);
    assertTrue(body.contains("\"weights\":[0.6,0.4]"));
    assertTrue(body.contains("\"technique\":\"rrf\""));
    assertTrue(body.contains("\"rank_constant\":60"));
    assertTrue(body.contains("\"collapse\""));
    assertTrue(body.contains("\"parentId\""));
  }

  @Test
  void testEnsureHybridSearchPipelineWithCustomWeights() throws IOException {
    mockOpenSearchResponse("{\"acknowledged\":true}");

    ArgumentCaptor<os.org.opensearch.client.opensearch.generic.Request> captor =
        ArgumentCaptor.forClass(os.org.opensearch.client.opensearch.generic.Request.class);

    vectorService.ensureHybridSearchPipeline(0.3, 0.7);

    verify(mockGenericClient).execute(captor.capture());
    os.org.opensearch.client.opensearch.generic.Request captured = captor.getValue();

    String body =
        new String(captured.getBody().get().bodyAsBytes(), java.nio.charset.StandardCharsets.UTF_8);
    assertTrue(
        body.contains("\"weights\":[0.3,0.7]"),
        "Pipeline body should contain custom weights [0.3,0.7]");
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
