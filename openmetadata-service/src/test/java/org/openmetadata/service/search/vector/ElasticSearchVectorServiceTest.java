package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.transport.rest5_client.Rest5ClientTransport;
import es.co.elastic.clients.transport.rest5_client.low_level.Request;
import es.co.elastic.clients.transport.rest5_client.low_level.Response;
import es.co.elastic.clients.transport.rest5_client.low_level.ResponseException;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.apache.hc.core5.http.HttpEntity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.openmetadata.service.search.vector.utils.DTOs;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

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
    when(mockEmbeddingClient.embedQuery(any(String.class)))
        .thenReturn(new float[] {0.1f, 0.2f, 0.3f});

    vectorService = new ElasticSearchVectorService(mockEsClient, mockEmbeddingClient);
  }

  @Test
  void readableAnchorsAreResolvedOnceAndReachEveryOverfetchPage() throws Exception {
    String anchorId = UUID.randomUUID().toString();
    AtomicInteger resolutions = new AtomicInteger();
    ElasticSearchVectorService service =
        new ElasticSearchVectorService(
            mockEsClient,
            mockEmbeddingClient,
            2,
            parameters -> {
              resolutions.incrementAndGet();
              return Set.of(anchorId);
            });
    String firstPage =
        "{\"hits\":{\"total\":{\"value\":2},\"hits\":[{\"_score\":0.9,\"_source\":{\"parentId\":\"first\"}}]}}";
    String secondPage =
        "{\"hits\":{\"total\":{\"value\":2},\"hits\":[{\"_score\":0.8,\"_source\":{\"parentId\":\"second\"}}]}}";
    mockRestClientResponseSequence(firstPage, secondPage);
    SubjectContext subject =
        new SubjectContext(new User().withId(UUID.randomUUID()).withName("reader"), null);
    VectorSearchParameters parameters =
        new VectorSearchParameters(
            "orders",
            Map.of("primaryEntityId", List.of(anchorId)),
            1,
            0,
            10,
            0,
            null,
            subject,
            null);

    DTOs.VectorSearchResponse response = service.search(parameters);

    assertEquals(1, resolutions.get());
    assertEquals("first", response.hits.getFirst().get("parentId"));
    assertTrue(response.hasMore);
    ArgumentCaptor<Request> captor = ArgumentCaptor.forClass(Request.class);
    verify(mockRestClient, times(2)).performRequest(captor.capture());
    List<Request> requests = captor.getAllValues();
    for (int i = 0; i < requests.size(); i++) {
      try (var content = requests.get(i).getEntity().getContent()) {
        var body = JsonUtils.readTree(new String(content.readAllBytes(), StandardCharsets.UTF_8));
        String visibility = body.path("knn").path("filter").path("bool").path("filter").toString();
        assertTrue(visibility.contains("\"anchorId\":[\"" + anchorId + "\"]"), visibility);
        assertEquals(i, body.path("from").asInt());
      }
    }
  }

  @Test
  void searchEmbedsTheQueryAsAQueryNotADocument() throws Exception {
    // Providers that distinguish the two (Cohere on Bedrock: search_query vs search_document)
    // return a worse vector for a question embedded as a document, so the query path must not
    // fall back to embed(). The OpenSearch path has always used embedQuery.
    mockRestClientResponse(EMPTY_HITS_RESPONSE);

    vectorService.search("test query", Map.of(), 10, 0, 100, 0.0);

    verify(mockEmbeddingClient).embedQuery("test query");
    verify(mockEmbeddingClient, never()).embed("test query");
  }

  @Test
  void testParentIdFallbackToDocIdIsWrittenIntoResultMap() throws Exception {
    // _source has no parentId; collectSearchHits falls back to the document _id for grouping.
    // The fallback must also be persisted into the hit map — SemanticSearchTool.cleanHit
    // (MCP consumer) does copyIfPresent("parentId"), so a missing key silently drops it
    // from MCP responses.
    String esResponse =
        """
        {
          "hits": {
            "total": {"value": 1},
            "hits": [
              {"_id": "doc-fallback-id", "_score": 0.9, "_source": {"chunkIndex": 0}}
            ]
          }
        }
        """;

    mockRestClientResponse(esResponse);

    DTOs.VectorSearchResponse results =
        vectorService.search("test query", Map.of(), 10, 0, 100, 0.0);

    assertEquals(1, results.hits.size());
    Map<String, Object> hit = results.hits.get(0);
    assertEquals(
        "doc-fallback-id",
        hit.get("parentId"),
        "Result map must carry the fallback parentId (= _id) when _source has none");
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

    DTOs.VectorSearchResponse results =
        vectorService.search("test query", Map.of(), 10, 0, 100, 0.0);

    assertEquals(
        3, results.hits.size(), "Orphan chunk should be included, grouped by document _id");
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

    DTOs.VectorSearchResponse results =
        vectorService.search("test query", Map.of(), 10, 0, 100, 0.0);

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

    DTOs.VectorSearchResponse results =
        vectorService.search("test query", Map.of(), 2, 1, 100, 0.0);

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

    DTOs.VectorSearchResponse results =
        vectorService.search("test query", Map.of(), 2, 0, 100, 0.0);

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

    DTOs.VectorSearchResponse results =
        vectorService.search("test query", Map.of(), 10, 0, 100, 0.0);

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

    DTOs.VectorSearchResponse results =
        vectorService.search("test query", Map.of(), 10, 0, 100, 0.0);

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

    DTOs.VectorSearchResponse results =
        vectorService.search("test query", Map.of(), 10, 0, 100, 0.0);

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

  @Test
  void aClientErrorWithoutABodySurfacesItsStatus() throws Exception {
    // Some Elasticsearch endpoints answer 4xx with no entity at all.
    Response noBody = mock(Response.class);
    when(noBody.getStatusCode()).thenReturn(400);
    when(noBody.getEntity()).thenReturn(null);
    when(mockRestClient.performRequest(any(Request.class))).thenReturn(noBody);

    RuntimeException error =
        assertThrows(
            RuntimeException.class,
            () -> vectorService.executeGenericRequest("GET", "/_some/path", null));

    assertEquals("Elasticsearch generic request failed", error.getMessage());
    assertEquals(
        "Elasticsearch request failed with status 400: no body", error.getCause().getMessage());
  }

  @Test
  void aServerErrorThrownByTheClientSurfacesItsStatusAndBody() throws Exception {
    // Rest5Client returns 4xx responses but throws 5xx ones.
    ResponseException thrown = mock(ResponseException.class);
    Response unavailable = response(503, "{\"error\":\"unavailable\"}");
    when(thrown.getResponse()).thenReturn(unavailable);
    when(mockRestClient.performRequest(any(Request.class))).thenThrow(thrown);

    RuntimeException error =
        assertThrows(
            RuntimeException.class,
            () -> vectorService.executeGenericRequest("GET", "/_some/path", null));

    assertEquals(
        "Elasticsearch request failed with status 503: {\"error\":\"unavailable\"}",
        error.getCause().getMessage());
  }

  @Test
  void theChunkIndexMapsTheEmbeddingAsADenseVector() throws Exception {
    when(mockEmbeddingClient.getDimension()).thenReturn(3);
    Response noSuchIndex = response(404, "{\"status\":404}");
    answerByEndpointSuffix(Map.of("/_alias", noSuchIndex));

    vectorService.writeEntityChunks("parent-1", List.of(), null);

    JsonNode index = bodyOf(sentRequest("PUT", "/data_asset_embeddings_chunks"));
    JsonNode properties = index.path("mappings").path("properties");
    assertEquals(
        "{\"type\":\"dense_vector\",\"dims\":3,\"index\":true,\"similarity\":\"cosine\"}",
        properties.path("embedding").toString());
    assertEquals("{\"type\":\"keyword\"}", properties.path("parentId").toString());
    assertEquals("{\"dataAssetEmbeddings\":{}}", index.path("aliases").toString());
    assertFalse(
        index.has("settings"), "index.knn is an OpenSearch setting; Elasticsearch has none");
  }

  @Test
  void passagesOfOneParentComeFromAKnnSearchFilteredToItsChunks() throws Exception {
    Response chunkHits =
        response(
            200,
            "{\"hits\":{\"hits\":[{\"_source\":{\"textToLLMContext\":\"Retention is 30 days\"}}]}}");
    answerByEndpointSuffix(Map.of("/_search", chunkHits));

    List<String> passages = vectorService.searchChunksByParent("parent-1", "retention", 2, null);

    assertEquals(List.of("Retention is 30 days"), passages);
    JsonNode search = bodyOf(sentRequest("POST", "/data_asset_embeddings_chunks/_search"));
    JsonNode knn = search.path("knn");
    assertEquals(2, search.path("size").asInt());
    assertFalse(search.has("query"), "Elasticsearch takes knn as a top-level clause");
    assertEquals("embedding", knn.path("field").asText());
    assertEquals("[0.1,0.2,0.3]", knn.path("query_vector").toString());
    assertEquals(2, knn.path("k").asInt());
    assertEquals(100, knn.path("num_candidates").asInt());
    assertEquals(
        "[{\"term\":{\"deleted\":false}},{\"term\":{\"parentId\":\"parent-1\"}}]",
        knn.path("filter").path("bool").path("must").toString());
  }

  /** Answers a request from the rule its endpoint ends with, and any other with 200 and {}. */
  private void answerByEndpointSuffix(Map<String, Response> responsesBySuffix) throws Exception {
    Response ok = response(200, "{}");
    when(mockRestClient.performRequest(any(Request.class)))
        .thenAnswer(
            invocation -> {
              String endpoint = invocation.<Request>getArgument(0).getEndpoint();
              return responsesBySuffix.entrySet().stream()
                  .filter(rule -> endpoint.endsWith(rule.getKey()))
                  .map(Map.Entry::getValue)
                  .findFirst()
                  .orElse(ok);
            });
  }

  private static Response response(int status, String json) throws Exception {
    Response response = mock(Response.class);
    HttpEntity entity = mock(HttpEntity.class);
    when(response.getStatusCode()).thenReturn(status);
    when(response.getEntity()).thenReturn(entity);
    when(entity.getContent())
        .thenAnswer(inv -> new ByteArrayInputStream(json.getBytes(StandardCharsets.UTF_8)));
    return response;
  }

  private Request sentRequest(String method, String endpoint) throws Exception {
    ArgumentCaptor<Request> sent = ArgumentCaptor.forClass(Request.class);
    verify(mockRestClient, atLeastOnce()).performRequest(sent.capture());
    return sent.getAllValues().stream()
        .filter(request -> method.equals(request.getMethod()))
        .filter(request -> endpoint.equals(request.getEndpoint()))
        .findFirst()
        .orElseThrow(() -> new AssertionError("No " + method + " " + endpoint + " was sent"));
  }

  private static JsonNode bodyOf(Request request) throws Exception {
    try (InputStream content = request.getEntity().getContent()) {
      return JsonUtils.readTree(new String(content.readAllBytes(), StandardCharsets.UTF_8));
    }
  }

  private void mockRestClientResponse(String responseJson) throws Exception {
    Response mockResponse = mock(Response.class);
    HttpEntity mockEntity = mock(HttpEntity.class);
    when(mockRestClient.performRequest(any(Request.class))).thenReturn(mockResponse);
    when(mockResponse.getEntity()).thenReturn(mockEntity);
    when(mockEntity.getContent())
        .thenAnswer(inv -> new ByteArrayInputStream(responseJson.getBytes(StandardCharsets.UTF_8)));
  }

  @Test
  void testNumCandidatesMultiplierFromConfigIsApplied() throws Exception {
    int configuredMultiplier = 5;
    int k = 50;
    // num_candidates = max(50 * 5, 100) = 250
    int expectedNumCandidates = 250;

    ElasticSearchVectorService svc =
        new ElasticSearchVectorService(mockEsClient, mockEmbeddingClient, configuredMultiplier);

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

  @Test
  void testNumCandidatesClampedToEngineMaxForHighK() throws Exception {
    // The REST resource and MCP tool both advertise MAX_K = 10,000. With the default
    // multiplier 2 the raw computation is 20,000, which Elasticsearch rejects with a 400.
    // The query builder must clamp num_candidates to 10,000 so the admitted k never
    // produces an invalid request.
    int k = 10_000;
    int expectedNumCandidates = VectorSearchQueryBuilder.ES_MAX_KNN_NUM_CANDIDATES;

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
    when(mockResponse.getStatusCode()).thenReturn(200);
    when(mockResponse.getEntity()).thenReturn(mockEntity);
    when(mockEntity.getContent())
        .thenAnswer(
            inv -> new ByteArrayInputStream(EMPTY_HITS_RESPONSE.getBytes(StandardCharsets.UTF_8)));

    vectorService.search("test query", Map.of(), 10, 0, k, 0.0);

    assertFalse(capturedBodies.isEmpty(), "Expected at least one request to be captured");
    String requestBody = capturedBodies.get(0);
    assertTrue(
        requestBody.contains("\"num_candidates\":" + expectedNumCandidates),
        "Expected num_candidates=" + expectedNumCandidates + " in: " + requestBody);
    assertFalse(
        requestBody.contains("\"num_candidates\":20000"),
        "num_candidates must not exceed the engine cap of 10,000: " + requestBody);
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
