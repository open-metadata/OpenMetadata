package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
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
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StageStatsTracker;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StatsResult;
import org.openmetadata.service.search.ReindexContext;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.VectorFieldHealth;
import org.openmetadata.service.search.vector.VectorDocBuilder;
import org.openmetadata.service.search.vector.VectorIndexService;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.slf4j.LoggerFactory;

class EmbeddingEnricherTest {
  private static final String INDEX = "table_search_index";
  private static final String ORIGINAL_INDEX = "table_search_index_rebuild_1";
  private static final String STAGED_INDEX = INDEX + "_staged";
  private static final String STAGED_CHUNKS = "data_asset_embeddings_chunks_g1700000000000";
  private static final String ENTITY_JSON = "{\"name\":\"orders\"}";

  private final SearchRepository searchRepository = mock(SearchRepository.class);
  private final VectorFieldHealth vectorFieldHealth = new VectorFieldHealth(name -> {});
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
    lenient().when(searchRepository.getVectorFieldHealth()).thenReturn(vectorFieldHealth);
    when(searchRepository.getVectorIndexService()).thenReturn(vectorService);
    when(searchRepository.getIndexMapping(Entity.TABLE))
        .thenReturn(IndexMapping.builder().indexName(INDEX).build());
    when(vectorService.getEmbeddingClient()).thenReturn(embeddings);
    when(vectorService.backfillEntityChunks(any(), any())).thenReturn(true);
    when(vectorService.writeEntityChunks(any(), any(), any())).thenReturn(true);
    when(vectorService.writeEntityEmbedding(any(), any(), any())).thenReturn(true);
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
        enricher.enrich(table, ENTITY_JSON, Map.of(tableId, stored), tracker, recreateRun());

