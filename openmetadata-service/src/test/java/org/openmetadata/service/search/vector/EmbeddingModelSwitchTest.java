package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import os.org.opensearch.client.opensearch.OpenSearchClient;

/**
 * A stored vector is reused only while the model that produced it is the configured one. The two
 * stub models below share a dimension and return different vectors, so a vector carried over from
 * the other model shows as the configured model never being asked to embed.
 * ADR:2026-11-11-reindex-reuses-an-embedding-only-when-its-fingerprint-matches
 */
class EmbeddingModelSwitchTest {
  private static final String ENTITY_INDEX = "table_search_index";
  private static final String LIVE_CHUNKS = "data_asset_embeddings_chunks";
  private static final String STAGED_CHUNKS = LIVE_CHUNKS + "_g1700000000000";

  private final StubModel modelA = new StubModel("model-a", 1f, 0f, 0f, 0f);
  private final StubModel modelB = new StubModel("model-b", 0f, 1f, 0f, 0f);
  private final Table table =
      new Table()
          .withId(UUID.randomUUID())
          .withName("orders")
          .withFullyQualifiedName("svc.db.schema.orders")
          .withDescription("Orders placed online")
          .withUpdatedAt(1_700_000_000_000L);
  private final String tableId = table.getId().toString();
  private final InMemoryEngine engine = new InMemoryEngine();

  @BeforeAll
  static void tablesHaveAnEntityType() {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("table", Entity.TABLE);
  }

  @Test
  void aReindexUnderAnotherModelReusesNoStoredEmbedding() {
    engine.put(ENTITY_INDEX, tableId, entityDocEmbeddedBy(modelA));

    assertEquals(Map.of(), reuseLookup(serviceOf(modelB)));
  }

  @Test
  void aReindexUnderTheSameModelReusesTheStoredEmbedding() {
    engine.put(ENTITY_INDEX, tableId, entityDocEmbeddedBy(modelA));

    Map<String, JsonNode> reusable = reuseLookup(serviceOf(modelA));

    assertEquals(Set.of(tableId), reusable.keySet());
    assertEquals(vectorOf(modelA), reusable.get(tableId).path("embedding"));
  }

  /** A doc that does not say which model produced its vector is embedded once more. */
  @Test
  void anEntityDocThatDoesNotRecordItsModelIsNotReused() {
    ObjectNode unrecorded = entityDocEmbeddedBy(modelA);
    unrecorded.remove(List.of("embeddingModel", "embeddingDimension"));
    engine.put(ENTITY_INDEX, tableId, unrecorded);

    assertEquals(Map.of(), reuseLookup(serviceOf(modelA)));
  }

  @Test
  void aLiveEditUnderAnotherModelReembedsTheEntityDocAndItsChunks() {
    engine.put(ENTITY_INDEX, tableId, entityDocEmbeddedBy(modelA));
    engine.putChunks(LIVE_CHUNKS, chunksEmbeddedBy(modelA));

    serviceOf(modelB).updateEntityEmbeddings(table, ENTITY_INDEX);

    assertEquals(1, modelB.calls.get(), "chunk 0 is embedded once, for both documents");
    assertEquals(vectorOf(modelB), engine.get(ENTITY_INDEX, tableId).path("embedding"));
    assertEquals(vectorOf(modelB), engine.get(LIVE_CHUNKS, tableId + "_0").path("embedding"));
  }

  @Test
  void aLiveEditUnderTheSameModelWithUnchangedTextEmbedsNothing() {
    engine.put(ENTITY_INDEX, tableId, entityDocEmbeddedBy(modelA));
    engine.putChunks(LIVE_CHUNKS, chunksEmbeddedBy(modelA));

    serviceOf(modelA).updateEntityEmbeddings(table, ENTITY_INDEX);

    assertEquals(0, modelA.calls.get());
  }

  @Test
  void theSingleDocumentLiveWriteUnderAnotherModelReembedsTheEntityDoc() {
    engine.put(ENTITY_INDEX, tableId, entityDocEmbeddedBy(modelA));

    serviceOf(modelB).updateEntityEmbedding(table, ENTITY_INDEX);

    assertEquals(1, modelB.calls.get());
    assertEquals(vectorOf(modelB), engine.get(ENTITY_INDEX, tableId).path("embedding"));
  }

