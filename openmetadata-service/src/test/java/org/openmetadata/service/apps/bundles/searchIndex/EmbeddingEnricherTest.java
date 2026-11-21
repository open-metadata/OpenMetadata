package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StageStatsTracker;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StatsResult;
import org.openmetadata.service.search.ReindexContext;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.vector.VectorDocBuilder;
import org.openmetadata.service.search.vector.VectorIndexService;
import org.openmetadata.service.search.vector.client.EmbeddingClient;

class EmbeddingEnricherTest {
  private static final String INDEX = "table_search_index";
  private static final String ORIGINAL_INDEX = "table_search_index_rebuild_1";
  private static final String STAGED_CHUNKS = "data_asset_embeddings_chunks_g1700000000000";
  private static final String ENTITY_JSON = "{\"name\":\"orders\"}";

  private final SearchRepository searchRepository = mock(SearchRepository.class);
  private final VectorIndexService vectorService = mock(VectorIndexService.class);
  private final StageStatsTracker tracker = mock(StageStatsTracker.class);
  private final ThreeDimensionalEmbeddings embeddings = new ThreeDimensionalEmbeddings();
  private final EmbeddingEnricher enricher = new EmbeddingEnricher(searchRepository);
  private final Table table =
      new Table()
          .withId(UUID.randomUUID())
          .withName("orders")
          .withFullyQualifiedName("svc.db.schema.orders")
          .withDescription("Orders placed online")
          .withUpdatedAt(1_700_000_000_000L);
  private final String tableId = table.getId().toString();
  private MockedStatic<Entity> entities;

  @BeforeAll
  static void tablesHaveAnEntityType() {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("table", Entity.TABLE);
  }

  // Whether one entity may be embedded is its repository's decision. No repository is registered
  // here, and one left registered by another test class must not decide it either.
  @BeforeEach
  void theTableMayBeEmbedded() {
    entities = mockStatic(Entity.class);
    entities.when(() -> Entity.isVectorEmbeddable(table)).thenReturn(true);
  }

  @AfterEach
  void releaseTheEntityRegistry() {
    entities.close();
  }