    assertEquals(
        JsonUtils.readTree(
            "{\"name\":\"orders\",\"fingerprint\":\"fp-stored\",\"embedding\":[0.5,0.6,0.7],"
                + "\"textToEmbed\":\"stored text\",\"chunkIndex\":0,\"chunkCount\":1,"
                + "\"parentId\":\""
                + tableId
                + "\",\"embeddingModel\":\"three-dimensional\",\"embeddingDimension\":3}"),
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
    String enriched = enricher.enrich(table, ENTITY_JSON, Map.of(), tracker, liveRun());

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
  void anInPlaceRunWritesNoVectorsToALiveIndexThatCannotHoldTheModel() throws Exception {
    vectorFieldHealth.recordCannotHold(
        INDEX, Set.of(INDEX + "_rebuild_1"), INDEX + "_rebuild_1 holds vectors of model model-a");

    String enriched = enricher.enrich(table, ENTITY_JSON, Map.of(), tracker, liveRun());

    assertEquals(ENTITY_JSON, enriched, "the document goes in whole, without vectors");
    verify(vectorService, never()).writeEntityChunks(any(), any(), any());
    assertEquals(0, embeddings.calls.get(), "no provider call for vectors nowhere can hold");
  }

  @Test
  void aStoredEmbeddingOfAnotherDimensionIsRecomputed() throws Exception {
    JsonNode twoDimensional = storedEmbedding("[0.5,0.6]");

    String enriched =
        enricher.enrich(
            table, ENTITY_JSON, Map.of(tableId, twoDimensional), tracker, recreateRun());

    assertEquals("[0.1,0.2,0.3]", JsonUtils.readTree(enriched).path("embedding").toString());
    assertEquals(1, chunksWrittenTo(STAGED_CHUNKS).size());
    verify(vectorService, never()).backfillEntityChunks(any(), any());
  }

  @Test
  void aStoredEmbeddingOfAnotherModelOfTheSameDimensionIsRecomputed() throws Exception {
    JsonNode otherModel = storedEmbedding("[0.5,0.6,0.7]", "another-model");

    String enriched =
        enricher.enrich(table, ENTITY_JSON, Map.of(tableId, otherModel), tracker, recreateRun());

    JsonNode doc = JsonUtils.readTree(enriched);
    assertEquals("[0.1,0.2,0.3]", doc.path("embedding").toString());
    assertEquals(1, chunksWrittenTo(STAGED_CHUNKS).size());
    verify(vectorService, never()).backfillEntityChunks(any(), any());
  }

  @Test
  void aStoredEmbeddingThatRecordsNoModelIsRecomputedOnce() throws Exception {
    JsonNode unrecorded = storedEmbeddingRecordingNoModel("[0.5,0.6,0.7]");

    String enriched =
        enricher.enrich(table, ENTITY_JSON, Map.of(tableId, unrecorded), tracker, liveRun());

    JsonNode doc = JsonUtils.readTree(enriched);
    assertEquals("[0.1,0.2,0.3]", doc.path("embedding").toString());
    assertEquals("three-dimensional", doc.path("embeddingModel").asText());
    assertEquals(3, doc.path("embeddingDimension").asInt());
    verify(vectorService, never()).backfillEntityChunks(any(), any());
  }

  @Test
  void aFreshEmbedTheProviderFailsIsRetriedAndWritesTheEntityEmbeddingAndChunks() {
    embeddings.failuresLeft = 1;
    theRetryReadsTheTable();

    String enriched = enricher.enrich(table, ENTITY_JSON, Map.of(), tracker, recreateRun());

    assertEquals(JsonUtils.readTree(ENTITY_JSON), JsonUtils.readTree(enriched));
    verify(vectorService, never()).writeEntityChunks(any(), any(), any());
    assertVectorStats(0, 0);
    enricher.retryMissedChunks(tracker);

    Map<String, Object> written = entityEmbeddingWrittenTo(STAGED_INDEX);
    assertEquals(VectorDocBuilder.computeFingerprintForEntity(table), written.get("fingerprint"));
    assertTrue(written.containsKey("embedding"), "the entity document gets its embedding");
    Map<String, Object> chunk = chunksWrittenTo(STAGED_CHUNKS).getFirst();
    assertEquals(VectorDocBuilder.legacyEmbeddingFields(chunk), written);
    verify(vectorService, never()).backfillEntityChunks(any(), any());
    assertVectorStats(1, 0);
    verify(tracker).recordVector(StatsResult.SUCCESS);
    verify(tracker, never()).recordVector(StatsResult.FAILED);
  }

  @Test
  void aFreshEmbedRetriedOnALiveRunWritesToTheLiveIndexes() {
    embeddings.failuresLeft = 1;
    theRetryReadsTheTable();

    enricher.enrich(table, ENTITY_JSON, Map.of(), tracker, liveRun());
    enricher.retryMissedChunks(tracker);

    entityEmbeddingWrittenTo(INDEX);
    assertEquals(1, chunksWrittenTo(null).size());
    assertVectorStats(1, 0);
  }

  @Test
  void aFreshEmbedThatFailsAgainCountsOneFailureAndWritesNothing() {
    embeddings.failuresLeft = Integer.MAX_VALUE;
    theRetryReadsTheTable();

    enricher.enrich(table, ENTITY_JSON, Map.of(), tracker, recreateRun());
    enricher.retryMissedChunks(tracker);
    enricher.retryMissedChunks(tracker);

    assertEquals(2, embeddings.calls.get(), "one first attempt and one retry");
    verify(vectorService, never()).writeEntityEmbedding(any(), any(), any());
    verify(vectorService, never()).writeEntityChunks(any(), any(), any());
    assertVectorStats(0, 1);
    verify(tracker).recordVector(StatsResult.FAILED);
  }

  @Test
  void aRetryThatCannotWriteTheChunksStillWritesTheEntityEmbeddingAndCountsAFailure() {
    embeddings.failuresLeft = 1;
    when(vectorService.writeEntityChunks(any(), any(), any())).thenReturn(false);
    theRetryReadsTheTable();

    enricher.enrich(table, ENTITY_JSON, Map.of(), tracker, recreateRun());
    enricher.retryMissedChunks(tracker);

    entityEmbeddingWrittenTo(STAGED_INDEX);
    assertVectorStats(0, 1);
  }

  @Test
  void anOpenCircuitOnTheFreshPathMakesNoCallAndCountsTheMissOnceAfterTheSkippedRetry() {
    embeddings.available = false;
    theRetryReadsTheTable();

    String enriched = enricher.enrich(table, ENTITY_JSON, Map.of(), tracker, recreateRun());
    assertVectorStats(0, 0);
    enricher.retryMissedChunks(tracker);

    assertEquals(ENTITY_JSON, enriched);
    assertEquals(0, embeddings.calls.get(), "no provider call while the circuit is open");
    verify(vectorService, never()).writeEntityEmbedding(any(), any(), any());
    verify(vectorService, never()).writeEntityChunks(any(), any(), any());
    assertVectorStats(0, 1);
    verify(tracker).recordVector(StatsResult.FAILED);
  }

  @Test
  void freshEmbedMissesLogOneSummaryWarningAndNoStackTracePerEntity() {
    ListAppender<ILoggingEvent> log = captureLogsOf(EmbeddingEnricher.class, MissedChunks.class);
    Table other =
        new Table()
            .withId(UUID.randomUUID())
            .withName("refunds")
            .withFullyQualifiedName("svc.db.schema.refunds")
            .withDescription("Refunds");
    entities.when(() -> Entity.isVectorEmbeddable(other)).thenReturn(true);
    embeddings.failuresLeft = 2;
    theRetryReadsTheTable();

    enricher.enrich(table, ENTITY_JSON, Map.of(), tracker, recreateRun());
    enricher.enrich(other, ENTITY_JSON, Map.of(), tracker, recreateRun());
    assertTrue(atLeast(log, Level.WARN).isEmpty(), "no warning per entity");
    enricher.retryMissedChunks(tracker);
    enricher.logMissedChunksSummary();

    List<ILoggingEvent> warnings = atLeast(log, Level.WARN);
    assertEquals(1, warnings.size());
    assertTrue(
        warnings
            .getFirst()
            .getFormattedMessage()
            .startsWith(
                "Search Indexing missed the chunk "
                    + "documents of 2 entities on this node, 2 of them with their entity embedding too; "
                    + "the retry recovered 2."));
    assertTrue(log.list.stream().allMatch(event -> event.getThrowableProxy() == null));
  }

  @Test
  void aMissedChunkWriteIsRetriedOnceAndCountsOneSuccessWhenItRecovers() {
    when(vectorService.backfillEntityChunks(table, STAGED_CHUNKS)).thenReturn(false, true);
    theRetryReadsTheTable();

    enricher.enrich(
        table,
        ENTITY_JSON,
        Map.of(tableId, storedEmbedding("[0.5,0.6,0.7]")),
        tracker,
        recreateRun());
    assertVectorStats(0, 0);
    enricher.retryMissedChunks(tracker);
    enricher.retryMissedChunks(tracker);

    verify(vectorService, times(2)).backfillEntityChunks(table, STAGED_CHUNKS);
    assertVectorStats(1, 0);
    verify(tracker).recordVector(StatsResult.SUCCESS);
    verify(tracker).flush();
  }

  @Test
  void aChunkWriteThatStillMissesAfterTheRetryCountsOneFailure() {
    when(vectorService.writeEntityChunks(any(), any(), any())).thenReturn(false);
    when(vectorService.backfillEntityChunks(table, STAGED_CHUNKS)).thenReturn(false);
    theRetryReadsTheTable();

    enricher.enrich(table, ENTITY_JSON, Map.of(), tracker, recreateRun());
    enricher.retryMissedChunks(tracker);

    verify(vectorService).backfillEntityChunks(table, STAGED_CHUNKS);
    assertVectorStats(0, 1);
    verify(tracker).recordVector(StatsResult.FAILED);
  }

  @Test
  void anOpenCircuitSkipsTheRetryAndCountsAFailure() {
    when(vectorService.backfillEntityChunks(table, STAGED_CHUNKS)).thenReturn(false);
    theRetryReadsTheTable();

    enricher.enrich(
        table,
        ENTITY_JSON,
        Map.of(tableId, storedEmbedding("[0.5,0.6,0.7]")),
        tracker,
        recreateRun());
    embeddings.available = false;
    enricher.retryMissedChunks(tracker);

    verify(vectorService, times(1)).backfillEntityChunks(table, STAGED_CHUNKS);
    assertEquals(0, embeddings.calls.get(), "no provider call while the circuit is open");
    assertVectorStats(0, 1);
  }

  @Test
  void aRetryLeavesTheMissesOfAnotherPartitionOfTheSameTypePending() {
    StageStatsTracker otherPartition = mock(StageStatsTracker.class);
    embeddings.failuresLeft = 1;
    theRetryReadsTheTable();

    enricher.enrich(table, ENTITY_JSON, Map.of(), tracker, recreateRun());
    enricher.retryMissedChunks(otherPartition);

    assertEquals(
        1, embeddings.calls.get(), "the other partition's document may not be written yet");
    verify(vectorService, never()).writeEntityEmbedding(any(), any(), any());
    verifyNoInteractions(otherPartition);
    assertVectorStats(0, 0);

    enricher.retryMissedChunks(tracker);

    entityEmbeddingWrittenTo(STAGED_INDEX);
    assertVectorStats(1, 0);
  }

  private void theRetryReadsTheTable() {
    entities
        .when(() -> Entity.getEntity(any(EntityReference.class), eq("*"), eq(Include.NON_DELETED)))
        .thenReturn(table);
  }

  @Test
  void anEntityThatOptsOutOfEmbeddingIsLeftUntouched() {
    entities.when(() -> Entity.isVectorEmbeddable(table)).thenReturn(false);

    String enriched =
        enricher.enrich(
            table,
            ENTITY_JSON,
            Map.of(tableId, storedEmbedding("[0.5,0.6,0.7]")),
            tracker,
            liveRun());

    assertSame(ENTITY_JSON, enriched);
    verify(vectorService, never()).backfillEntityChunks(any(), any());
    verify(vectorService, never()).writeEntityChunks(any(), any(), any());
    assertVectorStats(0, 0);
    verifyNoInteractions(tracker);
  }

  @Test
  void aReusedEmbeddingOfANonRecreateRunIsSplicedAndBackfilledToTheLiveIndex() {
    String enriched =
        enricher.enrich(
            table,
            ENTITY_JSON,
            Map.of(tableId, storedEmbedding("[0.5,0.6,0.7]")),
            tracker,
            liveRun());

    JsonNode doc = JsonUtils.readTree(enriched);
    assertEquals("fp-stored", doc.path("fingerprint").asText());
    assertEquals("[0.5,0.6,0.7]", doc.path("embedding").toString());
    verify(vectorService).backfillEntityChunks(table, null);
    assertVectorStats(1, 0);
  }

  private void assertVectorStats(int succeeded, int failed) {
    StepStats stats = enricher.stats();
    assertEquals(succeeded, stats.getSuccessRecords());
    assertEquals(failed, stats.getFailedRecords());
    assertEquals(succeeded + failed, stats.getTotalRecords());
  }

  /** A stored entity-doc embedding of the configured model, as the vector service returns it. */
  private JsonNode storedEmbedding(String vector) {
    return storedEmbedding(vector, embeddings.getModelId());
  }

  /** A stored entity-doc embedding that records {@code model} as the model that produced it. */
  private JsonNode storedEmbedding(String vector, String model) {
    ObjectNode stored = storedEmbeddingRecordingNoModel(vector);
    return stored
        .put("embeddingModel", model)
        .put("embeddingDimension", JsonUtils.readTree(vector).size());
  }

  /** As a release before vectors recorded their model left it. */
  private ObjectNode storedEmbeddingRecordingNoModel(String vector) {
    return (ObjectNode)
        JsonUtils.readTree(
            "{\"fingerprint\":\"fp-stored\",\"embedding\":"
                + vector
                + ",\"textToEmbed\":\"stored text\",\"chunkIndex\":0,\"chunkCount\":1,"
                + "\"parentId\":\""
                + tableId
                + "\"}");
  }

  private static EmbeddingTargets liveRun() {
    return EmbeddingTargets.of(INDEX, null);
  }

  private static EmbeddingTargets recreateRun() {
    return EmbeddingTargets.of(STAGED_INDEX, recreateOf(Entity.TABLE));
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> entityEmbeddingWrittenTo(String entityIndex) {
    ArgumentCaptor<Map<String, Object>> written = ArgumentCaptor.forClass(Map.class);
    verify(vectorService).writeEntityEmbedding(eq(entityIndex), eq(tableId), written.capture());
    return written.getValue();
  }

  private final List<Logger> capturedLoggers = new ArrayList<>();
  private final ListAppender<ILoggingEvent> capturedLog = new ListAppender<>();

  private ListAppender<ILoggingEvent> captureLogsOf(Class<?>... owners) {
    capturedLog.start();
    for (Class<?> owner : owners) {
      Logger logger = (Logger) LoggerFactory.getLogger(owner);
      logger.addAppender(capturedLog);
      capturedLoggers.add(logger);
    }
    return capturedLog;
  }

  @AfterEach
  void releaseCapturedLogs() {
    capturedLoggers.forEach(logger -> logger.detachAppender(capturedLog));
  }

  private static List<ILoggingEvent> atLeast(ListAppender<ILoggingEvent> log, Level level) {
    return log.list.stream().filter(event -> event.getLevel().isGreaterOrEqual(level)).toList();
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
    private int failuresLeft;

    @Override
    protected float[] doEmbed(String text) {
      calls.incrementAndGet();
      if (failuresLeft > 0) {
        failuresLeft--;
        throw new IllegalStateException("OpenAI API returned status 429: injected");
      }
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