  /** A reindex that kept the entity doc's embedding still checks the chunks it backfills. */
  @Test
  void aReindexBackfillUnderAnotherModelReembedsTheLiveChunks() {
    engine.putChunks(LIVE_CHUNKS, chunksEmbeddedBy(modelA));

    assertTrue(serviceOf(modelB).backfillEntityChunks(table, null));

    assertEquals(1, modelB.calls.get());
    assertEquals(vectorOf(modelB), engine.get(LIVE_CHUNKS, tableId + "_0").path("embedding"));
  }

  @Test
  void aRecreateUnderAnotherModelDoesNotCopyTheLiveChunks() {
    engine.putChunks(LIVE_CHUNKS, chunksEmbeddedBy(modelA));
    engine.createIndex(STAGED_CHUNKS);

    assertTrue(serviceOf(modelB).backfillEntityChunks(table, STAGED_CHUNKS));

    assertEquals(1, modelB.calls.get());
    assertEquals(vectorOf(modelB), engine.get(STAGED_CHUNKS, tableId + "_0").path("embedding"));
  }

  /** The dimension is part of the model: one model id can be configured for other sizes. */
  @Test
  void aRecreateUnderTheSameModelIdWithAnotherDimensionDoesNotCopyTheLiveChunks() {
    StubModel threeDimensional = new StubModel("model-a", 1f, 0f, 0f);
    engine.putChunks(LIVE_CHUNKS, chunksEmbeddedBy(threeDimensional));
    engine.createIndex(STAGED_CHUNKS);

    assertTrue(serviceOf(modelA).backfillEntityChunks(table, STAGED_CHUNKS));

    assertEquals(1, modelA.calls.get());
    assertEquals(vectorOf(modelA), engine.get(STAGED_CHUNKS, tableId + "_0").path("embedding"));
  }

  @Test
  void aRecreateUnderTheSameModelCopiesTheLiveChunks() {
    engine.putChunks(LIVE_CHUNKS, chunksEmbeddedBy(modelA));
    engine.createIndex(STAGED_CHUNKS);

    assertTrue(serviceOf(modelA).backfillEntityChunks(table, STAGED_CHUNKS));

    assertEquals(0, modelA.calls.get(), "the live vectors are copied, not embedded again");
    assertEquals(vectorOf(modelA), engine.get(STAGED_CHUNKS, tableId + "_0").path("embedding"));
  }

  /** {@code reembed} ignores stored vectors, even ones that record the configured model. */
  @Test
  void reembedEmbedsAnEntityWhoseStoredVectorsAreCurrent() {
    engine.put(ENTITY_INDEX, tableId, entityDocEmbeddedBy(modelA));
    engine.putChunks(LIVE_CHUNKS, chunksEmbeddedBy(modelA));

    assertTrue(serviceOf(modelA).reembedEntity(table, ENTITY_INDEX));

    assertEquals(1, modelA.calls.get());
  }

  @Test
  void reembedUnderAnotherModelReplacesTheEntityDocAndItsChunks() {
    engine.put(ENTITY_INDEX, tableId, entityDocEmbeddedBy(modelA));
    engine.putChunks(LIVE_CHUNKS, chunksEmbeddedBy(modelA));

    assertTrue(serviceOf(modelB).reembedEntity(table, ENTITY_INDEX));

    assertEquals(vectorOf(modelB), engine.get(ENTITY_INDEX, tableId).path("embedding"));
    assertEquals(vectorOf(modelB), engine.get(LIVE_CHUNKS, tableId + "_0").path("embedding"));
    assertEquals(
        "model-b", engine.get(LIVE_CHUNKS, tableId + "_0").path("embeddingModel").asText());
  }

  @Test
  void reembedReportsAnEntityTheProviderCouldNotEmbed() {
    engine.put(ENTITY_INDEX, tableId, entityDocEmbeddedBy(modelA));
    engine.putChunks(LIVE_CHUNKS, chunksEmbeddedBy(modelA));
    modelB.failing = true;

    assertFalse(serviceOf(modelB).reembedEntity(table, ENTITY_INDEX));

    assertEquals(vectorOf(modelA), engine.get(ENTITY_INDEX, tableId).path("embedding"));
  }

  private Map<String, JsonNode> reuseLookup(AbstractVectorIndexService service) {
    Supplier<String> currentFingerprint = () -> VectorDocBuilder.computeFingerprintForEntity(table);
    return service.getExistingEmbeddingsBatch(ENTITY_INDEX, Map.of(tableId, currentFingerprint));
  }

