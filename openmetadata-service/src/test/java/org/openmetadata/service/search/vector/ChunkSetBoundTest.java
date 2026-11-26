package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.function.Predicate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.search.vector.client.EmbeddingClient;

/**
 * Chunk 0's {@code chunkCount} bounds every chunk id stored for a parent. These scenarios run the
 * shared write and delete code against an in-memory cluster whose delete-by-query, like a real
 * one, sees only refreshed documents, and they never refresh between steps: the by-id bound alone
 * must reach what a failed write left behind.
 */
class ChunkSetBoundTest {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String LIVE = "data_asset_embeddings_chunks";
  private static final String STAGED = LIVE + "_g1";
  private static final String ENTITY_INDEX = "table_search_index";

  private FakeCluster cluster;
  private InMemoryVectorService service;
  private EmbeddingClient embeddingClient;
  private Table table;
  private String parentId;

  @BeforeEach
  void setUp() {
    embeddingClient = mock(EmbeddingClient.class);
    when(embeddingClient.embed(any(String.class))).thenReturn(new float[] {0.1f, 0.2f, 0.3f});
    when(embeddingClient.getDimension()).thenReturn(3);
    when(embeddingClient.isAvailable()).thenReturn(true);
    cluster = new FakeCluster();
    service = new InMemoryVectorService(embeddingClient, cluster);
    table = new Table().withId(UUID.randomUUID()).withName("orders").withUpdatedAt(1L);
    parentId = table.getId().toString();
  }

  @ParameterizedTest(name = "into {0}")
  @ValueSource(strings = {LIVE, STAGED})
  void aDeleteAfterAGrowthWhoseHeaderFailedLeavesNoChunk(String target) {
    growFromOneToThreeChunksWithTheHeaderFailing(target);

    service.deleteEntityChunks(parentId);

    assertEquals(Set.of(), cluster.chunkIds(target, parentId));
  }

  @ParameterizedTest(name = "into {0}")
  @ValueSource(strings = {LIVE, STAGED})
  void aShrinkAfterAGrowthWhoseHeaderFailedLeavesNoTrailingChunk(String target) {
    growFromOneToThreeChunksWithTheHeaderFailing(target);

    assertTrue(write(target, chunks(1)));

    assertEquals(Set.of(parentId + "_0"), cluster.chunkIds(target, parentId));
    assertEquals(1, cluster.header(target, parentId).path("chunkCount").asInt());
  }

  @ParameterizedTest(name = "into {0}")
  @ValueSource(strings = {LIVE, STAGED})
  void aLaterFullWriteAfterAGrowthWhoseHeaderFailedKeepsOnlyItsChunks(String target) {
    growFromOneToThreeChunksWithTheHeaderFailing(target);
    List<Map<String, Object>> twoChunks = chunks(2);

    assertTrue(write(target, twoChunks));

    assertEquals(Set.of(parentId + "_0", parentId + "_1"), cluster.chunkIds(target, parentId));
    assertEquals(
        twoChunks.getFirst().get("fingerprint"),
        cluster.header(target, parentId).path("fingerprint").asText());
  }

  @Test
  void aLiveEditMirroredIntoTheStagedGenerationKeepsItsBound() {
    service.latchParticipantStagedTarget(STAGED);
    assertTrue(write(STAGED, chunks(1)));
    cluster.rejectHeaderWritesTo(STAGED);

    service.updateEntityEmbeddings(withChunks(3), ENTITY_INDEX);
    cluster.acceptAllWrites();
    service.deleteEntityChunks(parentId);

    assertEquals(Set.of(), cluster.chunkIds(STAGED, parentId));
    assertEquals(Set.of(), cluster.chunkIds(LIVE, parentId));
  }

  @Test
  void aGrowthWhoseHeaderFailedLeavesAHeaderThatNoUpdateReadsAsCurrent() {
    growFromOneToThreeChunksWithTheHeaderFailing(LIVE);

    JsonNode header = cluster.header(LIVE, parentId);
    assertFalse(header.has("fingerprint"), header::toString);
    assertEquals(3, header.path("chunkCount").asInt());
  }

  @Test
  void aWriteThatKeepsWithinTheBoundSendsNoReservation() {
    assertTrue(write(LIVE, chunks(3)));
    int requestsBefore = cluster.bulkRequests;

    assertTrue(write(LIVE, chunks(3)));

    assertEquals(2, cluster.bulkRequests - requestsBefore, "the chunks, then the header");
  }

