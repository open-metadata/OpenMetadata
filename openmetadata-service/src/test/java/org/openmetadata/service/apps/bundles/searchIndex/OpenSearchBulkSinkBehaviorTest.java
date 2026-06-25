package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StageStatsTracker;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StatsResult;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.search.ReindexContext;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.indexes.DocBuildContext;
import org.openmetadata.service.search.indexes.SearchIndex;
import org.openmetadata.service.search.opensearch.OpenSearchClient;
import org.openmetadata.service.search.vector.OpenSearchVectorService;
import org.openmetadata.service.search.vector.client.EmbeddingClient;

class OpenSearchBulkSinkBehaviorTest {

  private static final String ENTITY_TYPE = "table";

  private SearchRepository searchRepository;
  private OpenSearchClient searchClient;
  private IndexMapping indexMapping;

  @BeforeEach
  void setUp() {
    searchRepository = mock(SearchRepository.class);
    searchClient = mock(OpenSearchClient.class);
    indexMapping = mock(IndexMapping.class);

    when(searchRepository.getSearchClient()).thenReturn(searchClient);
    when(searchRepository.getIndexMapping(ENTITY_TYPE)).thenReturn(indexMapping);
    when(searchRepository.getClusterAlias()).thenReturn("cluster");
    when(indexMapping.getIndexName("cluster")).thenReturn("table_index");
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(false);
  }

  @Test
  void writeReturnsEarlyForEmptyEntitiesAndRejectsMissingEntityType() throws Exception {
    try (MockedConstruction<OpenSearchBulkSink.CustomBulkProcessor> processorConstruction =
        mockConstruction(OpenSearchBulkSink.CustomBulkProcessor.class)) {
      OpenSearchBulkSink sink = new OpenSearchBulkSink(searchRepository, 10, 2, 1000L);

      sink.write(
          List.of(), Map.of(BulkSink.STATS_TRACKER_CONTEXT_KEY, mock(StageStatsTracker.class)));

      assertThrows(
          IllegalArgumentException.class,
          () -> sink.write(List.of(mock(EntityInterface.class)), Map.of()));
      verify(processorConstruction.constructed().getFirst(), never())
          .add(any(), any(), any(), any(), anyLong());
    }
  }

  @Test
  void writeSkipsWhenIndexMappingMissingAndExtractsTrackersSafely() throws Exception {
    StageStatsTracker tracker = mock(StageStatsTracker.class);
    when(searchRepository.getIndexMapping(ENTITY_TYPE)).thenReturn(null);

    try (MockedConstruction<OpenSearchBulkSink.CustomBulkProcessor> processorConstruction =
        mockConstruction(OpenSearchBulkSink.CustomBulkProcessor.class)) {
      OpenSearchBulkSink sink = new OpenSearchBulkSink(searchRepository, 10, 2, 1000L);

      sink.write(
          List.of(mock(EntityInterface.class)),
          Map.of("entityType", ENTITY_TYPE, BulkSink.STATS_TRACKER_CONTEXT_KEY, tracker));

      assertSame(tracker, sink.extractTracker(Map.of(BulkSink.STATS_TRACKER_CONTEXT_KEY, tracker)));
      assertNull(sink.extractTracker(Map.of(BulkSink.STATS_TRACKER_CONTEXT_KEY, "not-a-tracker")));
      assertNull(sink.extractTracker(null));
      verify(processorConstruction.constructed().getFirst(), never())
          .add(any(), any(), any(), any(), anyLong());
    }
  }

