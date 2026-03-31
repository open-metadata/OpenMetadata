/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.apps.bundles.searchIndex.distributed;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.type.Paging;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.BulkSink;
import org.openmetadata.service.apps.bundles.searchIndex.IndexingFailureRecorder;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingConfiguration;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StageCounter;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StageStatsTracker;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.search.ReindexContext;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntityTimeSeriesSource;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PartitionWorkerTest {

  @Mock private DistributedSearchIndexCoordinator coordinator;
  @Mock private CollectionDAO collectionDAO;
  @Mock private CollectionDAO.SearchIndexServerStatsDAO searchIndexServerStatsDAO;
  @Mock private BulkSink bulkSink;
  @Mock private ReindexContext recreateContext;
  @Mock private ReindexingConfiguration reindexingConfiguration;

  private PartitionWorker worker;

  private static final int BATCH_SIZE = 100;
  private static final String TEST_SERVER_ID = "test-server-1";

  @BeforeEach
  void setUp() {
    worker = new PartitionWorker(coordinator, bulkSink, BATCH_SIZE, recreateContext, false);
  }

  @Test
  void testStopAndIsStopped() {
    assertFalse(worker.isStopped());

    worker.stop();

    assertTrue(worker.isStopped());
  }

  @Test
  void testStopMultipleTimes() {
    worker.stop();
    assertTrue(worker.isStopped());

    worker.stop();
    assertTrue(worker.isStopped());
  }

  @Test
  void testBatchResult_Record() {
    PartitionWorker.BatchResult result = new PartitionWorker.BatchResult(95, 5, 0, null);

    assertEquals(95, result.successCount());
    assertEquals(5, result.failedCount());
    assertEquals(0, result.warningsCount());
  }

  @Test
  void testPartitionResult_Record() {
    PartitionWorker.PartitionResult result = new PartitionWorker.PartitionResult(9500, 500, false);

    assertEquals(9500, result.successCount());
    assertEquals(500, result.failedCount());
    assertFalse(result.wasStopped());
  }

  @Test
  void testPartitionResult_WasStopped() {
    PartitionWorker.PartitionResult result = new PartitionWorker.PartitionResult(5000, 100, true);

    assertEquals(5000, result.successCount());
    assertEquals(100, result.failedCount());
    assertTrue(result.wasStopped());
  }

  @Test
  void testWorkerWithDifferentConfigurations() {
    PartitionWorker workerWithRecreate =
        new PartitionWorker(coordinator, bulkSink, 200, recreateContext, true);

    assertFalse(workerWithRecreate.isStopped());

    PartitionWorker workerWithoutContext =
        new PartitionWorker(coordinator, bulkSink, 50, null, false);

    assertFalse(workerWithoutContext.isStopped());
  }

  @Test
  void testProcessPartition_ImmediatelyStopped() {
    UUID partitionId = UUID.randomUUID();
    UUID jobId = UUID.randomUUID();

    SearchIndexPartition partition =
        SearchIndexPartition.builder()
            .id(partitionId)
            .jobId(jobId)
            .entityType("table")
            .partitionIndex(0)
            .rangeStart(0)
            .rangeEnd(1000)
            .estimatedCount(1000)
            .workUnits(1500)
            .priority(50)
            .status(PartitionStatus.PENDING)
            .cursor(0)
            .build();

    worker.stop();

    PartitionWorker.PartitionResult result = worker.processPartition(partition);

    assertTrue(result.wasStopped());
    assertEquals(0, result.successCount());
    assertEquals(0, result.failedCount());

    verify(coordinator, never()).updatePartitionProgress(any());
  }

  @Test
  void testPartitionBuilder() {
    UUID partitionId = UUID.randomUUID();
    UUID jobId = UUID.randomUUID();

    SearchIndexPartition partition =
        SearchIndexPartition.builder()
            .id(partitionId)
            .jobId(jobId)
            .entityType("user")
            .partitionIndex(1)
            .rangeStart(5000)
            .rangeEnd(10000)
            .estimatedCount(5000)
            .workUnits(7500)
            .priority(75)
            .status(PartitionStatus.PENDING)
            .cursor(5000)
            .build();

    assertEquals(partitionId, partition.getId());
    assertEquals(jobId, partition.getJobId());
    assertEquals("user", partition.getEntityType());
    assertEquals(1, partition.getPartitionIndex());
    assertEquals(5000, partition.getRangeStart());
    assertEquals(10000, partition.getRangeEnd());
    assertEquals(5000, partition.getEstimatedCount());
    assertEquals(7500, partition.getWorkUnits());
    assertEquals(75, partition.getPriority());
    assertEquals(PartitionStatus.PENDING, partition.getStatus());
    assertEquals(5000, partition.getCursor());
  }

  @Test
  void testPartitionToBuilder() {
    UUID partitionId = UUID.randomUUID();
    UUID jobId = UUID.randomUUID();

    SearchIndexPartition original =
        SearchIndexPartition.builder()
            .id(partitionId)
            .jobId(jobId)
            .entityType("table")
            .partitionIndex(0)
            .rangeStart(0)
            .rangeEnd(5000)
            .estimatedCount(5000)
            .workUnits(7500)
            .priority(50)
            .status(PartitionStatus.PENDING)
            .cursor(0)
            .processedCount(0)
            .successCount(0)
            .failedCount(0)
            .build();

    SearchIndexPartition updated =
        original.toBuilder()
            .status(PartitionStatus.PROCESSING)
            .cursor(2500)
            .processedCount(2500)
            .successCount(2400)
            .failedCount(100)
            .startedAt(System.currentTimeMillis())
            .build();

    assertEquals(partitionId, updated.getId());
    assertEquals(jobId, updated.getJobId());
    assertEquals("table", updated.getEntityType());
    assertEquals(PartitionStatus.PROCESSING, updated.getStatus());
    assertEquals(2500, updated.getCursor());
    assertEquals(2500, updated.getProcessedCount());
    assertEquals(2400, updated.getSuccessCount());
    assertEquals(100, updated.getFailedCount());
  }

  @Test
  void testBatchResultEquality() {
    PartitionWorker.BatchResult result1 = new PartitionWorker.BatchResult(100, 5, 0, null);
    PartitionWorker.BatchResult result2 = new PartitionWorker.BatchResult(100, 5, 0, null);
    PartitionWorker.BatchResult result3 = new PartitionWorker.BatchResult(100, 10, 0, null);

    assertEquals(result1, result2);
    assertNotEquals(result1, result3);
  }

  @Test
  void testPartitionResultEquality() {
    PartitionWorker.PartitionResult result1 = new PartitionWorker.PartitionResult(1000, 50, false);
    PartitionWorker.PartitionResult result2 = new PartitionWorker.PartitionResult(1000, 50, false);
    PartitionWorker.PartitionResult result3 = new PartitionWorker.PartitionResult(1000, 50, true);

    assertEquals(result1, result2);
    assertNotEquals(result1, result3);
  }

  @Test
  void initializeKeysetCursorHandlesRegularAndTimeSeriesEntities() throws Exception {
    @SuppressWarnings("unchecked")
    EntityRepository<EntityInterface> repository = mock(EntityRepository.class);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(() -> Entity.getEntityRepository("table")).thenReturn(repository);
      when(repository.getCursorAtOffset(any(ListFilter.class), eq(4))).thenReturn("cursor-4");

      assertNull(
          invokePrivate(
              worker,
              "initializeKeysetCursor",
              new Class<?>[] {String.class, long.class},
              "table",
              0L));
      assertEquals(
          "cursor-4",
          invokePrivate(
              worker,
              "initializeKeysetCursor",
              new Class<?>[] {String.class, long.class},
              "table",
              5L));
    }

    assertEquals(
        RestUtil.encodeCursor("5"),
        invokePrivate(
            worker,
            "initializeKeysetCursor",
            new Class<?>[] {String.class, long.class},
            Entity.QUERY_COST_RECORD,
            5L));
  }

  @Test
  void createContextDataIncludesRecreateContextTargetIndexAndStatsTracker() throws Exception {
    PartitionWorker recreateWorker =
        new PartitionWorker(coordinator, bulkSink, BATCH_SIZE, recreateContext, true);
    StageStatsTracker statsTracker = mock(StageStatsTracker.class);
    when(recreateContext.getStagedIndex("table")).thenReturn(Optional.of("table_staging"));

    @SuppressWarnings("unchecked")
    Map<String, Object> contextData =
        (Map<String, Object>)
            invokePrivate(
                recreateWorker,
                "createContextData",
                new Class<?>[] {String.class, StageStatsTracker.class},
                "table",
                statsTracker);

    assertEquals("table", contextData.get("entityType"));
    assertEquals(Boolean.TRUE, contextData.get("recreateIndex"));
    assertEquals(statsTracker, contextData.get(BulkSink.STATS_TRACKER_CONTEXT_KEY));
    assertEquals(recreateContext, contextData.get("recreateContext"));
    assertEquals("table_staging", contextData.get("targetIndex"));
  }

  @Test
  void processBatchWritesEntitiesAndRecordsReaderFailures() throws Exception {
    IndexingFailureRecorder failureRecorder = mock(IndexingFailureRecorder.class);
    StageStatsTracker statsTracker = mock(StageStatsTracker.class);
    PartitionWorker batchWorker =
        new PartitionWorker(coordinator, bulkSink, BATCH_SIZE, null, false, failureRecorder);

    EntityInterface entityOne = mock(EntityInterface.class);
    EntityInterface entityTwo = mock(EntityInterface.class);
    UUID errorEntityId = UUID.randomUUID();
    ResultList<EntityInterface> resultList = new ResultList<>();
    resultList.setData(List.of(entityOne, entityTwo));
    resultList.setErrors(
        List.of(new EntityError().withEntity(errorEntityId).withMessage("reader failure")));
    resultList.setWarningsCount(3);
    resultList.setPaging(new Paging().withAfter("next-cursor"));

    try (MockedConstruction<PaginatedEntitiesSource> ignored =
        mockConstruction(
            PaginatedEntitiesSource.class,
            (mock, context) -> doReturn(resultList).when(mock).readNextKeyset("cursor-1"))) {

      PartitionWorker.BatchResult batchResult =
          invokeProcessBatch(batchWorker, "table", "cursor-1", 2, statsTracker);

      assertEquals(2, batchResult.successCount());
      assertEquals(1, batchResult.failedCount());
      assertEquals(3, batchResult.warningsCount());
      assertEquals("next-cursor", batchResult.nextCursor());
    }

    verify(statsTracker).recordReaderBatch(2, 1, 3);
    verify(failureRecorder)
        .recordReaderEntityFailure("table", errorEntityId.toString(), null, "reader failure");

    @SuppressWarnings("unchecked")
    ArgumentCaptor<List<?>> entitiesCaptor = ArgumentCaptor.forClass(List.class);
    @SuppressWarnings("unchecked")
    ArgumentCaptor<Map<String, Object>> contextCaptor = ArgumentCaptor.forClass(Map.class);
    verify(bulkSink).write(entitiesCaptor.capture(), contextCaptor.capture());
    assertEquals(List.of(entityOne, entityTwo), entitiesCaptor.getValue());
    assertEquals("table", contextCaptor.getValue().get("entityType"));
    assertEquals(Boolean.FALSE, contextCaptor.getValue().get("recreateIndex"));
    assertEquals(statsTracker, contextCaptor.getValue().get(BulkSink.STATS_TRACKER_CONTEXT_KEY));
  }

  @Test
  void processBatchWrapsSinkFailuresAsSearchIndexException() throws Exception {
    PartitionWorker batchWorker =
        new PartitionWorker(coordinator, bulkSink, BATCH_SIZE, null, false);
    ResultList<EntityInterface> resultList = new ResultList<>();
    resultList.setData(List.of(mock(EntityInterface.class)));

    try (MockedConstruction<PaginatedEntitiesSource> ignored =
        mockConstruction(
            PaginatedEntitiesSource.class,
            (mock, context) -> doReturn(resultList).when(mock).readNextKeyset(null))) {
      doThrow(new IllegalStateException("sink unavailable"))
          .when(bulkSink)
          .write(anyList(), anyMap());

      SearchIndexException exception =
          assertThrows(
              SearchIndexException.class,
              () -> invokeProcessBatch(batchWorker, "table", null, 1, null));

      assertEquals(
          org.openmetadata.schema.system.IndexingError.ErrorSource.SINK,
          exception.getIndexingError().getErrorSource());
      assertEquals(1, exception.getIndexingError().getFailedCount());
      assertTrue(exception.getMessage().contains("sink unavailable"));
    }
  }

  @Test
  void readEntitiesKeysetUsesTimeSeriesSourceWithConfiguredWindow() throws Exception {
    PartitionWorker timeSeriesWorker =
        new PartitionWorker(
            coordinator, bulkSink, BATCH_SIZE, null, false, null, reindexingConfiguration);
    when(reindexingConfiguration.getTimeSeriesStartTs(Entity.QUERY_COST_RECORD)).thenReturn(100L);

    ResultList<EntityTimeSeriesInterface> resultList = new ResultList<>();
    resultList.setData(List.of(mock(EntityTimeSeriesInterface.class)));
    AtomicReference<List<?>> constructorArgs = new AtomicReference<>();

    try (MockedConstruction<PaginatedEntityTimeSeriesSource> ignored =
        mockConstruction(
            PaginatedEntityTimeSeriesSource.class,
            (mock, context) -> {
              constructorArgs.set(List.copyOf(context.arguments()));
              doReturn(resultList).when(mock).readWithCursor("cursor");
            })) {

      assertEquals(
          resultList,
          invokePrivate(
              timeSeriesWorker,
              "readEntitiesKeyset",
              new Class<?>[] {String.class, String.class, int.class},
              Entity.QUERY_COST_RECORD,
              "cursor",
              3));
    }

    assertEquals(Entity.QUERY_COST_RECORD, constructorArgs.get().get(0));
    assertEquals(3, constructorArgs.get().get(1));
    assertEquals(List.of(), constructorArgs.get().get(2));
    assertEquals(100L, constructorArgs.get().get(3));
    assertNotNull(constructorArgs.get().get(4));
  }

  @Test
  void writeToSinkUsesTimeSeriesEntitiesForTimeSeriesTypes() throws Exception {
    ResultList<EntityTimeSeriesInterface> resultList = new ResultList<>();
    EntityTimeSeriesInterface entity = mock(EntityTimeSeriesInterface.class);
    resultList.setData(List.of(entity));
    Map<String, Object> contextData = Map.of("entityType", Entity.QUERY_COST_RECORD);

    invokePrivate(
        worker,
        "writeToSink",
        new Class<?>[] {String.class, ResultList.class, Map.class},
        Entity.QUERY_COST_RECORD,
        resultList,
        contextData);

    verify(bulkSink).write(List.of(entity), contextData);
  }

  @Test
  void waitForSinkOperationsReconcilesStalePendingWorkAndFlushesStats() throws Exception {
    StageStatsTracker statsTracker = mock(StageStatsTracker.class);
    when(statsTracker.getEntityType()).thenReturn("table");
    when(statsTracker.getPendingSinkOps())
        .thenReturn(5L, 5L, 5L, 5L, 5L, 5L, 5L, 5L, 5L, 5L, 5L, 5L);
    when(statsTracker.awaitSinkCompletion(anyLong())).thenReturn(false);
    when(bulkSink.flushAndAwait(30)).thenReturn(true);
    when(bulkSink.getPendingVectorTaskCount()).thenReturn(2, 2);
    when(bulkSink.awaitVectorCompletion(120)).thenReturn(false);

    invokePrivate(
        worker, "waitForSinkOperations", new Class<?>[] {StageStatsTracker.class}, statsTracker);

    verify(bulkSink, times(4)).flushAndAwait(30);
    verify(bulkSink).awaitVectorCompletion(120);
    verify(statsTracker).reconcilePendingSinkOps();
    verify(statsTracker).flush();
  }

  @Test
  void processPartitionKeepsProgressStatusProcessingAndCompletesSuccessfully() {
    PartitionWorker partitionWorker =
        new PartitionWorker(coordinator, bulkSink, BATCH_SIZE, null, false);
    SearchIndexPartition partition = buildPartition("table", 0, 2);

    ResultList<EntityInterface> resultList = new ResultList<>();
    resultList.setData(List.of(mock(EntityInterface.class), mock(EntityInterface.class)));

    when(coordinator.getCollectionDAO()).thenReturn(collectionDAO);
    when(collectionDAO.searchIndexServerStatsDAO()).thenReturn(searchIndexServerStatsDAO);
    when(bulkSink.flushAndAwait(30)).thenReturn(true);
    when(bulkSink.getPendingVectorTaskCount()).thenReturn(0);

    ServerIdentityResolver resolver = mock(ServerIdentityResolver.class);
    when(resolver.getServerId()).thenReturn("server-a");

    try (MockedStatic<ServerIdentityResolver> resolverMock =
            mockStatic(ServerIdentityResolver.class);
        MockedConstruction<PaginatedEntitiesSource> ignored =
            mockConstruction(
                PaginatedEntitiesSource.class,
                (mock, context) -> doReturn(resultList).when(mock).readNextKeyset(null))) {
      resolverMock.when(ServerIdentityResolver::getInstance).thenReturn(resolver);

      PartitionWorker.PartitionResult result = partitionWorker.processPartition(partition);

      assertFalse(result.wasStopped());
      assertEquals(2, result.successCount());
      assertEquals(0, result.failedCount());
    }

    ArgumentCaptor<SearchIndexPartition> progressCaptor =
        ArgumentCaptor.forClass(SearchIndexPartition.class);
    verify(coordinator, atLeastOnce()).updatePartitionProgress(progressCaptor.capture());
    assertEquals(PartitionStatus.PROCESSING, progressCaptor.getAllValues().get(0).getStatus());
    assertEquals(
        PartitionStatus.PROCESSING,
        progressCaptor.getAllValues().get(progressCaptor.getAllValues().size() - 1).getStatus());
    verify(coordinator).completePartition(partition.getId(), 2L, 0L);
  }

  @Test
  void processPartitionTracksReaderFailuresAndCompletesWithFailedCounts() {
    PartitionWorker partitionWorker =
        new PartitionWorker(coordinator, bulkSink, BATCH_SIZE, null, false);
    SearchIndexPartition partition = buildPartition("table", 0, 2);

    SearchIndexException readerFailure =
        new SearchIndexException(
            new org.openmetadata.schema.system.IndexingError()
                .withErrorSource(org.openmetadata.schema.system.IndexingError.ErrorSource.READER)
                .withFailedCount(2)
                .withMessage("reader failed"));

    when(coordinator.getCollectionDAO()).thenReturn(collectionDAO);
    when(collectionDAO.searchIndexServerStatsDAO()).thenReturn(searchIndexServerStatsDAO);
    when(bulkSink.flushAndAwait(30)).thenReturn(true);
    when(bulkSink.getPendingVectorTaskCount()).thenReturn(0);

    ServerIdentityResolver resolver = mock(ServerIdentityResolver.class);
    when(resolver.getServerId()).thenReturn("server-a");

    try (MockedStatic<ServerIdentityResolver> resolverMock =
            mockStatic(ServerIdentityResolver.class);
        MockedConstruction<PaginatedEntitiesSource> ignored =
            mockConstruction(
                PaginatedEntitiesSource.class,
                (mock, context) -> doThrow(readerFailure).when(mock).readNextKeyset(null))) {
      resolverMock.when(ServerIdentityResolver::getInstance).thenReturn(resolver);

      PartitionWorker.PartitionResult result = partitionWorker.processPartition(partition);

      assertFalse(result.wasStopped());
      assertEquals(0, result.successCount());
      assertEquals(2, result.failedCount());
      assertEquals(2, result.readerFailed());
    }

    verify(coordinator).completePartition(partition.getId(), 0L, 2L);
  }

  @Test
  void processPartitionStopsAfterReadWhenStopRequestedMidLoop() {
    PartitionWorker partitionWorker =
        new PartitionWorker(coordinator, bulkSink, BATCH_SIZE, null, false);
    SearchIndexPartition partition = buildPartition("table", 0, 2);

    ResultList<EntityInterface> resultList = new ResultList<>();
    resultList.setData(List.of(mock(EntityInterface.class)));

    when(coordinator.getCollectionDAO()).thenReturn(collectionDAO);
    when(collectionDAO.searchIndexServerStatsDAO()).thenReturn(searchIndexServerStatsDAO);
    when(bulkSink.flushAndAwait(30)).thenReturn(true);
    when(bulkSink.getPendingVectorTaskCount()).thenReturn(0);

    ServerIdentityResolver resolver = mock(ServerIdentityResolver.class);
    when(resolver.getServerId()).thenReturn("server-a");

    try (MockedStatic<ServerIdentityResolver> resolverMock =
            mockStatic(ServerIdentityResolver.class);
        MockedConstruction<PaginatedEntitiesSource> ignored =
            mockConstruction(
                PaginatedEntitiesSource.class,
                (mock, context) ->
                    doReturn(resultList)
                        .when(mock)
                        .readNextKeyset(
                            org.mockito.ArgumentMatchers.argThat(
                                cursor -> {
                                  partitionWorker.stop();
                                  return true;
                                })))) {
      resolverMock.when(ServerIdentityResolver::getInstance).thenReturn(resolver);

      PartitionWorker.PartitionResult result = partitionWorker.processPartition(partition);

      assertTrue(result.wasStopped());
      assertEquals(0, result.successCount());
      assertEquals(0, result.failedCount());
    }

    verify(coordinator, never()).completePartition(any(), anyLong(), anyLong());
  }

  @Test
  void processPartitionRecordsSinkFailuresAndStopsWhenCursorCannotBeRebuilt() throws Exception {
    IndexingFailureRecorder failureRecorder = mock(IndexingFailureRecorder.class);
    PartitionWorker partitionWorker =
        new PartitionWorker(coordinator, bulkSink, 2, null, false, failureRecorder);
    SearchIndexPartition partition = buildPartition("table", 0, 4);

    ResultList<EntityInterface> resultList = new ResultList<>();
    resultList.setData(List.of(mock(EntityInterface.class)));

    @SuppressWarnings("unchecked")
    EntityRepository<EntityInterface> repository = mock(EntityRepository.class);

    when(coordinator.getCollectionDAO()).thenReturn(collectionDAO);
    when(collectionDAO.searchIndexServerStatsDAO()).thenReturn(searchIndexServerStatsDAO);
    when(bulkSink.flushAndAwait(30)).thenReturn(true);
    when(bulkSink.getPendingVectorTaskCount()).thenReturn(0);
    doThrow(new IllegalStateException("sink unavailable"))
        .when(bulkSink)
        .write(anyList(), anyMap());

    ServerIdentityResolver resolver = mock(ServerIdentityResolver.class);
    when(resolver.getServerId()).thenReturn("server-a");

    try (MockedStatic<ServerIdentityResolver> resolverMock =
            mockStatic(ServerIdentityResolver.class);
        MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedConstruction<PaginatedEntitiesSource> ignored =
            mockConstruction(
                PaginatedEntitiesSource.class,
                (mock, context) -> doReturn(resultList).when(mock).readNextKeyset(null))) {
      resolverMock.when(ServerIdentityResolver::getInstance).thenReturn(resolver);
      entityMock.when(() -> Entity.getEntityRepository("table")).thenReturn(repository);
      when(repository.getCursorAtOffset(any(ListFilter.class), eq(1))).thenReturn(null);

      PartitionWorker.PartitionResult result = partitionWorker.processPartition(partition);

      assertFalse(result.wasStopped());
      assertEquals(0, result.successCount());
      assertEquals(1, result.failedCount());
    }

    verify(failureRecorder)
        .recordSinkFailure(
            eq("table"),
            eq("BATCH"),
            eq("batch_at_offset_0"),
            eq("Failed to write batch to search index: sink unavailable"),
            any());
    verify(coordinator).completePartition(partition.getId(), 0L, 1L);
  }

  @Test
  void processPartitionAdjustsSuccessCountsForProcessFailures() {
    PartitionWorker partitionWorker = new PartitionWorker(coordinator, bulkSink, 2, null, false);
    SearchIndexPartition partition = buildPartition("table", 0, 2);

    ResultList<EntityInterface> resultList = new ResultList<>();
    resultList.setData(List.of(mock(EntityInterface.class), mock(EntityInterface.class)));
    StageCounter processCounter = new StageCounter();
    processCounter.getCumulativeFailed().set(1);

    when(coordinator.getCollectionDAO()).thenReturn(collectionDAO);
    when(collectionDAO.searchIndexServerStatsDAO()).thenReturn(searchIndexServerStatsDAO);
    when(bulkSink.flushAndAwait(30)).thenReturn(true);
    when(bulkSink.getPendingVectorTaskCount()).thenReturn(0);

    ServerIdentityResolver resolver = mock(ServerIdentityResolver.class);
    when(resolver.getServerId()).thenReturn("server-a");

    try (MockedStatic<ServerIdentityResolver> resolverMock =
            mockStatic(ServerIdentityResolver.class);
        MockedConstruction<StageStatsTracker> trackerConstruction =
            mockConstruction(
                StageStatsTracker.class,
                (mock, context) -> {
                  when(mock.getPendingSinkOps()).thenReturn(0L);
                  when(mock.getProcess()).thenReturn(processCounter);
                });
        MockedConstruction<PaginatedEntitiesSource> ignored =
            mockConstruction(
                PaginatedEntitiesSource.class,
                (mock, context) -> doReturn(resultList).when(mock).readNextKeyset(null))) {
      resolverMock.when(ServerIdentityResolver::getInstance).thenReturn(resolver);

      PartitionWorker.PartitionResult result = partitionWorker.processPartition(partition);

      assertFalse(result.wasStopped());
      assertEquals(1, result.successCount());
      assertEquals(1, result.failedCount());
      assertEquals(1, trackerConstruction.constructed().size());
    }

    verify(coordinator).completePartition(partition.getId(), 1L, 1L);
  }

  @Test
  void processPartitionFailsPartitionWhenCompletionThrows() {
    PartitionWorker partitionWorker = new PartitionWorker(coordinator, bulkSink, 2, null, false);
    SearchIndexPartition partition = buildPartition("table", 0, 1);

    ResultList<EntityInterface> resultList = new ResultList<>();
    resultList.setData(List.of(mock(EntityInterface.class)));

    when(coordinator.getCollectionDAO()).thenReturn(collectionDAO);
    when(collectionDAO.searchIndexServerStatsDAO()).thenReturn(searchIndexServerStatsDAO);
    when(bulkSink.flushAndAwait(30)).thenReturn(true);
    when(bulkSink.getPendingVectorTaskCount()).thenReturn(0);
    doThrow(new IllegalStateException("completion failed"))
        .when(coordinator)
        .completePartition(partition.getId(), 1L, 0L);

    ServerIdentityResolver resolver = mock(ServerIdentityResolver.class);
    when(resolver.getServerId()).thenReturn("server-a");

    try (MockedStatic<ServerIdentityResolver> resolverMock =
            mockStatic(ServerIdentityResolver.class);
        MockedConstruction<PaginatedEntitiesSource> ignored =
            mockConstruction(
                PaginatedEntitiesSource.class,
                (mock, context) -> doReturn(resultList).when(mock).readNextKeyset(null))) {
      resolverMock.when(ServerIdentityResolver::getInstance).thenReturn(resolver);

      PartitionWorker.PartitionResult result = partitionWorker.processPartition(partition);

      assertFalse(result.wasStopped());
      assertEquals(1, result.successCount());
      assertEquals(0, result.failedCount());
    }

    verify(coordinator).failPartition(partition.getId(), "completion failed");
  }

  @Test
  void processBatchReturnsEmptyResultWhenNoEntitiesAreRead() throws Exception {
    ResultList<EntityInterface> emptyResult = new ResultList<>();
    emptyResult.setData(List.of());

    try (MockedConstruction<PaginatedEntitiesSource> ignored =
        mockConstruction(
            PaginatedEntitiesSource.class,
            (mock, context) -> doReturn(emptyResult).when(mock).readNextKeyset("cursor"))) {
      PartitionWorker.BatchResult result = invokeProcessBatch(worker, "table", "cursor", 5, null);

      assertEquals(0, result.successCount());
      assertEquals(0, result.failedCount());
      assertEquals(0, result.warningsCount());
      assertNull(result.nextCursor());
    }
  }

  @Test
  void initializeKeysetCursorReturnsNullWhenRepositoryCursorMissing() throws Exception {
    @SuppressWarnings("unchecked")
    EntityRepository<EntityInterface> repository = mock(EntityRepository.class);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(() -> Entity.getEntityRepository("table")).thenReturn(repository);
      when(repository.getCursorAtOffset(any(ListFilter.class), eq(4))).thenReturn(null);

      assertNull(
          invokePrivate(
              worker,
              "initializeKeysetCursor",
              new Class<?>[] {String.class, long.class},
              "table",
              5L));
    }
  }

  @Test
  void testPartitionResult_RecordWithReaderFailuresDefaultsWarningsToZero() {
    PartitionWorker.PartitionResult result = new PartitionWorker.PartitionResult(10, 2, false, 3);

    assertEquals(10, result.successCount());
    assertEquals(2, result.failedCount());
    assertEquals(3, result.readerFailed());
    assertEquals(0, result.readerWarnings());
  }

  private PartitionWorker.BatchResult invokeProcessBatch(
      PartitionWorker target,
      String entityType,
      String cursor,
      int batchSize,
      StageStatsTracker statsTracker)
      throws Exception {
    return (PartitionWorker.BatchResult)
        invokePrivate(
            target,
            "processBatch",
            new Class<?>[] {String.class, String.class, int.class, StageStatsTracker.class},
            entityType,
            cursor,
            batchSize,
            statsTracker);
  }

  private Object invokePrivate(
      PartitionWorker target, String methodName, Class<?>[] parameterTypes, Object... args)
      throws Exception {
    Method method = PartitionWorker.class.getDeclaredMethod(methodName, parameterTypes);
    method.setAccessible(true);
    try {
      return method.invoke(target, args);
    } catch (InvocationTargetException e) {
      if (e.getCause() instanceof Exception exception) {
        throw exception;
      }
      if (e.getCause() instanceof Error error) {
        throw error;
      }
      throw e;
    }
  }

  private SearchIndexPartition buildPartition(String entityType, long rangeStart, long rangeEnd) {
    return SearchIndexPartition.builder()
        .id(UUID.randomUUID())
        .jobId(UUID.randomUUID())
        .entityType(entityType)
        .partitionIndex(0)
        .rangeStart(rangeStart)
        .rangeEnd(rangeEnd)
        .status(PartitionStatus.PENDING)
        .build();
  }
}
