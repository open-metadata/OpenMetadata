package org.openmetadata.service.search.vector;

import static org.openmetadata.service.search.opensearch.OsUtils.loadVectorIndexMapping;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.generic.Body;
import os.org.opensearch.client.opensearch.generic.Request;
import os.org.opensearch.client.opensearch.generic.Requests;
import os.org.opensearch.client.opensearch.generic.Response;

/**
 * The OpenSearch dialect of the vector index: {@code knn_vector} mapping, the {@code knn} query,
 * and the hybrid RRF search pipeline, which only OpenSearch has.
 */
@Slf4j
public class OpenSearchVectorService extends AbstractVectorIndexService {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  public static final String HYBRID_PIPELINE_NAME = "hybrid-rrf";

  private static volatile OpenSearchVectorService instance;

  private final OpenSearchClient client;

  public OpenSearchVectorService(OpenSearchClient client, EmbeddingClient embeddingClient) {
    this(client, embeddingClient, VectorSearchMemoryAccess::readableAnchorIds);
  }

  OpenSearchVectorService(
      OpenSearchClient client,
      EmbeddingClient embeddingClient,
      Function<VectorSearchParameters, Set<String>> readableAnchors) {
    super(embeddingClient, readableAnchors);
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

  /**
   * The RRF hybrid-ranking pipeline body. Usable two ways, and identical either way: as the body
   * of {@code PUT /_search/pipeline/hybrid-rrf}, or inlined into a search request's {@code
   * search_pipeline} field as an ad-hoc pipeline.
   *
   * <p>Inlining is what lets hybrid search work on a deployment whose search role is confined to
   * its own {@code <clusterAlias>*} prefix: creating a named pipeline needs {@code
   * cluster:admin/search/pipeline/put}, which no index-scoped role has, whereas an ad-hoc pipeline
   * is carried by the search request itself and needs no cluster privilege at all. It also fixes
   * the weights: a named pipeline is one cluster-global object, so on a shared cluster every
   * tenant's reindex overwrote the previous tenant's keyword/semantic weights. Ad-hoc pipelines
   * accept phase-results processors exactly as stored ones do — OpenSearch builds both through
   * the same processor factories.
   */
  public static String buildHybridRrfPipelineDefinition(
      double keywordWeight, double semanticWeight) {
    return buildHybridRrfPipeline(keywordWeight, semanticWeight).toString();
  }

  private static ObjectNode buildHybridRrfPipeline(double keywordWeight, double semanticWeight) {
    var weights = MAPPER.createArrayNode().add(keywordWeight).add(semanticWeight);
    var combination =
        MAPPER
            .createObjectNode()
            .put("technique", "rrf")
            .put("rank_constant", 30)
            .set("parameters", MAPPER.createObjectNode().set("weights", weights));
    var scoreRanker =
        MAPPER
            .createObjectNode()
            .set(
                "score-ranker-processor",
                MAPPER.createObjectNode().set("combination", combination));

    var pipeline = MAPPER.createObjectNode();
    pipeline.set("phase_results_processors", MAPPER.createArrayNode().add(scoreRanker));
    return pipeline;
  }

  /**
   * Best-effort creation of the named pipeline, kept for deployments still reading hybrid results
   * through {@code ?search_pipeline=hybrid-rrf}. Callers must treat failure as non-fatal: the PUT
   * is a cluster-scoped write that a prefix-scoped search role cannot make, and the query path no
   * longer depends on it.
   */
  public void ensureHybridSearchPipeline(double keywordWeight, double semanticWeight) {
    executeGenericRequest(
        "PUT",
        "/_search/pipeline/" + HYBRID_PIPELINE_NAME,
        buildHybridRrfPipelineDefinition(keywordWeight, semanticWeight));
    LOG.info(
        "Hybrid search pipeline '{}' created/updated with weights keyword={}, semantic={}",
        HYBRID_PIPELINE_NAME,
        keywordWeight,
        semanticWeight);
  }

  /**
   * Runs a minimal hybrid query carrying the RRF pipeline inline, as hybrid search does. Never
   * reads the stored pipeline: search does not use it, and a prefix-scoped search role cannot read
   * it. {@code ignore_unavailable} keeps the check valid before the chunk index exists.
   */
  public Optional<String> checkHybridSearchPipeline(double keywordWeight, double semanticWeight) {
    Optional<String> error;
    try {
      Request probe =
          Requests.builder()
              .endpoint("/" + getChunkIndexName() + "/_search")
              .query(Map.of("ignore_unavailable", "true"))
              .method("POST")
              .json(buildHybridSearchProbe(keywordWeight, semanticWeight))
              .build();
      try (Response response = client.generic().execute(probe)) {
        error =
            response.getStatus() < 400
                ? Optional.empty()
                : Optional.of(describeRejectedProbe(response));
      }
    } catch (Exception e) {
      LOG.error("Failed to run a hybrid search with the RRF pipeline", e);
      error = Optional.of("Failed to run a hybrid search with the RRF pipeline: " + e);
    }
    return error;
  }

  private static String buildHybridSearchProbe(double keywordWeight, double semanticWeight) {
    ObjectNode probe = MAPPER.createObjectNode().put("size", 0);
    ArrayNode subQueries = probe.putObject("query").putObject("hybrid").putArray("queries");
    subQueries.addObject().putObject("match_all");
    subQueries.addObject().putObject("match_all");
    probe.set("search_pipeline", buildHybridRrfPipeline(keywordWeight, semanticWeight));
    return probe.toString();
  }

  private static String describeRejectedProbe(Response response) {
    String body = response.getBody().map(Body::bodyAsString).orElse("");
    String detail = body.length() > 200 ? body.substring(0, 200) : body;
    return "OpenSearch rejected a hybrid search with the RRF pipeline (status "
        + response.getStatus()
        + ")."
        + (detail.isEmpty() ? "" : " Response: " + detail);
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