  @ParameterizedTest(name = "into {0}")
  @ValueSource(strings = {LIVE, STAGED})
  void aDeleteRemovesChunksAHeaderThatIsBehindDoesNotCover(String target) {
    service.latchParticipantStagedTarget(STAGED);
    assertTrue(write(target, chunks(1)));
    cluster.storeRefreshed(target, parentId + "_1", Map.of("parentId", parentId, "chunkIndex", 1));
    cluster.storeRefreshed(target, parentId + "_4", Map.of("parentId", parentId, "chunkIndex", 4));

    service.deleteEntityChunks(parentId);

    assertEquals(Set.of(), cluster.chunkIds(target, parentId));
  }

  @Test
  void aDeleteRemovesChunksStoredWithoutAHeader() {
    cluster.storeRefreshed(LIVE, parentId + "_2", Map.of("parentId", parentId, "chunkIndex", 2));

    service.deleteEntityChunks(parentId);

    assertEquals(Set.of(), cluster.chunkIds(LIVE, parentId));
  }

  @Test
  void aDeleteBeforeTheChunkIndexExistsSendsNothingToIt() {
    service.latchParticipantStagedTarget(STAGED);

    service.deleteEntityChunks(parentId);

    assertEquals(0, cluster.requestsToMissingIndices);
  }

  private void growFromOneToThreeChunksWithTheHeaderFailing(String target) {
    service.latchParticipantStagedTarget(STAGED);
    assertTrue(write(target, chunks(1)));
    cluster.rejectHeaderWritesTo(target);
    assertFalse(write(target, chunks(3)), "the header write fails");
    cluster.acceptAllWrites();
    assertEquals(
        Set.of(parentId + "_0", parentId + "_1", parentId + "_2"),
        cluster.chunkIds(target, parentId),
        "the failed write left chunks past the old count");
  }

  private boolean write(String target, List<Map<String, Object>> chunkDocs) {
    return service.writeEntityChunks(parentId, chunkDocs, LIVE.equals(target) ? null : target);
  }

  private List<Map<String, Object>> chunks(int count) {
    List<Map<String, Object>> chunkDocs =
        VectorDocBuilder.fromEntity(withChunks(count), embeddingClient);
    assertEquals(count, chunkDocs.size(), "the description spans the expected chunk count");
    return chunkDocs;
  }

  private Table withChunks(int count) {
    String description = count == 1 ? "Orders placed online." : "word ".repeat(380 * count - 200);
    return table.withDescription(description);
  }

  /** The shared vector index code over {@link FakeCluster}. */
  private static final class InMemoryVectorService extends AbstractVectorIndexService {
    private final FakeCluster cluster;

    InMemoryVectorService(EmbeddingClient embeddingClient, FakeCluster cluster) {
      super(embeddingClient, parameters -> Set.of());
      this.cluster = cluster;
    }

    @Override
    protected String engineName() {
      return "InMemory";
    }

    @Override
    protected RawResponse performRequest(String method, String endpoint, String body)
        throws IOException {
      return cluster.handle(method, endpoint, body);
    }

    @Override
    protected ObjectNode chunkIndexSettings() {
      return MAPPER.createObjectNode();
    }

    @Override
    protected ObjectNode embeddingFieldMapping(int dimension) {
      return MAPPER.createObjectNode().put("type", "float");
    }

    @Override
    protected String buildKnnSearch(
        float[] vector, VectorSearchParameters parameters, Set<String> readableAnchorIds) {
      return "{}";
    }

    @Override
    protected String buildKnnQueryClause(
        float[] vector, VectorSearchParameters parameters, Set<String> readableAnchorIds) {
      return "{}";
    }

    @Override
    protected boolean knnReturnsAtMostK(double threshold) {
      return true;
    }

    @Override
    protected boolean chunksOntologyTerms() {
      return true;
    }
  }

  /**
   * Documents by index and id. A by-id read sees every write, as a realtime GET does; a
   * delete-by-query sees only documents stored as refreshed. A rejected header write is a chunk 0
   * that carries a fingerprint. An index exists once it is created or written to; a delete sent to
   * one that does not fails, as on a real cluster.
   */
  private static final class FakeCluster {
    private static final String DOC = "/_doc/";
    private final Map<String, Map<String, JsonNode>> indices = new HashMap<>();
    private final Set<String> existing = new HashSet<>();
    private final Set<String> refreshed = new HashSet<>();
    private int requestsToMissingIndices;
    private Predicate<String> rejectHeaderIndex = index -> false;
    private int bulkRequests;

    void rejectHeaderWritesTo(String index) {
      rejectHeaderIndex = index::equals;
    }

    void acceptAllWrites() {
      rejectHeaderIndex = index -> false;
    }

    void storeRefreshed(String index, String id, Map<String, Object> source) {
      existing.add(index);
      docs(index).put(id, MAPPER.valueToTree(source));
      refreshed.add(index + DOC + id);
    }