  private ObjectNode entityDocEmbeddedBy(StubModel model) {
    ObjectNode doc = JsonUtils.getObjectNode().put("name", table.getName());
    Map<String, Object> chunk0 = VectorDocBuilder.fromEntity(table, model).getFirst();
    doc.setAll((ObjectNode) JsonUtils.valueToTree(VectorDocBuilder.legacyEmbeddingFields(chunk0)));
    model.calls.set(0);
    return doc;
  }

  private List<Map<String, Object>> chunksEmbeddedBy(StubModel model) {
    List<Map<String, Object>> chunks = VectorDocBuilder.fromEntity(table, model);
    model.calls.set(0);
    return chunks;
  }

  /** As the engine returns a stored vector: parsed from JSON. */
  private static JsonNode vectorOf(StubModel model) {
    return JsonUtils.readTree(JsonUtils.pojoToJson(model.vector));
  }

  private AbstractVectorIndexService serviceOf(StubModel model) {
    return new OpenSearchVectorService(mock(OpenSearchClient.class), model) {
      @Override
      protected RawResponse performRequest(String method, String endpoint, String body) {
        return engine.answer(method, endpoint, body);
      }
    };
  }

  /** A provider stub: a constant vector per model, counting the texts it embeds. */
  static final class StubModel extends EmbeddingClient {
    private final String modelId;
    private final float[] vector;
    private final AtomicInteger calls = new AtomicInteger();
    private boolean failing;

    StubModel(String modelId, float... vector) {
      this.modelId = modelId;
      this.vector = vector;
    }

    @Override
    protected float[] doEmbed(String text) {
      calls.incrementAndGet();
      if (failing) {
        throw new IllegalStateException("provider rate limit");
      }
      return vector.clone();
    }

    @Override
    public int getDimension() {
      return vector.length;
    }

    @Override
    public String getModelId() {
      return modelId;
    }
  }

  /**
   * The document APIs the vector service uses, over documents held in memory: by-id reads, {@code
   * _mget}, {@code _search} by id, {@code _update} and {@code _bulk}. Every index answers as a
   * physical index whose chunk mapping is current.
   */
  static final class InMemoryEngine {
    private final Map<String, Map<String, ObjectNode>> indexes = new HashMap<>();
    private final List<String> requests = new ArrayList<>();

    void createIndex(String index) {
      indexes.computeIfAbsent(index, name -> new HashMap<>());
    }

    /** Stores {@code source} as an engine does: as JSON, so its numbers read back as doubles. */
    void put(String index, String id, ObjectNode source) {
      createIndex(index);
      indexes.get(index).put(id, (ObjectNode) JsonUtils.readTree(source.toString()));
    }

    void putChunks(String index, List<Map<String, Object>> chunks) {
      for (Map<String, Object> chunk : chunks) {
        put(
            index,
            chunk.get("parentId") + "_" + chunk.get("chunkIndex"),
            (ObjectNode) JsonUtils.valueToTree(chunk));
      }
    }

    JsonNode get(String index, String id) {
      ObjectNode source = indexes.getOrDefault(index, Map.of()).get(id);
      return source == null ? JsonUtils.getObjectNode() : source;
    }

    AbstractVectorIndexService.RawResponse answer(String method, String endpoint, String body) {
      requests.add(method + " " + endpoint);
      String path =
          endpoint.contains("?") ? endpoint.substring(0, endpoint.indexOf('?')) : endpoint;
      String[] parts = path.substring(1).split("/");
      String index = parts[0];
      String action = parts.length > 1 ? parts[1] : "";
      AbstractVectorIndexService.RawResponse response;
      if ("_bulk".equals(index)) {
        response = bulk(body);
      } else if ("_doc".equals(action)) {
        response = byId(index, parts[2]);
      } else if ("_mget".equals(action)) {
        response = ok(multiGet(index, JsonUtils.readTree(body).path("ids")));
      } else if ("_search".equals(action)) {
        response = ok(searchById(index, JsonUtils.readTree(body).path("query")));
      } else if ("_update".equals(action)) {
        response = update(index, parts[2], JsonUtils.readTree(body).path("doc"));
      } else if ("_mapping".equals(action) && "GET".equals(method)) {
        response = ok(currentChunkMapping(index));
      } else if ("_alias".equals(action) && "GET".equals(method)) {
        response = indexes.containsKey(index) ? ok(aliasesOf(index)) : missing();
      } else if (action.isEmpty() && "PUT".equals(method)) {
        createIndex(index);
        response = ok(JsonUtils.getObjectNode().put("acknowledged", true));
      } else if (action.isEmpty() && "HEAD".equals(method)) {
        response = indexes.containsKey(index) ? ok(JsonUtils.getObjectNode()) : missing();
      } else {
        ObjectNode acknowledged = JsonUtils.getObjectNode();
        acknowledged.putArray("failures");
        response = ok(acknowledged);
      }
      return response;
    }