  @BeforeEach
  void semanticSearchIsOn() {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);
    when(searchRepository.getVectorIndexService()).thenReturn(vectorService);
    when(searchRepository.getIndexMapping(Entity.TABLE))
        .thenReturn(IndexMapping.builder().indexName(INDEX).build());
    when(vectorService.getEmbeddingClient()).thenReturn(embeddings);
  }

  @Test
  void embeddingAppliesToAnIndexableTypeWithAMappingOnceTheVectorServiceExists() {
    assertTrue(enricher.isEnabledFor(Entity.TABLE));
    assertFalse(enricher.isEnabledFor(Entity.USER), "users are not vector-indexable");

    when(searchRepository.getIndexMapping(Entity.TABLE)).thenReturn(null);
    assertFalse(enricher.isEnabledFor(Entity.TABLE), "no index mapping");

    when(searchRepository.getIndexMapping(Entity.TABLE))
        .thenReturn(IndexMapping.builder().indexName(INDEX).build());
    when(searchRepository.getVectorIndexService()).thenReturn(null);
    assertFalse(enricher.isEnabledFor(Entity.TABLE), "no vector service on either engine");
  }

  @Test
  void aRecreateReadsStoredEmbeddingsFromTheIndexItReplaces() {
    JsonNode stored = storedEmbedding("[0.5,0.6,0.7]");
    when(vectorService.getExistingEmbeddingsBatch(eq(ORIGINAL_INDEX), any()))
        .thenReturn(Map.of(tableId, stored));

    Map<String, JsonNode> reusable =
        enricher.reusableEmbeddings(List.of(table), INDEX, recreateOf(Entity.TABLE));

    assertEquals(Map.of(tableId, stored), reusable);
    assertEquals(
        VectorDocBuilder.computeFingerprintForEntity(table),
        currentFingerprintsSentFor(ORIGINAL_INDEX).get(tableId).get());
  }

  @Test
  void aRunThatRecreatesNothingReadsStoredEmbeddingsFromTheIndexItWrites() {
    JsonNode stored = storedEmbedding("[0.5,0.6,0.7]");
    when(vectorService.getExistingEmbeddingsBatch(eq(INDEX), any()))
        .thenReturn(Map.of(tableId, stored));

    assertEquals(Map.of(tableId, stored), enricher.reusableEmbeddings(List.of(table), INDEX, null));
  }

  @Test
  void aCurrentStoredEmbeddingIsSplicedAndItsChunksBackfilledIntoTheStagedGeneration()
      throws Exception {
    JsonNode stored = storedEmbedding("[0.5,0.6,0.7]");

    String enriched =
        enricher.enrich(
            table, ENTITY_JSON, Map.of(tableId, stored), tracker, recreateOf(Entity.TABLE));

    assertEquals(
        JsonUtils.readTree(
            "{\"name\":\"orders\",\"fingerprint\":\"fp-stored\",\"embedding\":[0.5,0.6,0.7],"
                + "\"textToEmbed\":\"stored text\",\"chunkIndex\":0,\"chunkCount\":1,"
                + "\"parentId\":\""
                + tableId
                + "\"}"),
        JsonUtils.readTree(enriched));
    verify(vectorService).backfillEntityChunks(table, STAGED_CHUNKS);
    verify(vectorService, never()).writeEntityChunks(any(), any(), any());
    assertEquals(0, embeddings.calls.get(), "a reused embedding costs no provider call");
    assertVectorStats(1, 0);
    verify(tracker).recordVector(StatsResult.SUCCESS);
  }

  @Test
  void anEntityWithoutAStoredEmbeddingIsEmbeddedAndItsChunksWrittenToTheLiveIndex()
      throws Exception {
    String enriched = enricher.enrich(table, ENTITY_JSON, Map.of(), tracker, null);

    JsonNode doc = JsonUtils.readTree(enriched);
    assertEquals("orders", doc.path("name").asText());
    assertEquals("[0.1,0.2,0.3]", doc.path("embedding").toString());
    assertEquals(
        VectorDocBuilder.computeFingerprintForEntity(table), doc.path("fingerprint").asText());
    assertEquals(tableId, doc.path("parentId").asText());
    Map<String, Object> chunk = chunksWrittenTo(null).getFirst();
    assertEquals(0, chunk.get("chunkIndex"));
    assertEquals(tableId, chunk.get("parentId"));
    verify(vectorService, never()).backfillEntityChunks(any(), any());
    assertVectorStats(1, 0);
  }

  @Test
  void aStoredEmbeddingOfAnotherDimensionIsRecomputed() throws Exception {
    JsonNode twoDimensional = storedEmbedding("[0.5,0.6]");

    String enriched =
        enricher.enrich(
            table, ENTITY_JSON, Map.of(tableId, twoDimensional), tracker, recreateOf(Entity.TABLE));

    assertEquals("[0.1,0.2,0.3]", JsonUtils.readTree(enriched).path("embedding").toString());
    assertEquals(1, chunksWrittenTo(STAGED_CHUNKS).size());
    verify(vectorService, never()).backfillEntityChunks(any(), any());
  }

  @Test
  void aProviderOutageIndexesTheEntityWithoutAnEmbedding() {
    embeddings.available = false;

    String enriched = enricher.enrich(table, ENTITY_JSON, Map.of(), tracker, null);

    assertEquals(ENTITY_JSON, enriched);
    assertEquals(0, embeddings.calls.get());
    verify(vectorService, never()).writeEntityChunks(any(), any(), any());
    assertVectorStats(1, 0);
  }

  @Test
  void anEntityThatOptsOutOfEmbeddingIsLeftUntouched() {
    entities.when(() -> Entity.isVectorEmbeddable(table)).thenReturn(false);

    String enriched =
        enricher.enrich(
            table, ENTITY_JSON, Map.of(tableId, storedEmbedding("[0.5,0.6,0.7]")), tracker, null);

    assertSame(ENTITY_JSON, enriched);
    verify(vectorService, never()).backfillEntityChunks(any(), any());
    verify(vectorService, never()).writeEntityChunks(any(), any(), any());
    assertVectorStats(0, 0);
    verifyNoInteractions(tracker);
  }

  @Test
  void aFailedChunkWriteIsCountedAndStillIndexesTheEntity() {
    doThrow(new IllegalStateException("bulk rejected"))
        .when(vectorService)
        .writeEntityChunks(any(), any(), any());

    String enriched = enricher.enrich(table, ENTITY_JSON, Map.of(), tracker, null);

    assertSame(ENTITY_JSON, enriched);
    assertVectorStats(0, 1);
    verify(tracker).recordVector(StatsResult.FAILED);
  }

  private void assertVectorStats(int succeeded, int failed) {
    StepStats stats = enricher.stats();
    assertEquals(succeeded, stats.getSuccessRecords());
    assertEquals(failed, stats.getFailedRecords());
    assertEquals(succeeded + failed, stats.getTotalRecords());
  }

  /** A stored entity-doc embedding as the vector service returns it for reuse. */
  private JsonNode storedEmbedding(String vector) {
    return JsonUtils.readTree(
        "{\"fingerprint\":\"fp-stored\",\"embedding\":"
            + vector
            + ",\"textToEmbed\":\"stored text\",\"chunkIndex\":0,\"chunkCount\":1,"
            + "\"parentId\":\""
            + tableId
            + "\"}");
  }

  /** A full recreate: it replaces {@code entityType}'s index and stages a chunk generation. */
  private static ReindexContext recreateOf(String entityType) {
    ReindexContext context = new ReindexContext();
    context.add(entityType, INDEX, ORIGINAL_INDEX, INDEX + "_staged", Set.of(), INDEX, List.of());
    context.setStagedChunkIndex(STAGED_CHUNKS);
    return context;
  }

  @SuppressWarnings("unchecked")
  private Map<String, Supplier<String>> currentFingerprintsSentFor(String indexName) {
    ArgumentCaptor<Map<String, Supplier<String>>> sent = ArgumentCaptor.forClass(Map.class);
    verify(vectorService).getExistingEmbeddingsBatch(eq(indexName), sent.capture());
    return sent.getValue();
  }

  @SuppressWarnings("unchecked")
  private List<Map<String, Object>> chunksWrittenTo(String stagedChunkTarget) {
    ArgumentCaptor<List<Map<String, Object>>> written = ArgumentCaptor.forClass(List.class);
    verify(vectorService)
        .writeEntityChunks(
            eq(tableId),
            written.capture(),
            stagedChunkTarget == null ? isNull() : eq(stagedChunkTarget));
    return written.getValue();
  }

  private static final class ThreeDimensionalEmbeddings extends EmbeddingClient {
    private final AtomicInteger calls = new AtomicInteger();
    private boolean available = true;

    @Override
    protected float[] doEmbed(String text) {
      calls.incrementAndGet();
      return new float[] {0.1f, 0.2f, 0.3f};
    }

    @Override
    public boolean isAvailable() {
      return available;
    }

    @Override
    public int getDimension() {
      return 3;
    }

    @Override
    public String getModelId() {
      return "three-dimensional";
    }
  }
}
