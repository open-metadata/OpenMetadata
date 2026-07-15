package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.entity.data.Table;
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

    when(mockEmbeddingClient.embedQuery(any(String.class)))
        .thenReturn(new float[] {0.1f, 0.2f, 0.3f});

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
  void testLegacyVectorSearchResponseConstructorLeavesPaginationFieldsUnset() {
    DTOs.VectorSearchResponse response =
        new DTOs.VectorSearchResponse(12L, List.of(Map.of("parentId", "parent1")));

    assertEquals(12L, response.tookMillis);
    assertEquals(1, response.hits.size());
    assertNull(response.totalHits);
    assertNull(response.hasMore);
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
  void testSearchFetchesAdditionalPagesUntilEnoughDistinctParentsAreAvailable() throws IOException {
    String firstPage =
        """
        {
          "hits": {
            "total": {"value": 8},
            "hits": [
              {"_id": "c1", "_score": 0.95, "_source": {"parentId": "p1", "chunkIndex": 0}},
              {"_id": "c2", "_score": 0.94, "_source": {"parentId": "p1", "chunkIndex": 1}},
              {"_id": "c3", "_score": 0.93, "_source": {"parentId": "p1", "chunkIndex": 2}},
              {"_id": "c4", "_score": 0.90, "_source": {"parentId": "p2", "chunkIndex": 0}},
              {"_id": "c5", "_score": 0.89, "_source": {"parentId": "p2", "chunkIndex": 1}},
              {"_id": "c6", "_score": 0.88, "_source": {"parentId": "p2", "chunkIndex": 2}}
            ]
          }
        }
        """;
    String secondPage =
        """
        {
          "hits": {
            "total": {"value": 8},
            "hits": [
              {"_id": "c7", "_score": 0.87, "_source": {"parentId": "p3", "chunkIndex": 0}},
              {"_id": "c8", "_score": 0.86, "_source": {"parentId": "p4", "chunkIndex": 0}}
            ]
          }
        }
        """;

    mockOpenSearchResponses(firstPage, secondPage);

    DTOs.VectorSearchResponse results =
        vectorService.search("test query", Map.of(), 3, 0, 100, 0.0);

    long distinctParents = results.hits.stream().map(r -> r.get("parentId")).distinct().count();
    assertEquals(3, distinctParents, "Should fetch a second page to fill 3 distinct parents");
    assertEquals(7, results.hits.size(), "Should return all chunks for the 3 selected parents");
    assertEquals(8L, results.totalHits);
    assertTrue(results.hasMore, "Should report additional parents beyond the returned page");

    ArgumentCaptor<os.org.opensearch.client.opensearch.generic.Request> captor =
        ArgumentCaptor.forClass(os.org.opensearch.client.opensearch.generic.Request.class);
    verify(mockGenericClient, org.mockito.Mockito.times(2)).execute(captor.capture());
    List<os.org.opensearch.client.opensearch.generic.Request> requests = captor.getAllValues();

    String firstBody =
        new String(
            requests.get(0).getBody().orElseThrow().bodyAsBytes(),
            java.nio.charset.StandardCharsets.UTF_8);
    String secondBody =
        new String(
            requests.get(1).getBody().orElseThrow().bodyAsBytes(),
            java.nio.charset.StandardCharsets.UTF_8);
    assertTrue(firstBody.contains("\"from\":0"));
    assertTrue(secondBody.contains("\"from\":6"));
  }

  @Test
  void testSearchSetsHasMoreFalseWhenDistinctParentsAreExhausted() throws IOException {
    String openSearchResponse =
        """
        {
          "hits": {
            "total": {"value": 3},
            "hits": [
              {"_id": "c1", "_score": 0.9, "_source": {"parentId": "p1", "chunkIndex": 0}},
              {"_id": "c2", "_score": 0.8, "_source": {"parentId": "p2", "chunkIndex": 0}},
              {"_id": "c3", "_score": 0.7, "_source": {"parentId": "p3", "chunkIndex": 0}}
            ]
          }
        }
        """;

    mockOpenSearchResponse(openSearchResponse);

    DTOs.VectorSearchResponse results =
        vectorService.search("test query", Map.of(), 2, 1, 100, 0.0);

    assertEquals(2L, results.hits.stream().map(r -> r.get("parentId")).distinct().count());
    assertEquals(3L, results.totalHits);
    assertEquals(Boolean.FALSE, results.hasMore);
  }

  @Test
  void testEnsureHybridSearchPipelineSendsCorrectRequest() throws IOException {
    mockOpenSearchResponse("{\"acknowledged\":true}");

    ArgumentCaptor<os.org.opensearch.client.opensearch.generic.Request> captor =
        ArgumentCaptor.forClass(os.org.opensearch.client.opensearch.generic.Request.class);

    vectorService.ensureHybridSearchPipeline(0.4, 0.6);

    verify(mockGenericClient).execute(captor.capture());
    os.org.opensearch.client.opensearch.generic.Request captured = captor.getValue();

    assertEquals("PUT", captured.getMethod());
    assertEquals("/_search/pipeline/hybrid-rrf", captured.getEndpoint());

    String body =
        new String(captured.getBody().get().bodyAsBytes(), java.nio.charset.StandardCharsets.UTF_8);
    assertTrue(body.contains("\"weights\":[0.4,0.6]"));
    assertTrue(body.contains("\"technique\":\"rrf\""));
    assertTrue(body.contains("\"rank_constant\":30"));
    assertTrue(body.contains("\"score-ranker-processor\""));
    assertTrue(body.contains("\"phase_results_processors\""));
    // The hybrid-rrf pipeline must NOT carry a collapse response processor. Collate's NLQ hybrid
    // search applies a query-level collapse{parentId} in the request body; a pipeline-level
    // collapse
    // on the same field makes OpenSearch reject the request with
    // "Cannot collapse on parentId. Results already collapsed on parentId" (HTTP 500).
    assertFalse(body.contains("\"response_processors\""));
    assertFalse(body.contains("\"collapse\""));
    assertFalse(body.contains("\"parentId\""));
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

  @Test
  void testCheckHybridSearchPipelineReturnsEmptyWhenAvailable() throws IOException {
    mockOpenSearchResponse("{\"hybrid-rrf\":{}}");

    assertTrue(
        vectorService.checkHybridSearchPipeline().isEmpty(),
        "Pipeline should be available when OpenSearch returns 200");
  }

  @Test
  void testCheckHybridSearchPipelineReturnsErrorOn404() throws IOException {
    Response mockResponse = mock(Response.class);
    when(mockResponse.getStatus()).thenReturn(404);
    when(mockResponse.getBody()).thenReturn(Optional.empty());
    when(mockGenericClient.execute(any())).thenReturn(mockResponse);

    Optional<String> result = vectorService.checkHybridSearchPipeline();
    assertTrue(result.isPresent(), "Should return error when pipeline not found");
    assertTrue(result.get().contains("not found"), "Error should mention pipeline not found");
  }

  @Test
  void testCheckHybridSearchPipelineReturnsErrorOn5xx() throws IOException {
    Response mockResponse = mock(Response.class);
    when(mockResponse.getStatus()).thenReturn(500);
    when(mockResponse.getBody()).thenReturn(Optional.empty());
    when(mockGenericClient.execute(any())).thenReturn(mockResponse);

    Optional<String> result = vectorService.checkHybridSearchPipeline();
    assertTrue(result.isPresent(), "Should return error on server error");
    assertTrue(result.get().contains("Unexpected status 500"), "Error should mention status code");
  }

  @Test
  void testCheckHybridSearchPipelineReturnsErrorOnException() throws IOException {
    when(mockGenericClient.execute(any())).thenThrow(new IOException("Connection refused"));

    Optional<String> result = vectorService.checkHybridSearchPipeline();
    assertTrue(result.isPresent(), "Should return error when exception occurs");
    assertTrue(
        result.get().contains("Connection refused"), "Error should include exception message");
  }

  private void mockOpenSearchResponse(String responseJson) throws IOException {
    mockOpenSearchResponses(responseJson);
  }

  private void mockOpenSearchResponses(String... responseJsons) throws IOException {
    Response[] responses = new Response[responseJsons.length];
    for (int i = 0; i < responseJsons.length; i++) {
      Response mockResponse = mock(Response.class);
      os.org.opensearch.client.opensearch.generic.Body mockBody =
          mock(os.org.opensearch.client.opensearch.generic.Body.class);
      when(mockResponse.getStatus()).thenReturn(200);
      when(mockResponse.getBody()).thenReturn(Optional.of(mockBody));
      when(mockBody.bodyAsBytes())
          .thenReturn(responseJsons[i].getBytes(java.nio.charset.StandardCharsets.UTF_8));
      responses[i] = mockResponse;
    }
    if (responses.length == 1) {
      when(mockGenericClient.execute(any())).thenReturn(responses[0]);
    } else {
      when(mockGenericClient.execute(any()))
          .thenReturn(responses[0], java.util.Arrays.copyOfRange(responses, 1, responses.length));
    }
  }

  @Test
  void chunkIndexMapping_hasAnalyzerParityWithEntityIndices() throws Exception {
    Method m = OpenSearchVectorService.class.getDeclaredMethod("buildChunkIndexMapping");
    m.setAccessible(true);
    String body = (String) m.invoke(vectorService);
    JsonNode root = new ObjectMapper().readTree(body);

    // The om_* analyzers must be defined and max_ngram_diff must permit the 3..20 ngram span,
    // otherwise index creation is rejected.
    JsonNode analyzers = root.path("settings").path("analysis").path("analyzer");
    assertTrue(analyzers.has("om_analyzer"), "om_analyzer defined");
    assertTrue(analyzers.has("om_ngram"), "om_ngram defined");
    assertTrue(analyzers.has("om_compound_analyzer"), "om_compound_analyzer defined");
    assertEquals(
        17,
        root.path("settings").path("index").path("max_ngram_diff").asInt(),
        "max_ngram_diff must equal the ngram span (20 - 3)");

    // name must carry an om_analyzer text root plus .compound/.ngram/.keyword subfields so the
    // phrase/compound lexical clauses resolve on chunk docs, not only the exact keyword clause.
    JsonNode name = root.path("mappings").path("properties").path("name");
    assertEquals("om_analyzer", name.path("analyzer").asText(), "name uses om_analyzer");
    assertTrue(name.path("fields").has("compound"), "name.compound subfield present");
    assertTrue(name.path("fields").has("ngram"), "name.ngram subfield present");
    assertEquals(
        "om_analyzer",
        root.path("mappings").path("properties").path("description").path("analyzer").asText(),
        "description uses om_analyzer");

    // Denormalized parity fields still mapped (regression guard carried over from the v1 mapping).
    JsonNode props = root.path("mappings").path("properties");
    assertTrue(props.has("owners"), "owners mapped");
    assertTrue(props.has("columns"), "columns mapped");
    JsonNode schema = props.path("databaseSchema").path("properties");
    assertTrue(
        schema.has("name") && schema.has("displayName"),
        "databaseSchema maps both name and displayName");
    assertTrue(
        root.path("mappings").path("_meta").has("chunkDocVersion"),
        "_meta.chunkDocVersion present");

    // Keyword parity with the entity indices: fullyQualifiedName/serviceType carry the
    // lowercase_normalizer, and fqnParts stays keyword (identifier tokens, not analyzed text).
    assertEquals(
        "lowercase_normalizer",
        props.path("fullyQualifiedName").path("normalizer").asText(),
        "fullyQualifiedName uses lowercase_normalizer");
    assertEquals(
        "lowercase_normalizer",
        props.path("serviceType").path("normalizer").asText(),
        "serviceType uses lowercase_normalizer");
    assertEquals("keyword", props.path("fqnParts").path("type").asText(), "fqnParts stays keyword");
  }

  @Test
  void updateEntityEmbeddingChunks_preservesExistingChunksWhenProviderUnavailable()
      throws IOException {
    when(mockEmbeddingClient.isAvailable()).thenReturn(false);
    // Entity previously had 3 chunks under a now-stale fingerprint; a content change would normally
    // re-embed and replace them. With the provider down, fromEntity() returns empty and the
    // existing
    // chunks must be preserved rather than deleted by replaceChunks().
    mockOpenSearchResponse(
        "{\"found\": true, \"_source\": {\"fingerprint\": \"STALE_FP\", \"chunkCount\": 3, \"docVersion\": 1}}");

    Table entity =
        new Table()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withFullyQualifiedName("svc.db.sch.orders")
            .withDescription("changed description");

    vectorService.updateEntityEmbeddingChunks(entity, "chunkIndex");

    ArgumentCaptor<os.org.opensearch.client.opensearch.generic.Request> captor =
        ArgumentCaptor.forClass(os.org.opensearch.client.opensearch.generic.Request.class);
    verify(mockGenericClient, atLeastOnce()).execute(captor.capture());
    boolean issuedBulk =
        captor.getAllValues().stream()
            .anyMatch(r -> r.getEndpoint() != null && r.getEndpoint().contains("_bulk"));
    assertFalse(
        issuedBulk,
        "must not issue a chunk-delete bulk while the embedding provider is unavailable");
  }
}