    private AbstractVectorIndexService.RawResponse byId(String index, String id) {
      ObjectNode source = indexes.getOrDefault(index, Map.of()).get(id);
      ObjectNode answer = JsonUtils.getObjectNode().put("_id", id).put("found", source != null);
      if (source != null) {
        answer.set("_source", source.deepCopy());
      }
      return source == null ? missing() : ok(answer);
    }

    private ObjectNode multiGet(String index, JsonNode ids) {
      ObjectNode answer = JsonUtils.getObjectNode();
      for (JsonNode id : ids) {
        ObjectNode source = indexes.getOrDefault(index, Map.of()).get(id.asText());
        ObjectNode doc =
            answer
                .withArray("docs")
                .addObject()
                .put("_id", id.asText())
                .put("found", source != null);
        if (source != null) {
          doc.set("_source", source.deepCopy());
        }
      }
      return answer;
    }

    private ObjectNode searchById(String index, JsonNode query) {
      List<String> ids = new ArrayList<>();
      query.path("term").path("_id").forEach(id -> ids.add(id.asText()));
      if (query.path("term").path("_id").isTextual()) {
        ids.add(query.path("term").path("_id").asText());
      }
      query.path("ids").path("values").forEach(id -> ids.add(id.asText()));
      ObjectNode answer = JsonUtils.getObjectNode();
      var hits = answer.putObject("hits").putArray("hits");
      for (String id : ids) {
        ObjectNode source = indexes.getOrDefault(index, Map.of()).get(id);
        if (source != null) {
          hits.addObject().put("_id", id).set("_source", source.deepCopy());
        }
      }
      return answer;
    }

    private AbstractVectorIndexService.RawResponse update(String index, String id, JsonNode doc) {
      ObjectNode source = indexes.getOrDefault(index, Map.of()).get(id);
      if (source != null) {
        source.setAll((ObjectNode) doc);
      }
      return source == null ? missing() : ok(JsonUtils.getObjectNode().put("result", "updated"));
    }

    private AbstractVectorIndexService.RawResponse bulk(String body) {
      String[] lines = body.split("\n");
      int line = 0;
      while (line < lines.length) {
        JsonNode action = JsonUtils.readTree(lines[line]);
        if (action.has("index")) {
          JsonNode target = action.path("index");
          put(
              target.path("_index").asText(),
              target.path("_id").asText(),
              (ObjectNode) JsonUtils.readTree(lines[line + 1]));
          line += 2;
        } else {
          JsonNode target = action.path("delete");
          indexes
              .getOrDefault(target.path("_index").asText(), new HashMap<>())
              .remove(target.path("_id").asText());
          line += 1;
        }
      }
      return ok(JsonUtils.getObjectNode().put("errors", false));
    }

    private static ObjectNode currentChunkMapping(String index) {
      ObjectNode answer = JsonUtils.getObjectNode();
      answer
          .putObject(index)
          .putObject("mappings")
          .putObject("_meta")
          .put("chunkDocVersion", VectorDocBuilder.CHUNK_DOC_VERSION);
      return answer;
    }

    private static ObjectNode aliasesOf(String index) {
      ObjectNode answer = JsonUtils.getObjectNode();
      answer.putObject(index).putObject("aliases");
      return answer;
    }

    private static AbstractVectorIndexService.RawResponse ok(JsonNode body) {
      return new AbstractVectorIndexService.RawResponse(200, body.toString());
    }

    private static AbstractVectorIndexService.RawResponse missing() {
      return new AbstractVectorIndexService.RawResponse(404, "{\"found\":false}");
    }
  }
}