    Set<String> chunkIds(String index, String parentId) {
      Set<String> ids = new TreeSet<>();
      docs(index)
          .forEach(
              (id, source) -> {
                if (parentId.equals(source.path("parentId").asText())) {
                  ids.add(id);
                }
              });
      return ids;
    }

    JsonNode header(String index, String parentId) {
      return docs(index).get(parentId + "_0");
    }

    AbstractVectorIndexService.RawResponse handle(String method, String endpoint, String body)
        throws IOException {
      AbstractVectorIndexService.RawResponse response = ok("{}");
      String index = endpoint.substring(1).split("[/?]")[0];
      boolean wholeIndex = endpoint.indexOf('/', 1) < 0;
      if (wholeIndex && "PUT".equals(method)) {
        existing.add(index);
      } else if (wholeIndex && "HEAD".equals(method)) {
        response =
            new AbstractVectorIndexService.RawResponse(existing.contains(index) ? 200 : 404, null);
      } else if (endpoint.endsWith("/_alias")) {
        response = new AbstractVectorIndexService.RawResponse(404, "{\"status\":404}");
      } else if (endpoint.equals("/_bulk")) {
        response = bulk(body);
      } else if (endpoint.contains("/_delete_by_query")) {
        response = deleteByQuery(index, body);
      } else if (endpoint.contains(DOC)) {
        response = getById(method, endpoint);
      }
      return response;
    }

    private AbstractVectorIndexService.RawResponse getById(String method, String endpoint) {
      String index = endpoint.substring(1, endpoint.indexOf(DOC));
      String id = endpoint.substring(endpoint.indexOf(DOC) + DOC.length(), endpoint.indexOf('?'));
      JsonNode source = docs(index).get(id);
      ObjectNode body = MAPPER.createObjectNode().put("found", source != null);
      if (source != null) {
        body.set("_source", source);
      }
      boolean head = "HEAD".equals(method);
      return new AbstractVectorIndexService.RawResponse(
          source == null && head ? 404 : 200, head ? null : body.toString());
    }

    private AbstractVectorIndexService.RawResponse bulk(String body) throws IOException {
      bulkRequests++;
      boolean errors = false;
      String[] lines = body.split("\n");
      for (int i = 0; i < lines.length; i++) {
        JsonNode action = MAPPER.readTree(lines[i]);
        if (action.has("delete")) {
          errors |= !remove(action.path("delete"));
        } else {
          JsonNode meta = action.path("index");
          JsonNode source = MAPPER.readTree(lines[++i]);
          errors |= !index(meta, source);
        }
      }
      return ok("{\"errors\":" + errors + ",\"items\":[]}");
    }

    private boolean index(JsonNode meta, JsonNode source) {
      String index = meta.path("_index").asText();
      String id = meta.path("_id").asText();
      boolean rejected =
          rejectHeaderIndex.test(index) && id.endsWith("_0") && source.has("fingerprint");
      if (!rejected) {
        existing.add(index);
        docs(index).put(id, source);
        refreshed.remove(index + DOC + id);
      }
      return !rejected;
    }

    private boolean remove(JsonNode meta) {
      String index = meta.path("_index").asText();
      boolean found = existsOrCount(index);
      docs(index).remove(meta.path("_id").asText());
      return found;
    }

    private boolean existsOrCount(String index) {
      boolean found = existing.contains(index);
      if (!found) {
        requestsToMissingIndices++;
      }
      return found;
    }

    private AbstractVectorIndexService.RawResponse deleteByQuery(String index, String body)
        throws IOException {
      AbstractVectorIndexService.RawResponse response =
          new AbstractVectorIndexService.RawResponse(404, "{\"error\":\"index_not_found\"}");
      if (existsOrCount(index)) {
        JsonNode bool = MAPPER.readTree(body).path("query").path("bool");
        String parentId = bool.path("filter").path(0).path("term").path("parentId").asText();
        Set<String> kept = new HashSet<>();
        bool.path("must_not")
            .path(0)
            .path("ids")
            .path("values")
            .forEach(id -> kept.add(id.asText()));
        docs(index)
            .entrySet()
            .removeIf(
                doc ->
                    refreshed.contains(index + DOC + doc.getKey())
                        && !kept.contains(doc.getKey())
                        && parentId.equals(doc.getValue().path("parentId").asText()));
        response = ok("{\"failures\":[]}");
      }
      return response;
    }

    private Map<String, JsonNode> docs(String index) {
      return indices.computeIfAbsent(index, ignored -> new HashMap<>());
    }

    private static AbstractVectorIndexService.RawResponse ok(String body) {
      return new AbstractVectorIndexService.RawResponse(200, body);
    }
  }
}
