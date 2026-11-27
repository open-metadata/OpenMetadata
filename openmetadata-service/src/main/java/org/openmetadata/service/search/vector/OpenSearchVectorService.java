package org.openmetadata.service.search.vector;

import static org.openmetadata.service.search.opensearch.OsUtils.loadVectorIndexMapping;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.Set;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.generic.Body;
import os.org.opensearch.client.opensearch.generic.Requests;
import os.org.opensearch.client.opensearch.generic.Response;

/**
 * The OpenSearch dialect of the vector index: the {@code knn_vector} mapping and the {@code knn}
 * query.
 */
@Slf4j
public class OpenSearchVectorService extends AbstractVectorIndexService {
  private static final ObjectMapper MAPPER = new ObjectMapper();

  private static volatile OpenSearchVectorService instance;

  private final OpenSearchClient client;

  public OpenSearchVectorService(OpenSearchClient client, EmbeddingClient embeddingClient) {
    this(client, embeddingClient, ChunkIndexCleanup.forCluster());
  }

  /** {@code cleanup} is what the chunk index is checked against, and runs its cleanups. */
  public OpenSearchVectorService(
      OpenSearchClient client, EmbeddingClient embeddingClient, ChunkIndexCleanup cleanup) {
    this(client, embeddingClient, VectorSearchMemoryAccess::readableAnchorIds, cleanup);
  }

  OpenSearchVectorService(
      OpenSearchClient client,
      EmbeddingClient embeddingClient,
      Function<VectorSearchParameters, Set<String>> readableAnchors) {
    this(client, embeddingClient, readableAnchors, ChunkIndexCleanup.forCluster());
  }

  private OpenSearchVectorService(
      OpenSearchClient client,
      EmbeddingClient embeddingClient,
      Function<VectorSearchParameters, Set<String>> readableAnchors,
      ChunkIndexCleanup cleanup) {
    super(embeddingClient, readableAnchors, Clock.systemUTC(), cleanup);
    this.client = client;
  }

  public static synchronized void init(OpenSearchClient client, EmbeddingClient embeddingClient) {
    if (instance != null) {
      LOG.warn("OpenSearchVectorService already initialized, reinitializing");
    }
    OpenSearchVectorService svc = new OpenSearchVectorService(client, embeddingClient);
    svc.registerVectorEmbeddingHandler();
    instance = svc;
    LOG.info(
        "OpenSearchVectorService initialized with model={}, dimension={}",
        embeddingClient.getModelId(),
        embeddingClient.getDimension());
  }

  public static OpenSearchVectorService getInstance() {
    return instance;
  }

  public void close() {
    // No-op by design. The opensearch-java client stored here was constructed elsewhere and its
    // transport is shared with OpenSearchClient and every other manager. Closing the transport
    // from here permanently shuts down the HC5 IOReactor for the whole application, which was a
    // root cause of production "I/O reactor has been shut down" errors.
  }

  @Override
  protected String buildKnnQueryClause(
      float[] vector, VectorSearchParameters parameters, Set<String> readableAnchorIds) {
    return VectorSearchQueryBuilder.buildQueryClause(vector, parameters, readableAnchorIds);
  }

  @Override
  protected String engineName() {
    return "OpenSearch";
  }

  @Override
  protected RawResponse performRequest(String method, String endpoint, String body)
      throws IOException {
    var builder = Requests.builder().endpoint(endpoint).method(method);
    if (body != null) {
      builder.json(body);
    }
    try (Response response = client.generic().execute(builder.build())) {
      return new RawResponse(
          response.getStatus(), response.getBody().map(this::readBody).orElse(null));
    }
  }

  private String readBody(Body body) {
    String text;
    try {
      text = new String(body.bodyAsBytes(), StandardCharsets.UTF_8);
    } catch (RuntimeException e) {
      LOG.warn("Failed to read OpenSearch response body", e);
      text = "{}";
    }
    return text;
  }

  @Override
  protected ObjectNode chunkIndexSettings() {
    return loadVectorIndexMapping();
  }

  @Override
  protected ObjectNode embeddingFieldMapping(int dimension) {
    var method =
        MAPPER
            .createObjectNode()
            .put("name", "hnsw")
            .put("engine", "lucene")
            .put("space_type", "cosinesimil")
            .set("parameters", MAPPER.createObjectNode().put("m", 48).put("ef_construction", 256));
    return MAPPER
        .createObjectNode()
        .put("type", "knn_vector")
        .put("dimension", dimension)
        .set("method", method);
  }

  @Override
  protected String buildKnnSearch(
      float[] vector, VectorSearchParameters parameters, Set<String> readableAnchorIds) {
    return VectorSearchQueryBuilder.build(vector, parameters, readableAnchorIds);
  }

  @Override
  protected boolean chunksOntologyTerms() {
    return true;
  }

  @Override
  protected boolean knnReturnsAtMostK(double threshold) {
    // With min_score set, the knn query returns every neighbour above it, however many.
    return threshold <= 0.0;
  }
}