  @Test
  void addEntityRecordsSuccessAndProcessStats() throws Exception {
    EntityInterface entity = mock(EntityInterface.class);
    StageStatsTracker tracker = mock(StageStatsTracker.class);
    UUID entityId = UUID.randomUUID();
    when(entity.getId()).thenReturn(entityId);

    try (MockedConstruction<OpenSearchBulkSink.CustomBulkProcessor> processorConstruction =
            mockConstruction(OpenSearchBulkSink.CustomBulkProcessor.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      OpenSearchBulkSink sink = new OpenSearchBulkSink(searchRepository, 10, 2, 1000L);
      OpenSearchBulkSink.CustomBulkProcessor processor =
          processorConstruction.constructed().getFirst();

      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      SearchIndex searchIndex = new StubSearchIndex(Map.of("field", "value"));
      entityMock.when(() -> Entity.getEntityTypeFromObject(entity)).thenReturn(ENTITY_TYPE);
      entityMock.when(() -> Entity.buildSearchIndex(ENTITY_TYPE, entity)).thenReturn(searchIndex);

      invokePrivate(
          sink,
          "addEntity",
          new Class<?>[] {
            EntityInterface.class,
            String.class,
            ReindexContext.class,
            StageStatsTracker.class,
            boolean.class,
            Map.class,
            Map.class
          },
          entity,
          "table_index",
          null,
          tracker,
          false,
          Collections.emptyMap(),
          Collections.emptyMap());

      verify(processor)
          .add(any(), eq(entityId.toString()), eq(ENTITY_TYPE), eq(tracker), anyLong());
      verify(tracker).incrementPendingSink();
      verify(tracker).recordProcess(StatsResult.SUCCESS);
      assertEquals(1, sink.getProcessStats().getSuccessRecords());
      assertEquals(0, sink.getProcessStats().getFailedRecords());
    }
  }

  @Test
  void addEntityRecordsEntityNotFoundFailuresAndInvokesCallback() throws Exception {
    EntityInterface entity = mock(EntityInterface.class);
    StageStatsTracker tracker = mock(StageStatsTracker.class);
    BulkSink.FailureCallback failureCallback = mock(BulkSink.FailureCallback.class);
    UUID entityId = UUID.randomUUID();
    when(entity.getId()).thenReturn(entityId);
    when(entity.getFullyQualifiedName()).thenReturn("table.fqn");

    try (MockedConstruction<OpenSearchBulkSink.CustomBulkProcessor> processorConstruction =
            mockConstruction(OpenSearchBulkSink.CustomBulkProcessor.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      OpenSearchBulkSink sink = new OpenSearchBulkSink(searchRepository, 10, 2, 1000L);
      sink.setFailureCallback(failureCallback);

      entityMock.when(() -> Entity.getEntityTypeFromObject(entity)).thenReturn(ENTITY_TYPE);
      entityMock
          .when(() -> Entity.buildSearchIndex(ENTITY_TYPE, entity))
          .thenThrow(EntityNotFoundException.byId(entityId.toString()));

      invokePrivate(
          sink,
          "addEntity",
          new Class<?>[] {
            EntityInterface.class,
            String.class,
            ReindexContext.class,
            StageStatsTracker.class,
            boolean.class,
            Map.class,
            Map.class
          },
          entity,
          "table_index",
          null,
          tracker,
          false,
          Collections.emptyMap(),
          Collections.emptyMap());

      verify(processorConstruction.constructed().getFirst()).setFailureCallback(failureCallback);
      verify(tracker).recordProcess(StatsResult.FAILED);
      verify(failureCallback)
          .onFailure(
              ENTITY_TYPE,
              entityId.toString(),
              "table.fqn",
              "Entity with id [" + entityId + "] not found.",
              IndexingFailureRecorder.FailureStage.PROCESS);
      assertEquals(1, sink.getStats().getFailedRecords());
      assertEquals(1, sink.getProcessStats().getFailedRecords());
    }
  }

  @Test
  void addTimeSeriesEntityRecordsSuccessAndGenericFailures() throws Exception {
    EntityTimeSeriesInterface successEntity = mock(EntityTimeSeriesInterface.class);
    EntityTimeSeriesInterface failedEntity = mock(EntityTimeSeriesInterface.class);
    StageStatsTracker tracker = mock(StageStatsTracker.class);
    BulkSink.FailureCallback failureCallback = mock(BulkSink.FailureCallback.class);
    UUID successId = UUID.randomUUID();
    UUID failedId = UUID.randomUUID();
    when(successEntity.getId()).thenReturn(successId);
    when(failedEntity.getId()).thenReturn(failedId);

    try (MockedConstruction<OpenSearchBulkSink.CustomBulkProcessor> processorConstruction =
            mockConstruction(OpenSearchBulkSink.CustomBulkProcessor.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      OpenSearchBulkSink sink = new OpenSearchBulkSink(searchRepository, 10, 2, 1000L);
      OpenSearchBulkSink.CustomBulkProcessor processor =
          processorConstruction.constructed().getFirst();
      sink.setFailureCallback(failureCallback);

      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      SearchIndex searchIndex = new StubSearchIndex(Map.of("field", "value"));
      entityMock
          .when(() -> Entity.buildSearchIndex(ENTITY_TYPE, successEntity))
          .thenReturn(searchIndex);
      entityMock
          .when(() -> Entity.buildSearchIndex(ENTITY_TYPE, failedEntity))
          .thenThrow(new IllegalStateException("boom"));

      invokePrivate(
          sink,
          "addTimeSeriesEntity",
          new Class<?>[] {
            EntityTimeSeriesInterface.class, String.class, String.class, StageStatsTracker.class
          },
          successEntity,
          "table_index",
          ENTITY_TYPE,
          tracker);
      invokePrivate(
          sink,
          "addTimeSeriesEntity",
          new Class<?>[] {
            EntityTimeSeriesInterface.class, String.class, String.class, StageStatsTracker.class
          },
          failedEntity,
          "table_index",
          ENTITY_TYPE,
          tracker);

      verify(processor)
          .add(any(), eq(successId.toString()), eq(ENTITY_TYPE), eq(tracker), anyLong());
      verify(tracker).incrementPendingSink();
      verify(tracker).recordProcess(StatsResult.SUCCESS);
      verify(tracker).recordProcess(StatsResult.FAILED);
      verify(failureCallback)
          .onFailure(
              ENTITY_TYPE,
              failedId.toString(),
              null,
              "boom",
              IndexingFailureRecorder.FailureStage.PROCESS);
      assertEquals(1, sink.getProcessStats().getSuccessRecords());
      assertEquals(1, sink.getProcessStats().getFailedRecords());
    }
  }

  @Test
  void flushAndCloseDelegateToProcessorAndPreserveInterrupts() throws Exception {
    try (MockedConstruction<OpenSearchBulkSink.CustomBulkProcessor> processorConstruction =
        mockConstruction(OpenSearchBulkSink.CustomBulkProcessor.class)) {
      OpenSearchBulkSink sink = new OpenSearchBulkSink(searchRepository, 10, 2, 1000L);
      OpenSearchBulkSink.CustomBulkProcessor processor =
          processorConstruction.constructed().getFirst();
      OpenSearchBulkSink.CustomBulkProcessor columnProcessor =
          processorConstruction.constructed().get(1);

      setAtomicField(sink, "totalSubmitted", 3);
      setAtomicField(sink, "totalSuccess", 2);
      setAtomicField(sink, "totalFailed", 1);
      setAtomicField(sink, "processSuccess", 4);
      setAtomicField(sink, "processFailed", 2);

      when(processor.flushAndWait(5, TimeUnit.SECONDS)).thenReturn(true);
      when(columnProcessor.flushAndWait(anyLong(), eq(TimeUnit.SECONDS))).thenReturn(true);
      when(processor.awaitClose(60, TimeUnit.SECONDS)).thenReturn(true);
      when(columnProcessor.awaitClose(30, TimeUnit.SECONDS)).thenReturn(true);

      assertTrue(sink.flushAndAwait(5));
      sink.close();

      verify(processor).flushAndWait(5, TimeUnit.SECONDS);
      verify(columnProcessor).flushAndWait(anyLong(), eq(TimeUnit.SECONDS));
      verify(processor).flush();
      verify(columnProcessor).flush();
      verify(processor).awaitClose(60, TimeUnit.SECONDS);
      verify(columnProcessor).awaitClose(30, TimeUnit.SECONDS);
      assertEquals(3, sink.getStats().getTotalRecords());
      assertEquals(2, sink.getStats().getSuccessRecords());
      assertEquals(1, sink.getStats().getFailedRecords());
      assertEquals(6, sink.getProcessStats().getTotalRecords());

      when(processor.flushAndWait(7, TimeUnit.SECONDS)).thenThrow(new InterruptedException("stop"));
      assertFalse(sink.flushAndAwait(7));
      assertTrue(Thread.currentThread().isInterrupted());
      Thread.interrupted();
    }
  }

  @Test
  void settersUpdateConfigurationAndForwardCallbacks() {
    try (MockedConstruction<OpenSearchBulkSink.CustomBulkProcessor> processorConstruction =
        mockConstruction(OpenSearchBulkSink.CustomBulkProcessor.class)) {
      OpenSearchBulkSink sink = new OpenSearchBulkSink(searchRepository, 10, 2, 1000L);
      OpenSearchBulkSink.CustomBulkProcessor processor =
          processorConstruction.constructed().getFirst();
      BulkSink.FailureCallback failureCallback = mock(BulkSink.FailureCallback.class);
      OpenSearchBulkSink.SinkStatsCallback statsCallback =
          mock(OpenSearchBulkSink.SinkStatsCallback.class);

      sink.updateBatchSize(25);
      sink.updateConcurrentRequests(4);
      sink.setFailureCallback(failureCallback);
      sink.setStatsCallback(statsCallback);

      assertEquals(25, sink.getBatchSize());
      assertEquals(4, sink.getConcurrentRequests());
      verify(processor).setFailureCallback(failureCallback);
      verify(processor).setStatsCallback(statsCallback);
    }
  }

  @Test
  void addEntityLooksUpEntityContextFromMap() throws Exception {
    EntityInterface entity = mock(EntityInterface.class);
    UUID entityId = UUID.randomUUID();
    when(entity.getId()).thenReturn(entityId);
    List<EsLineageData> edges = List.of(new EsLineageData());
    DocBuildContext ctxForEntity = DocBuildContext.withUpstreamLineage(edges);
    Map<UUID, DocBuildContext> docBuildContexts = Map.of(entityId, ctxForEntity);

    try (MockedConstruction<OpenSearchBulkSink.CustomBulkProcessor> ignored =
            mockConstruction(OpenSearchBulkSink.CustomBulkProcessor.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      OpenSearchBulkSink sink = new OpenSearchBulkSink(searchRepository, 10, 2, 1000L);
      ContextCapturingIndex.reset();
      entityMock.when(() -> Entity.getEntityTypeFromObject(entity)).thenReturn(ENTITY_TYPE);
      entityMock
          .when(() -> Entity.buildSearchIndex(ENTITY_TYPE, entity))
          .thenReturn(new ContextCapturingIndex());

      invokePrivate(
          sink,
          "addEntity",
          new Class<?>[] {
            EntityInterface.class,
            String.class,
            ReindexContext.class,
            StageStatsTracker.class,
            boolean.class,
            Map.class,
            Map.class
          },
          entity,
          "table_index",
          null,
          null,
          false,
          Collections.emptyMap(),
          docBuildContexts);

      assertSame(ctxForEntity, ContextCapturingIndex.observedContext);
      assertSame(edges, ContextCapturingIndex.observedContext.prefetchedUpstreamLineage());
    }
  }

  @Test
  void enrichWithEmbeddingReusesCachedFieldsWhenServiceReportsMatch() throws Exception {
    // The service-layer two-step fetch already pre-filters to fingerprint matches; if an entry is
    // present in the map, the splice path is taken without any further fingerprint check.
    EntityInterface entity = mock(EntityInterface.class);
    UUID entityId = UUID.randomUUID();
    when(entity.getId()).thenReturn(entityId);

    StageStatsTracker tracker = mock(StageStatsTracker.class);
    OpenSearchVectorService vectorService = mock(OpenSearchVectorService.class);

    ObjectMapper mapper = new ObjectMapper();
    JsonNode cached =
        mapper.readTree(
            "{\"fingerprint\":\"fp-unchanged\",\"embedding\":[0.1,0.2,0.3],"
                + "\"textToEmbed\":\"cached-text\",\"textToLLMContext\":\"cached-ctx\","
                + "\"chunkIndex\":0,\"chunkCount\":1,\"parentId\":\""
                + entityId
                + "\"}");
    Map<String, JsonNode> existingEmbeddingsById = Map.of(entityId.toString(), cached);

    String entityJson = "{\"name\":\"my-table\",\"description\":\"desc\"}";

    try (MockedConstruction<OpenSearchBulkSink.CustomBulkProcessor> processorConstruction =
            mockConstruction(OpenSearchBulkSink.CustomBulkProcessor.class);
        MockedStatic<OpenSearchVectorService> vectorServiceMock =
            mockStatic(OpenSearchVectorService.class)) {
      vectorServiceMock.when(OpenSearchVectorService::getInstance).thenReturn(vectorService);

      OpenSearchBulkSink sink = new OpenSearchBulkSink(searchRepository, 10, 2, 1000L);

      Method enrich =
          OpenSearchBulkSink.class.getDeclaredMethod(
              "enrichWithEmbedding",
              EntityInterface.class,
              String.class,
              Map.class,
              StageStatsTracker.class);
      enrich.setAccessible(true);
      String result =
          (String) enrich.invoke(sink, entity, entityJson, existingEmbeddingsById, tracker);

      verify(vectorService, never()).generateEmbeddingFields(any());
      verify(tracker).recordVector(StatsResult.SUCCESS);

      JsonNode resultNode = mapper.readTree(result);
      assertEquals("my-table", resultNode.get("name").asText());
      assertEquals("fp-unchanged", resultNode.get("fingerprint").asText());
      JsonNode embedding = resultNode.get("embedding");
      assertNotNull(embedding);
      assertTrue(embedding.isArray());
      assertEquals(3, embedding.size());
      assertEquals("cached-text", resultNode.get("textToEmbed").asText());
    }
  }

  @Test
  void addEntityFallsBackToEmptyContextWhenEntityNotInMap() throws Exception {
    EntityInterface entity = mock(EntityInterface.class);
    when(entity.getId()).thenReturn(UUID.randomUUID());

    try (MockedConstruction<OpenSearchBulkSink.CustomBulkProcessor> ignored =
            mockConstruction(OpenSearchBulkSink.CustomBulkProcessor.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      OpenSearchBulkSink sink = new OpenSearchBulkSink(searchRepository, 10, 2, 1000L);
      ContextCapturingIndex.reset();
      entityMock.when(() -> Entity.getEntityTypeFromObject(entity)).thenReturn(ENTITY_TYPE);
      entityMock
          .when(() -> Entity.buildSearchIndex(ENTITY_TYPE, entity))
          .thenReturn(new ContextCapturingIndex());

      invokePrivate(
          sink,
          "addEntity",
          new Class<?>[] {
            EntityInterface.class,
            String.class,
            ReindexContext.class,
            StageStatsTracker.class,
            boolean.class,
            Map.class,
            Map.class
          },
          entity,
          "table_index",
          null,
          null,
          false,
          Collections.emptyMap(),
          Collections.emptyMap());

      assertSame(DocBuildContext.empty(), ContextCapturingIndex.observedContext);
    }
  }

  @Test
  void enrichWithEmbeddingRecomputesWhenNoCachedEntryAvailable() throws Exception {
    // When the service-layer fetch returns nothing for this entity (cache miss or fingerprint
    // mismatch filtered upstream), the call site must regenerate embeddings.
    EntityInterface entity = mock(EntityInterface.class);
    UUID entityId = UUID.randomUUID();
    when(entity.getId()).thenReturn(entityId);

    StageStatsTracker tracker = mock(StageStatsTracker.class);
    OpenSearchVectorService vectorService = mock(OpenSearchVectorService.class);
    when(vectorService.generateEmbeddingFields(entity))
        .thenReturn(
            Map.of(
                "fingerprint", "fp-new",
                "embedding", List.of(0.9, 0.8, 0.7),
                "textToEmbed", "fresh-text"));

    Map<String, JsonNode> existingEmbeddingsById = Collections.emptyMap();
    String entityJson = "{\"name\":\"my-table\"}";

    try (MockedConstruction<OpenSearchBulkSink.CustomBulkProcessor> processorConstruction =
            mockConstruction(OpenSearchBulkSink.CustomBulkProcessor.class);
        MockedStatic<OpenSearchVectorService> vectorServiceMock =
            mockStatic(OpenSearchVectorService.class)) {
      vectorServiceMock.when(OpenSearchVectorService::getInstance).thenReturn(vectorService);

      OpenSearchBulkSink sink = new OpenSearchBulkSink(searchRepository, 10, 2, 1000L);

      Method enrich =
          OpenSearchBulkSink.class.getDeclaredMethod(
              "enrichWithEmbedding",
              EntityInterface.class,
              String.class,
              Map.class,
              StageStatsTracker.class);
      enrich.setAccessible(true);
      String result =
          (String) enrich.invoke(sink, entity, entityJson, existingEmbeddingsById, tracker);

      verify(vectorService).generateEmbeddingFields(entity);
      verify(tracker).recordVector(StatsResult.SUCCESS);

      ObjectMapper mapper = new ObjectMapper();
      JsonNode resultNode = mapper.readTree(result);
      assertEquals("fp-new", resultNode.get("fingerprint").asText());
      assertEquals("fresh-text", resultNode.get("textToEmbed").asText());
    }
  }

  @Test
  void enrichWithEmbeddingRecomputesWhenCachedEntryHasNoEmbedding() throws Exception {
    // Defensive: even if the service layer ever admits an entry without an embedding (e.g. a doc
    // indexed before embeddings were enabled), the splice site must not blindly trust it.
    EntityInterface entity = mock(EntityInterface.class);
    UUID entityId = UUID.randomUUID();
    when(entity.getId()).thenReturn(entityId);

    StageStatsTracker tracker = mock(StageStatsTracker.class);
    OpenSearchVectorService vectorService = mock(OpenSearchVectorService.class);
    when(vectorService.generateEmbeddingFields(entity))
        .thenReturn(Map.of("fingerprint", "fp-new", "embedding", List.of(0.1, 0.2, 0.3)));

    ObjectMapper mapper = new ObjectMapper();
    JsonNode cachedWithoutEmbedding = mapper.readTree("{\"fingerprint\":\"fp-old\"}");
    Map<String, JsonNode> existingEmbeddingsById =
        Map.of(entityId.toString(), cachedWithoutEmbedding);

    try (MockedConstruction<OpenSearchBulkSink.CustomBulkProcessor> processorConstruction =
            mockConstruction(OpenSearchBulkSink.CustomBulkProcessor.class);
        MockedStatic<OpenSearchVectorService> vectorServiceMock =
            mockStatic(OpenSearchVectorService.class)) {
      vectorServiceMock.when(OpenSearchVectorService::getInstance).thenReturn(vectorService);

      OpenSearchBulkSink sink = new OpenSearchBulkSink(searchRepository, 10, 2, 1000L);
      Method enrich =
          OpenSearchBulkSink.class.getDeclaredMethod(
              "enrichWithEmbedding",
              EntityInterface.class,
              String.class,
              Map.class,
              StageStatsTracker.class);
      enrich.setAccessible(true);

      String result =
          (String) enrich.invoke(sink, entity, "{\"name\":\"x\"}", existingEmbeddingsById, tracker);

      verify(vectorService).generateEmbeddingFields(entity);
      verify(tracker).recordVector(StatsResult.SUCCESS);
      assertEquals("fp-new", mapper.readTree(result).get("fingerprint").asText());
    }
  }

  @Test
  void enrichWithEmbeddingRecomputesWhenCachedNodeIsNotAnObject() throws Exception {
    // Defensive: a malformed _source (array or scalar instead of object) must not crash the splice
    // path; we fall through to regeneration.
    EntityInterface entity = mock(EntityInterface.class);
    UUID entityId = UUID.randomUUID();
    when(entity.getId()).thenReturn(entityId);

    StageStatsTracker tracker = mock(StageStatsTracker.class);
    OpenSearchVectorService vectorService = mock(OpenSearchVectorService.class);
    when(vectorService.generateEmbeddingFields(entity))
        .thenReturn(Map.of("fingerprint", "fp-new", "embedding", List.of(0.4, 0.5, 0.6)));

    ObjectMapper mapper = new ObjectMapper();
    JsonNode arrayInsteadOfObject = mapper.readTree("[1,2,3]");
    Map<String, JsonNode> existingEmbeddingsById =
        Map.of(entityId.toString(), arrayInsteadOfObject);

    try (MockedConstruction<OpenSearchBulkSink.CustomBulkProcessor> processorConstruction =
            mockConstruction(OpenSearchBulkSink.CustomBulkProcessor.class);
        MockedStatic<OpenSearchVectorService> vectorServiceMock =
            mockStatic(OpenSearchVectorService.class)) {
      vectorServiceMock.when(OpenSearchVectorService::getInstance).thenReturn(vectorService);

      OpenSearchBulkSink sink = new OpenSearchBulkSink(searchRepository, 10, 2, 1000L);
      Method enrich =
          OpenSearchBulkSink.class.getDeclaredMethod(
              "enrichWithEmbedding",
              EntityInterface.class,
              String.class,
              Map.class,
              StageStatsTracker.class);
      enrich.setAccessible(true);

      String result =
          (String) enrich.invoke(sink, entity, "{\"name\":\"y\"}", existingEmbeddingsById, tracker);

      verify(vectorService).generateEmbeddingFields(entity);
      verify(tracker).recordVector(StatsResult.SUCCESS);
      assertEquals("fp-new", mapper.readTree(result).get("fingerprint").asText());
    }
  }

  @Test
  void enrichWithEmbeddingRecomputesWhenCachedDimensionMismatchesClient() throws Exception {
    // Reuse is keyed only on entity content (fingerprint / updatedAt), which does NOT change when
    // the embedding model/dimension changes. A cached vector whose length no longer matches the
    // active client's dimension must be regenerated — otherwise an old-dimension vector would be
    // spliced into a staged index built for the new dimension and silently rejected by the knn
    // field. This is the recreate-after-model-change dimension mismatch.
    EntityInterface entity = mock(EntityInterface.class);
    UUID entityId = UUID.randomUUID();
    when(entity.getId()).thenReturn(entityId);

    StageStatsTracker tracker = mock(StageStatsTracker.class);
    OpenSearchVectorService vectorService = mock(OpenSearchVectorService.class);
    EmbeddingClient embeddingClient = mock(EmbeddingClient.class);
    when(embeddingClient.getDimension()).thenReturn(4);
    when(vectorService.getEmbeddingClient()).thenReturn(embeddingClient);
    when(vectorService.generateEmbeddingFields(entity))
        .thenReturn(Map.of("fingerprint", "fp-new", "embedding", List.of(0.1, 0.2, 0.3, 0.4)));

    ObjectMapper mapper = new ObjectMapper();
    // Cached embedding has 3 dims; the active client now reports 4 -> must NOT be reused.
    JsonNode staleDimensionCached =
        mapper.readTree(
            "{\"fingerprint\":\"fp-unchanged\",\"embedding\":[0.1,0.2,0.3],\"parentId\":\""
                + entityId
                + "\"}");
    Map<String, JsonNode> existingEmbeddingsById =
        Map.of(entityId.toString(), staleDimensionCached);

    try (MockedConstruction<OpenSearchBulkSink.CustomBulkProcessor> processorConstruction =
            mockConstruction(OpenSearchBulkSink.CustomBulkProcessor.class);
        MockedStatic<OpenSearchVectorService> vectorServiceMock =
            mockStatic(OpenSearchVectorService.class)) {
      vectorServiceMock.when(OpenSearchVectorService::getInstance).thenReturn(vectorService);

      OpenSearchBulkSink sink = new OpenSearchBulkSink(searchRepository, 10, 2, 1000L);
      Method enrich =
          OpenSearchBulkSink.class.getDeclaredMethod(
              "enrichWithEmbedding",
              EntityInterface.class,
              String.class,
              Map.class,
              StageStatsTracker.class);
      enrich.setAccessible(true);

      String result =
          (String) enrich.invoke(sink, entity, "{\"name\":\"z\"}", existingEmbeddingsById, tracker);

      verify(vectorService).generateEmbeddingFields(entity);
      verify(tracker).recordVector(StatsResult.SUCCESS);
      JsonNode resultNode = mapper.readTree(result);
      assertEquals("fp-new", resultNode.get("fingerprint").asText());
      assertEquals(4, resultNode.get("embedding").size());
    }
  }

  private Object invokePrivate(
      Object target, String methodName, Class<?>[] parameterTypes, Object... args)
      throws Exception {
    Method method = target.getClass().getDeclaredMethod(methodName, parameterTypes);
    method.setAccessible(true);
    return method.invoke(target, args);
  }

  private void setAtomicField(Object target, String fieldName, long value) throws Exception {
    Field field = target.getClass().getDeclaredField(fieldName);
    field.setAccessible(true);
    Object current = field.get(target);
    if (current instanceof AtomicLong atomicLong) {
      atomicLong.set(value);
    } else if (current instanceof java.util.concurrent.atomic.AtomicInteger atomicInteger) {
      atomicInteger.set((int) value);
    } else {
      throw new IllegalStateException("Unsupported atomic field " + fieldName);
    }
  }

  private static class StubSearchIndex implements SearchIndex {
    private final Map<String, Object> doc;

    private StubSearchIndex(Map<String, Object> doc) {
      this.doc = doc;
    }

    @Override
    public Map<String, Object> buildSearchIndexDoc(DocBuildContext ctx) {
      return doc;
    }

    @Override
    public Object getEntity() {
      return Map.of();
    }

    @Override
    public String getEntityTypeName() {
      return "stub";
    }

    @Override
    public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> esDoc) {
      return doc;
    }
  }

  private static class ContextCapturingIndex implements SearchIndex {
    private static DocBuildContext observedContext;

    static void reset() {
      observedContext = null;
    }

    @Override
    public Map<String, Object> buildSearchIndexDoc(DocBuildContext ctx) {
      observedContext = ctx;
      return Map.of("field", "value");
    }

    @Override
    public Object getEntity() {
      return Map.of();
    }

    @Override
    public String getEntityTypeName() {
      return "stub-ctx";
    }

    @Override
    public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> esDoc) {
      return esDoc;
    }
  }
}
