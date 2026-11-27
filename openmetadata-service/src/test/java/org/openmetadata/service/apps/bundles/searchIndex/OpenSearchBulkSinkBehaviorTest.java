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
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StageStatsTracker;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StatsResult;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.search.ReindexContext;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.VectorFieldHealth;
import org.openmetadata.service.search.indexes.DocBuildContext;
import org.openmetadata.service.search.indexes.SearchIndex;
import org.openmetadata.service.search.opensearch.OpenSearchClient;
import org.openmetadata.service.search.opensearch.OsUtils;
import org.openmetadata.service.search.vector.VectorIndexService;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.opensearch._types.Script;
import os.org.opensearch.client.opensearch.core.bulk.BulkOperation;

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
    lenient()
        .when(searchRepository.getVectorFieldHealth())
        .thenReturn(new VectorFieldHealth(name -> {}));
    lenient()
        .when(searchClient.getBulkConnectionBudget())
        .thenReturn(BulkConnectionBudget.forPoolCapacity(1_000));
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
    EntityInterface<?> entity = mock(EntityInterface.class);
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
            Map.class,
            boolean.class
          },
          entity,
          "table_index",
          null,
          tracker,
          false,
          Collections.emptyMap(),
          Collections.emptyMap(),
          false);

      verify(processor)
          .add(any(), eq(entityId.toString()), eq(ENTITY_TYPE), eq(tracker), anyLong());
      verify(tracker).incrementPendingSink();
      verify(tracker).recordProcess(StatsResult.SUCCESS);
      assertEquals(1, sink.getProcessStats().getSuccessRecords());
      assertEquals(0, sink.getProcessStats().getFailedRecords());
    }
  }

  @Test
  void relationshipPartialUpdateUsesVectorEnrichedFullUpsertWithoutRewritingOtherFields()
      throws Exception {
    EntityInterface<?> entity = mock(EntityInterface.class);
    UUID entityId = UUID.randomUUID();
    when(entity.getId()).thenReturn(entityId);
    when(entity.getEntityReference())
        .thenReturn(new EntityReference().withId(entityId).withType(Entity.TEST_CASE));
    SearchRepository.ScriptedPartialUpdate partialUpdate =
        new SearchRepository.ScriptedPartialUpdate(
            "ctx._source.testSuites = params.testSuites;",
            Map.of("testSuites", List.of(Map.of("id", "suite-id"))));
    when(searchRepository.buildBulkScriptedPartialUpdate(entity, 17L)).thenReturn(partialUpdate);
    JsonNode cachedEmbedding =
        new ObjectMapper()
            .readTree(
                "{\"fingerprint\":\"fp\",\"embedding\":[0.1,0.2],"
                    + "\"textToEmbed\":\"text\",\"textToLLMContext\":\"context\","
                    + "\"chunkIndex\":0,\"chunkCount\":1,\"parentId\":\""
                    + entityId
                    + "\",\"embeddingModel\":\"two-dimensional\",\"embeddingDimension\":2}");
    VectorIndexService vectorService = mock(VectorIndexService.class);
    EmbeddingClient embeddingClient = mock(EmbeddingClient.class);
    when(vectorService.getEmbeddingClient()).thenReturn(embeddingClient);
    when(embeddingClient.getModelId()).thenReturn("two-dimensional");
    when(embeddingClient.getDimension()).thenReturn(2);
    when(searchRepository.getVectorIndexService()).thenReturn(vectorService);

    try (MockedConstruction<OpenSearchBulkSink.CustomBulkProcessor> processorConstruction =
            mockConstruction(OpenSearchBulkSink.CustomBulkProcessor.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      OpenSearchBulkSink sink = new OpenSearchBulkSink(searchRepository, 10, 2, 2000L);
      OpenSearchBulkSink.CustomBulkProcessor processor =
          processorConstruction.constructed().getFirst();
      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      entityMock.when(() -> Entity.getEntityTypeFromObject(entity)).thenReturn(Entity.TEST_CASE);
      // The bulk sink consults this to keep restricted ContextMemory out of the vector index.
      entityMock.when(() -> Entity.isVectorEmbeddable(entity)).thenReturn(true);
      entityMock
          .when(() -> Entity.buildSearchIndex(Entity.TEST_CASE, entity))
          .thenReturn(
              new StubSearchIndex(Map.of("name", "current", "description", "current description")));

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
            Map.class,
            boolean.class,
            Map.class
          },
          entity,
          "table_index",
          null,
          null,
          true,
          Map.of(entityId.toString(), cachedEmbedding),
          Collections.emptyMap(),
          true,
          Map.of(entityId, 17L));

      ArgumentCaptor<BulkOperation> operationCaptor = ArgumentCaptor.forClass(BulkOperation.class);
      verify(processor)
          .add(
              operationCaptor.capture(),
              eq(entityId.toString()),
              eq(Entity.TEST_CASE),
              isNull(),
              anyLong());
      BulkOperation operation = operationCaptor.getValue();
      assertTrue(operation.isUpdate());
      Object operationData = getPrivateField(operation.update(), "data");
      assertFalse(Boolean.TRUE.equals(getPrivateField(operationData, "scriptedUpsert")));
      Map<String, Object> upsert =
          OsUtils.jsonDataToMap((JsonData) getPrivateField(operationData, "upsert"));
      assertEquals("current description", upsert.get("description"));
      assertEquals(17L, ((Number) upsert.get("testSuitesRevision")).longValue());
      assertNotNull(upsert.get("embedding"));
      Script script = (Script) getPrivateField(operationData, "script");
      assertEquals("ctx._source.testSuites = params.testSuites;", script.inline().source());
    }
  }

  @Test
  void scriptedUpsertConvertsNullFieldsIntoExplicitRemovals() throws Exception {
    Map<String, Object> parameters = new HashMap<>();
    parameters.put("name", "current");
    parameters.put("description", null);
    parameters.put("fieldsToRemove", List.of("displayName"));
    SearchRepository.ScriptedPartialUpdate partialUpdate =
        new SearchRepository.ScriptedPartialUpdate("remove-null-fields", parameters, true);

    try (MockedConstruction<OpenSearchBulkSink.CustomBulkProcessor> processorConstruction =
        mockConstruction(OpenSearchBulkSink.CustomBulkProcessor.class)) {
      OpenSearchBulkSink sink = new OpenSearchBulkSink(searchRepository, 10, 2, 1000L);

      invokePrivate(
          sink,
          "addScriptedPartialUpdate",
          new Class<?>[] {
            String.class,
            String.class,
            String.class,
            SearchRepository.ScriptedPartialUpdate.class,
            String.class,
            StageStatsTracker.class
          },
          "test_case_index",
          "test-case-id",
          Entity.TEST_CASE,
          partialUpdate,
          "{\"name\":\"current\"}",
          null);

      ArgumentCaptor<BulkOperation> operationCaptor = ArgumentCaptor.forClass(BulkOperation.class);
      verify(processorConstruction.constructed().getFirst())
          .add(
              operationCaptor.capture(),
              eq("test-case-id"),
              eq(Entity.TEST_CASE),
              isNull(),
              anyLong());
      Object operationData = getPrivateField(operationCaptor.getValue().update(), "data");
      Script script = (Script) getPrivateField(operationData, "script");
      Map<String, JsonData> scriptParameters = script.inline().params();
      assertFalse(scriptParameters.containsKey("description"));
      assertEquals("current", scriptParameters.get("name").to(String.class));
      assertEquals(
          List.of("description", "displayName"),
          scriptParameters.get("fieldsToRemove").to(List.class));
    }
  }

  @Test
  @SuppressWarnings({"rawtypes", "unchecked"})
  void oversizedScriptedUpdateIsSentDirectlyInsteadOfPoisoningTheBulkBatch() throws Exception {
    os.org.opensearch.client.opensearch.OpenSearchClient rawClient =
        mock(os.org.opensearch.client.opensearch.OpenSearchClient.class);
    StageStatsTracker tracker = mock(StageStatsTracker.class);
    when(searchClient.getNewClient()).thenReturn(rawClient);
    SearchRepository.ScriptedPartialUpdate partialUpdate =
        new SearchRepository.ScriptedPartialUpdate(
            "ctx._source.tests = params.tests;", Map.of("tests", "x".repeat(2048)));

    try (MockedConstruction<OpenSearchBulkSink.CustomBulkProcessor> processorConstruction =
        mockConstruction(OpenSearchBulkSink.CustomBulkProcessor.class)) {
      OpenSearchBulkSink sink = new OpenSearchBulkSink(searchRepository, 10, 2, 128L);

      invokePrivate(
          sink,
          "addScriptedPartialUpdate",
          new Class<?>[] {
            String.class,
            String.class,
            String.class,
            SearchRepository.ScriptedPartialUpdate.class,
            String.class,
            StageStatsTracker.class
          },
          "test_suite_index",
          "suite-id",
          Entity.TEST_SUITE,
          partialUpdate,
          "{\"name\":\"suite\"}",
          tracker);

      verify(processorConstruction.constructed().getFirst(), never())
          .add(any(), any(), any(), any(), anyLong());
      verify(rawClient).update(any(java.util.function.Function.class), eq(Map.class));
      verify(tracker).incrementPendingSink();
      verify(tracker).recordSink(StatsResult.SUCCESS);
      assertEquals(1, sink.getStats().getTotalRecords());
      assertEquals(1, sink.getStats().getSuccessRecords());
    }
  }

  @Test
  void fullTestCaseDocumentUsesRelationshipPreservingUpdate() throws Exception {
    EntityInterface<?> entity = mock(EntityInterface.class);
    UUID entityId = UUID.randomUUID();
    when(entity.getId()).thenReturn(entityId);
    SearchRepository.ScriptedPartialUpdate documentUpdate =
        new SearchRepository.ScriptedPartialUpdate(
            "preserve-test-suites", Map.of("name", "current"), true);
    when(searchRepository.buildRelationshipDocumentUpdate(eq(entity), any()))
        .thenReturn(documentUpdate);

    try (MockedConstruction<OpenSearchBulkSink.CustomBulkProcessor> processorConstruction =
            mockConstruction(OpenSearchBulkSink.CustomBulkProcessor.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      OpenSearchBulkSink sink = new OpenSearchBulkSink(searchRepository, 10, 2, 1000L);
      OpenSearchBulkSink.CustomBulkProcessor processor =
          processorConstruction.constructed().getFirst();
      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      entityMock.when(() -> Entity.getEntityTypeFromObject(entity)).thenReturn(Entity.TEST_CASE);
      entityMock
          .when(() -> Entity.buildSearchIndex(Entity.TEST_CASE, entity))
          .thenReturn(new StubSearchIndex(Map.of("name", "current")));

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
            Map.class,
            boolean.class
          },
          entity,
          "test_case_index",
          null,
          null,
          false,
          Collections.emptyMap(),
          Collections.emptyMap(),
          false);

      ArgumentCaptor<BulkOperation> operationCaptor = ArgumentCaptor.forClass(BulkOperation.class);
      verify(processor)
          .add(
              operationCaptor.capture(),
              eq(entityId.toString()),
              eq(Entity.TEST_CASE),
              isNull(),
              anyLong());
      assertTrue(operationCaptor.getValue().isUpdate());
      Object operationData = getPrivateField(operationCaptor.getValue().update(), "data");
      assertTrue(Boolean.TRUE.equals(getPrivateField(operationData, "scriptedUpsert")));
      assertTrue(
          OsUtils.jsonDataToMap((JsonData) getPrivateField(operationData, "upsert")).isEmpty());
      Script script = (Script) getPrivateField(operationData, "script");
      assertEquals("preserve-test-suites", script.inline().source());
    }
  }

  @Test
  void addEntityRecordsEntityNotFoundWarningsWithoutCallback() throws Exception {
    EntityInterface<?> entity = mock(EntityInterface.class);
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
            Map.class,
            boolean.class
          },
          entity,
          "table_index",
          null,
          tracker,
          false,
          Collections.emptyMap(),
          Collections.emptyMap(),
          false);

      verify(processorConstruction.constructed().getFirst()).setFailureCallback(failureCallback);
      verify(tracker).recordProcess(StatsResult.WARNING);
      verifyNoInteractions(failureCallback);
      assertEquals(0, sink.getStats().getFailedRecords());
      assertEquals(1, sink.getStats().getWarningRecords());
      assertEquals(0, sink.getProcessStats().getFailedRecords());
      assertEquals(1, sink.getProcessStats().getWarningRecords());
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
    EntityInterface<?> entity = mock(EntityInterface.class);
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
            Map.class,
            boolean.class
          },
          entity,
          "table_index",
          null,
          null,
          false,
          Collections.emptyMap(),
          docBuildContexts,
          false);

      assertSame(ctxForEntity, ContextCapturingIndex.observedContext);
      assertSame(edges, ContextCapturingIndex.observedContext.prefetchedUpstreamLineage());
    }
  }

  @Test
  void addEntityFallsBackToEmptyContextWhenEntityNotInMap() throws Exception {
    EntityInterface<?> entity = mock(EntityInterface.class);
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
            Map.class,
            boolean.class
          },
          entity,
          "table_index",
          null,
          null,
          false,
          Collections.emptyMap(),
          Collections.emptyMap(),
          false);

      assertSame(DocBuildContext.empty(), ContextCapturingIndex.observedContext);
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

  private Object getPrivateField(Object target, String fieldName) throws Exception {
    Field field = target.getClass().getDeclaredField(fieldName);
    field.setAccessible(true);
    return field.get(target);
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
