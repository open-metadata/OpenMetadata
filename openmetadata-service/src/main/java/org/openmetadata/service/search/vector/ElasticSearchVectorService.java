package org.openmetadata.service.search.vector;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.transport.ElasticsearchTransport;
import es.co.elastic.clients.transport.rest5_client.Rest5ClientTransport;
import es.co.elastic.clients.transport.rest5_client.low_level.Request;
import es.co.elastic.clients.transport.rest5_client.low_level.Response;
import es.co.elastic.clients.transport.rest5_client.low_level.ResponseException;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.Set;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.apache.hc.core5.http.HttpEntity;
import org.openmetadata.service.search.elasticsearch.EsUtils;
import org.openmetadata.service.search.elasticsearch.MeteredElasticsearchTransport;
import org.openmetadata.service.search.vector.client.EmbeddingClient;

/**
 * The Elasticsearch dialect of the vector index: {@code dense_vector} mapping and the native
 * top-level {@code knn} search. Elasticsearch has no search pipelines, so hybrid RRF ranking stays
 * with {@link OpenSearchVectorService}.
 */
@Slf4j
public class ElasticSearchVectorService extends AbstractVectorIndexService {
  private static final ObjectMapper MAPPER = new ObjectMapper();

  private static volatile ElasticSearchVectorService instance;

  private final Rest5Client restClient;
  private final int knnNumCandidatesMultiplier;

  public ElasticSearchVectorService(ElasticsearchClient client, EmbeddingClient embeddingClient) {
    this(client, embeddingClient, VectorSearchQueryBuilder.DEFAULT_KNN_NUM_CANDIDATES_MULTIPLIER);
  }

  public ElasticSearchVectorService(
      ElasticsearchClient client, EmbeddingClient embeddingClient, int knnNumCandidatesMultiplier) {
    this(
        client,
        embeddingClient,
        knnNumCandidatesMultiplier,
        VectorSearchMemoryAccess::readableAnchorIds);
  }

  /** {@code cleanup} is what the chunk index is checked against, and runs its cleanups. */
  public ElasticSearchVectorService(
      ElasticsearchClient client, EmbeddingClient embeddingClient, ChunkIndexCleanup cleanup) {
    this(
        client,
        embeddingClient,
        VectorSearchQueryBuilder.DEFAULT_KNN_NUM_CANDIDATES_MULTIPLIER,
        VectorSearchMemoryAccess::readableAnchorIds,
        cleanup);
  }

  ElasticSearchVectorService(
      ElasticsearchClient client,
      EmbeddingClient embeddingClient,
      int knnNumCandidatesMultiplier,
      Function<VectorSearchParameters, Set<String>> readableAnchors) {
    this(
        client,
        embeddingClient,
        knnNumCandidatesMultiplier,
        readableAnchors,
        ChunkIndexCleanup.forCluster());
  }

  private ElasticSearchVectorService(
      ElasticsearchClient client,
      EmbeddingClient embeddingClient,
      int knnNumCandidatesMultiplier,
      Function<VectorSearchParameters, Set<String>> readableAnchors,
      ChunkIndexCleanup cleanup) {
    super(embeddingClient, readableAnchors, Clock.systemUTC(), cleanup);
    this.restClient = extractRestClient(client);
    this.knnNumCandidatesMultiplier =
        knnNumCandidatesMultiplier > 0
            ? knnNumCandidatesMultiplier
            : VectorSearchQueryBuilder.DEFAULT_KNN_NUM_CANDIDATES_MULTIPLIER;
  }

  private static Rest5Client extractRestClient(ElasticsearchClient client) {
    ElasticsearchTransport transport = MeteredElasticsearchTransport.unwrap(client._transport());
    if (!(transport instanceof Rest5ClientTransport rest5)) {
      throw new IllegalArgumentException(
          "ElasticSearchVectorService requires Rest5ClientTransport, got: "
              + transport.getClass().getName());
    }
    return rest5.restClient();
  }

  public static synchronized void init(
      ElasticsearchClient client, EmbeddingClient embeddingClient, int knnNumCandidatesMultiplier) {
    if (instance != null) {
      LOG.warn("ElasticSearchVectorService already initialized, reinitializing");
    }
    ElasticSearchVectorService svc =
        new ElasticSearchVectorService(client, embeddingClient, knnNumCandidatesMultiplier);
    svc.registerVectorEmbeddingHandler();
    instance = svc;
    LOG.info(
        "ElasticSearchVectorService initialized with model={}, dimension={}",
        embeddingClient.getModelId(),
        embeddingClient.getDimension());
  }

  public static ElasticSearchVectorService getInstance() {
    return instance;
  }

  @Override
  protected String engineName() {
    return "Elasticsearch";
  }

  @Override
  protected RawResponse performRequest(String method, String endpoint, String body)
      throws IOException {
    Request request = new Request(method, endpoint);
    if (body != null) {
      request.setJsonEntity(body);
    }
    Response response = respond(request);
    return new RawResponse(response.getStatusCode(), readEntityBody(response.getEntity()));
  }

  /** Rest5Client returns 4xx responses and throws 5xx ones; here both are just the response. */
  private Response respond(Request request) throws IOException {
    Response response;
    try {
      response = restClient.performRequest(request);
    } catch (ResponseException e) {
      response = e.getResponse();
    }
    return response;
  }

  private static String readEntityBody(HttpEntity entity) throws IOException {
    String body = null;
    if (entity != null) {
      try (InputStream content = entity.getContent()) {
        body = new String(content.readAllBytes(), StandardCharsets.UTF_8);
      }
    }
    return body;
  }

  @Override
  protected ObjectNode chunkIndexSettings() {
    return MAPPER.createObjectNode();
  }

  @Override
  protected ObjectNode embeddingFieldMapping(int dimension) {
    return EsUtils.denseVectorMapping(dimension);
  }

  @Override
  protected String buildKnnSearch(
      float[] vector, VectorSearchParameters parameters, Set<String> readableAnchorIds) {
    return VectorSearchQueryBuilder.buildNativeESQuery(
        vector, parameters, knnNumCandidatesMultiplier, readableAnchorIds);
  }

  @Override
  protected String buildKnnQueryClause(
      float[] vector, VectorSearchParameters parameters, Set<String> readableAnchorIds) {
    return VectorSearchQueryBuilder.buildNativeESQueryClause(
        vector, parameters, knnNumCandidatesMultiplier, readableAnchorIds);
  }

  @Override
  protected boolean chunksOntologyTerms() {
    // Ontology term vectors stay on the term documents, read through the ontologyTerms alias.
    return false;
  }

  @Override
  protected boolean knnReturnsAtMostK(double threshold) {
    // The native knn search never returns more than k hits; the threshold is applied afterwards.
    return true;
  }
}
