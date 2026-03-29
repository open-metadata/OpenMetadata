package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.Phaser;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.system.EntityStats;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.stats.JobStatsManager;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StageStatsTracker;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.EntityTimeSeriesDAO;
import org.openmetadata.service.jdbi3.EntityTimeSeriesRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.search.DefaultRecreateHandler;
import org.openmetadata.service.search.EntityReindexContext;
import org.openmetadata.service.search.RecreateIndexHandler;
import org.openmetadata.service.search.ReindexContext;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.workflows.interfaces.Source;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntityTimeSeriesSource;

class SearchIndexExecutorControlFlowTest {

  private SearchIndexExecutor executor;
  private SearchRepository searchRepository;
  private CollectionDAO collectionDAO;

  @BeforeEach
  void setUp() {
    collectionDAO = mock(CollectionDAO.class);
    searchRepository = mock(SearchRepository.class);
    executor = new SearchIndexExecutor(collectionDAO, searchRepository);
  }

  @AfterEach
  void tearDown() {
    executor.close();
  }

  @Test
  void hasReachedEndCursorHandlesNumericJsonAndFallbackComparisons() throws Exception {
    assertTrue(
        (Boolean)
            invokePrivateMethod(
                "hasReachedEndCursor",
                new Class<?>[] {String.class, String.class},
                RestUtil.encodeCursor("10"),
                RestUtil.encodeCursor("5")));
    assertFalse(
        (Boolean)
            invokePrivateMethod(
                "hasReachedEndCursor",
                new Class<?>[] {String.class, String.class},
                RestUtil.encodeCursor("4"),
                RestUtil.encodeCursor("5")));
    assertTrue(
        (Boolean)
            invokePrivateMethod(
                "hasReachedEndCursor",
                new Class<?>[] {String.class, String.class},
                RestUtil.encodeCursor("{\"name\":\"b\",\"id\":\"2\"}"),
                RestUtil.encodeCursor("{\"name\":\"a\",\"id\":\"9\"}")));
    assertTrue(
        (Boolean)
            invokePrivateMethod(
                "hasReachedEndCursor",
                new Class<?>[] {String.class, String.class},
                RestUtil.encodeCursor("z"),
                RestUtil.encodeCursor("a")));
  }

  @Test
  void isTransientReadErrorRecognizesRetryableMessages() throws Exception {
    SearchIndexException timeout =
        new SearchIndexException(new IndexingError().withMessage("Connection timeout"));
    SearchIndexException nonTransient =
        new SearchIndexException(new IndexingError().withMessage("Entity not found"));

    assertTrue(
        (Boolean)
            invokePrivateMethod(
                "isTransientReadError", new Class<?>[] {SearchIndexException.class}, timeout));
    assertFalse(
        (Boolean)
            invokePrivateMethod(
                "isTransientReadError", new Class<?>[] {SearchIndexException.class}, nonTransient));
  }

  @Test
  void readWithRetryRetriesTransientErrorsThenSucceeds() throws Exception {
    AtomicInteger attempts = new AtomicInteger();
    SearchIndexExecutor.KeysetBatchReader batchReader =
        cursor -> {
          if (attempts.getAndIncrement() < 2) {
            throw new SearchIndexException(new IndexingError().withMessage("socket timeout"));
          }
          return new ResultList<>(java.util.List.of("entity"), null, null, 1);
        };

    ResultList<?> result =
        (ResultList<?>)
            invokePrivateMethod(
                "readWithRetry",
                new Class<?>[] {
                  SearchIndexExecutor.KeysetBatchReader.class, String.class, String.class
                },
                batchReader,
                null,
                "table");

    assertEquals(3, attempts.get());
    assertEquals(1, result.getData().size());
  }

  @Test
  void readWithRetryThrowsNonTransientErrorsImmediately() {
    SearchIndexExecutor.KeysetBatchReader batchReader =
        cursor -> {
          throw new SearchIndexException(new IndexingError().withMessage("Entity not found"));
        };

    InvocationTargetException thrown =
        assertThrows(
            InvocationTargetException.class,
            () ->
                invokePrivateMethod(
                    "readWithRetry",
                    new Class<?>[] {
                      SearchIndexExecutor.KeysetBatchReader.class, String.class, String.class
                    },
                    batchReader,
                    null,
                    "table"));

    assertInstanceOf(SearchIndexException.class, thrown.getCause());
  }

  @Test
  void syncSinkStatsFromBulkSinkCopiesSinkVectorAndProcessStats() throws Exception {
    BulkSink sink = mock(BulkSink.class);
    StepStats sinkStats =
        new StepStats().withTotalRecords(20).withSuccessRecords(18).withFailedRecords(2);
    StepStats vectorStats =
        new StepStats().withTotalRecords(10).withSuccessRecords(9).withFailedRecords(1);
    StepStats processStats =
        new StepStats().withTotalRecords(20).withSuccessRecords(19).withFailedRecords(1);
    when(sink.getStats()).thenReturn(sinkStats);
    when(sink.getVectorStats()).thenReturn(vectorStats);
    when(sink.getProcessStats()).thenReturn(processStats);

    setField("searchIndexSink", sink);
    executor.getStats().set(initializeStats(Set.of("table")));

    invokePrivateMethod("syncSinkStatsFromBulkSink", new Class<?>[0]);

    Stats stats = executor.getStats().get();
    assertEquals(20, stats.getSinkStats().getTotalRecords());
    assertEquals(18, stats.getSinkStats().getSuccessRecords());
    assertEquals(2, stats.getSinkStats().getFailedRecords());
    assertSame(vectorStats, stats.getVectorStats());
    assertSame(processStats, stats.getProcessStats());
  }

  @Test
  void closeSinkIfNeededFlushesVectorTasksAndClosesOnlyOnce() throws Exception {
    BulkSink sink = mock(BulkSink.class);
    when(sink.getPendingVectorTaskCount()).thenReturn(2);
    when(sink.awaitVectorCompletionWithDetails(300))
        .thenReturn(VectorCompletionResult.success(150));
    when(sink.getStats()).thenReturn(new StepStats().withTotalRecords(5).withSuccessRecords(5));
    when(sink.getVectorStats())
        .thenReturn(new StepStats().withTotalRecords(2).withSuccessRecords(2));
    when(sink.getProcessStats())
        .thenReturn(new StepStats().withTotalRecords(5).withSuccessRecords(5));

    setField("searchIndexSink", sink);
    executor.getStats().set(initializeStats(Set.of("table")));

    invokePrivateMethod("closeSinkIfNeeded", new Class<?>[0]);
    invokePrivateMethod("closeSinkIfNeeded", new Class<?>[0]);

    verify(sink).awaitVectorCompletionWithDetails(300);
    verify(sink, times(1)).close();
  }

  @Test
  void adjustThreadsForLimitReducesRequestedCountsWhenTheyExceedGlobalCap() throws Exception {
    setField("config", ReindexingConfiguration.builder().entities(Set.of("table")).build());

    SearchIndexExecutor.ThreadConfiguration configuration =
        (SearchIndexExecutor.ThreadConfiguration)
            invokePrivateMethod(
                "adjustThreadsForLimit", new Class<?>[] {int.class, int.class}, 40, 40);

    assertTrue(configuration.numProducers() < 40);
    assertTrue(configuration.numConsumers() < 40);
  }

  @Test
  void initializeQueueAndExecutorsBuildsBoundedInfrastructure() throws Exception {
    setField(
        "config",
        ReindexingConfiguration.builder()
            .entities(Set.of("table", "dashboard"))
            .queueSize(200)
            .build());
    setField("batchSize", new java.util.concurrent.atomic.AtomicReference<>(50));

    int effectiveQueueSize =
        (Integer)
            invokePrivateMethod(
                "initializeQueueAndExecutors",
                new Class<?>[] {SearchIndexExecutor.ThreadConfiguration.class, int.class},
                new SearchIndexExecutor.ThreadConfiguration(3, 4),
                2);

    assertTrue(effectiveQueueSize > 0);
    assertTrue(effectiveQueueSize <= 200);
    assertNotNull(getField("taskQueue"));
    assertNotNull(getField("producerExecutor"));
    assertNotNull(getField("consumerExecutor"));
    assertNotNull(getField("jobExecutor"));
  }

  @Test
  void buildResultUsesStatsToDetermineCompletionStatus() throws Exception {
    Stats completed = initializeStats(Set.of("table"));
    completed.getJobStats().setTotalRecords(10);
    completed.getJobStats().setSuccessRecords(10);
    completed.getJobStats().setFailedRecords(0);
    executor.getStats().set(completed);
    setField("startTime", System.currentTimeMillis() - 5000L);

    ExecutionResult success = (ExecutionResult) invokePrivateMethod("buildResult", new Class<?>[0]);
    assertEquals(ExecutionResult.Status.COMPLETED, success.status());

    Stats withErrors = initializeStats(Set.of("table"));
    withErrors.getReaderStats().setTotalRecords(10);
    withErrors.getReaderStats().setFailedRecords(1);
    withErrors.getProcessStats().setFailedRecords(1);
    withErrors.getSinkStats().setTotalRecords(8);
    withErrors.getSinkStats().setSuccessRecords(8);
    executor.getStats().set(withErrors);

    ExecutionResult completedWithErrors =
        (ExecutionResult) invokePrivateMethod("buildResult", new Class<?>[0]);
    assertEquals(ExecutionResult.Status.COMPLETED_WITH_ERRORS, completedWithErrors.status());
  }

  @Test
  void getAllReturnsOnlyIndexedEntityTypesAndTimeSeriesEntities() throws Exception {
    when(searchRepository.getEntityIndexMap())
        .thenReturn(
            Map.of(
                Entity.TABLE, mock(org.openmetadata.search.IndexMapping.class),
                Entity.ENTITY_REPORT_DATA, mock(org.openmetadata.search.IndexMapping.class)));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getEntityList).thenReturn(Set.of(Entity.TABLE, Entity.USER));

      @SuppressWarnings("unchecked")
      Set<String> entities = (Set<String>) invokePrivateMethod("getAll", new Class<?>[0]);

      assertTrue(entities.contains(Entity.TABLE));
      assertTrue(entities.contains(Entity.ENTITY_REPORT_DATA));
      assertFalse(entities.contains(Entity.USER));
    }
  }

  @Test
  void stopFlushesSinkAndShutsExecutorsDown() throws Exception {
    BulkSink sink = mock(BulkSink.class);
    when(sink.getActiveBulkRequestCount()).thenReturn(2);
    when(sink.flushAndAwait(10)).thenReturn(true);
    setField("searchIndexSink", sink);
    setField("producerExecutor", Executors.newSingleThreadExecutor());
    setField("jobExecutor", Executors.newSingleThreadExecutor());
    setField("consumerExecutor", Executors.newSingleThreadExecutor());
    setField("taskQueue", new java.util.concurrent.LinkedBlockingQueue<>());

    executor.stop();

    assertTrue(executor.isStopped());
    verify(sink).flushAndAwait(10);
    assertTrue(((ExecutorService) getField("producerExecutor")).isShutdown());
    assertTrue(((ExecutorService) getField("jobExecutor")).isShutdown());
    assertTrue(((ExecutorService) getField("consumerExecutor")).isShutdown());
  }

  @Test
  void validateClusterCapacityRethrowsInsufficientCapacityFailures() {
    try (MockedConstruction<SearchIndexClusterValidator> ignored =
        mockConstruction(
            SearchIndexClusterValidator.class,
            (validator, context) ->
                doThrow(new InsufficientClusterCapacityException(90, 100, 20, 0.9))
                    .when(validator)
                    .validateCapacityForRecreate(searchRepository, Set.of(Entity.TABLE)))) {
      InvocationTargetException thrown =
          assertThrows(
              InvocationTargetException.class,
              () ->
                  invokePrivateMethod(
                      "validateClusterCapacity", new Class<?>[] {Set.class}, Set.of(Entity.TABLE)));

      assertInstanceOf(InsufficientClusterCapacityException.class, thrown.getCause());
    }
  }

  @Test
  void validateClusterCapacitySwallowsUnexpectedValidatorFailures() throws Exception {
    try (MockedConstruction<SearchIndexClusterValidator> ignored =
        mockConstruction(
            SearchIndexClusterValidator.class,
            (validator, context) ->
                doThrow(new IllegalStateException("boom"))
                    .when(validator)
                    .validateCapacityForRecreate(searchRepository, Set.of(Entity.TABLE)))) {
      invokePrivateMethod(
          "validateClusterCapacity", new Class<?>[] {Set.class}, Set.of(Entity.TABLE));
    }
  }

  @Test
  void initializeSinkStoresSinkHandlerAndFailureCallback() throws Exception {
    BulkSink sink = mock(BulkSink.class);
    RecreateIndexHandler handler = mock(RecreateIndexHandler.class);
    ReindexingConfiguration config =
        ReindexingConfiguration.builder()
            .batchSize(25)
            .maxConcurrentRequests(3)
            .payloadSize(2048)
            .build();

    when(searchRepository.createBulkSink(25, 3, 2048)).thenReturn(sink);
    when(searchRepository.createReindexHandler()).thenReturn(handler);

    invokePrivateMethod("initializeSink", new Class<?>[] {ReindexingConfiguration.class}, config);

    assertSame(sink, getField("searchIndexSink"));
    assertSame(handler, getField("recreateIndexHandler"));
    verify(sink).setFailureCallback(any(BulkSink.FailureCallback.class));
  }

  @Test
  void cleanupOldFailuresDeletesExpiredRecordsAndSwallowsDaoErrors() throws Exception {
    CollectionDAO.SearchIndexFailureDAO failureDao =
        mock(CollectionDAO.SearchIndexFailureDAO.class);
    when(collectionDAO.searchIndexFailureDAO()).thenReturn(failureDao);
    when(failureDao.deleteOlderThan(anyLong())).thenReturn(2);

    invokePrivateMethod("cleanupOldFailures", new Class<?>[0]);

    verify(failureDao).deleteOlderThan(anyLong());

    doThrow(new IllegalStateException("boom")).when(failureDao).deleteOlderThan(anyLong());
    invokePrivateMethod("cleanupOldFailures", new Class<?>[0]);
  }

  @Test
  void createContextDataIncludesRecreateTargetIndexAndTracker() throws Exception {
    CollectionDAO.SearchIndexServerStatsDAO statsDao =
        mock(CollectionDAO.SearchIndexServerStatsDAO.class);
    ReindexContext recreateContext = new ReindexContext();
    ReindexingJobContext jobContext = mock(ReindexingJobContext.class);
    UUID jobId = UUID.randomUUID();

    recreateContext.add(
        Entity.TABLE,
        "table_canonical",
        "table_original",
        "table_staged",
        Set.of("table_existing"),
        "table_alias",
        List.of("column_alias"));
    when(collectionDAO.searchIndexServerStatsDAO()).thenReturn(statsDao);
    when(jobContext.getJobId()).thenReturn(jobId);
    setField("config", ReindexingConfiguration.builder().recreateIndex(true).build());
    setField("context", jobContext);
    setField("recreateContext", recreateContext);

    @SuppressWarnings("unchecked")
    Map<String, Object> contextData =
        (Map<String, Object>)
            invokePrivateMethod("createContextData", new Class<?>[] {String.class}, Entity.TABLE);

    assertEquals(Entity.TABLE, contextData.get("entityType"));
    assertEquals(Boolean.TRUE, contextData.get("recreateIndex"));
    assertSame(recreateContext, contextData.get("recreateContext"));
    assertEquals("table_staged", contextData.get("targetIndex"));
    assertNotNull(contextData.get(BulkSink.STATS_TRACKER_CONTEXT_KEY));
  }

  @Test
  void getTargetIndexForEntityFallsBackToCorrectedQueryCostType() throws Exception {
    ReindexContext recreateContext = new ReindexContext();
    recreateContext.add(
        Entity.QUERY_COST_RECORD, null, null, "query_cost_staged", Set.of(), null, List.of());
    setField("recreateContext", recreateContext);

    @SuppressWarnings("unchecked")
    Optional<String> target =
        (Optional<String>)
            invokePrivateMethod(
                "getTargetIndexForEntity", new Class<?>[] {String.class}, "queryCostResult");

    assertEquals(Optional.of("query_cost_staged"), target);
  }

  @Test
  void getEntityTotalCountsRegularEntitiesWithIncludeAll() throws Exception {
    EntityRepository<?> entityRepository = mock(EntityRepository.class);
    EntityDAO entityDao = mock(EntityDAO.class);
    when(entityRepository.getDao()).thenReturn(entityDao);
    when(entityDao.listCount(any(ListFilter.class))).thenReturn(7);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(entityRepository);

      int total =
          (Integer)
              invokePrivateMethod("getEntityTotal", new Class<?>[] {String.class}, Entity.TABLE);

      assertEquals(7, total);
      ArgumentCaptor<ListFilter> filterCaptor = ArgumentCaptor.forClass(ListFilter.class);
      verify(entityDao).listCount(filterCaptor.capture());
      assertEquals(org.openmetadata.schema.type.Include.ALL, filterCaptor.getValue().getInclude());
    }
  }

  @Test
  void getEntityTotalUsesDataInsightTimeSeriesFilters() throws Exception {
    String reportType = ReportData.ReportDataType.ENTITY_REPORT_DATA.value();
    EntityTimeSeriesRepository<?> repository = mock(EntityTimeSeriesRepository.class);
    EntityTimeSeriesDAO timeSeriesDao = mock(EntityTimeSeriesDAO.class);
    when(repository.getTimeSeriesDao()).thenReturn(timeSeriesDao);
    when(timeSeriesDao.listCount(any(ListFilter.class), anyLong(), anyLong(), eq(false)))
        .thenReturn(4);
    when(searchRepository.getDataInsightReports()).thenReturn(List.of(reportType));
    setField(
        "config",
        ReindexingConfiguration.builder().timeSeriesEntityDays(Map.of(reportType, 1)).build());

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      entityMock
          .when(() -> Entity.getEntityTimeSeriesRepository(Entity.ENTITY_REPORT_DATA))
          .thenReturn(repository);

      int total =
          (Integer)
              invokePrivateMethod("getEntityTotal", new Class<?>[] {String.class}, reportType);

      assertEquals(4, total);
      ArgumentCaptor<ListFilter> filterCaptor = ArgumentCaptor.forClass(ListFilter.class);
      verify(timeSeriesDao).listCount(filterCaptor.capture(), anyLong(), anyLong(), eq(false));
      assertEquals(
          FullyQualifiedName.buildHash(reportType),
          filterCaptor.getValue().getQueryParams().get("entityFQNHash"));
    }
  }

  @Test
  void handleTaskSuccessReportsReaderErrorsAndProgress() throws Exception {
    ReindexingProgressListener listener = mock(ReindexingProgressListener.class);
    ResultList<String> batch =
        new ResultList<>(List.of("row"), List.of(new EntityError()), null, null, 1);
    StepStats currentEntityStats = new StepStats().withSuccessRecords(1).withFailedRecords(1);
    executor.addListener(listener);
    executor.getStats().set(initializeStats(Set.of(Entity.TABLE)));

    invokePrivateMethod(
        "handleTaskSuccess",
        new Class<?>[] {String.class, ResultList.class, StepStats.class},
        Entity.TABLE,
        batch,
        currentEntityStats);

    verify(listener).onError(eq(Entity.TABLE), any(IndexingError.class), any(Stats.class));
    verify(listener).onProgressUpdate(any(Stats.class), any());
    assertEquals(1, executor.getStats().get().getJobStats().getSuccessRecords());
    assertEquals(1, executor.getStats().get().getJobStats().getFailedRecords());
  }

  @Test
  void handleSearchIndexExceptionUsesIndexedFailureCounts() throws Exception {
    ReindexingProgressListener listener = mock(ReindexingProgressListener.class);
    ResultList<String> batch =
        new ResultList<>(List.of("row"), List.of(new EntityError()), null, null, 1);
    SearchIndexException exception =
        new SearchIndexException(
            new IndexingError().withMessage("sink boom").withSuccessCount(1).withFailedCount(2));
    executor.addListener(listener);
    executor.getStats().set(initializeStats(Set.of(Entity.TABLE)));

    invokePrivateMethod(
        "handleSearchIndexException",
        new Class<?>[] {String.class, ResultList.class, SearchIndexException.class},
        Entity.TABLE,
        batch,
        exception);

    verify(listener).onError(eq(Entity.TABLE), eq(exception.getIndexingError()), any(Stats.class));
    assertEquals(1, executor.getStats().get().getJobStats().getSuccessRecords());
    assertEquals(2, executor.getStats().get().getJobStats().getFailedRecords());
  }

  @Test
  void handleGenericExceptionCountsReaderAndDataFailures() throws Exception {
    ReindexingProgressListener listener = mock(ReindexingProgressListener.class);
    ResultList<String> batch =
        new ResultList<>(List.of("row1", "row2"), List.of(new EntityError()), null, null, 2);
    executor.addListener(listener);
    executor.getStats().set(initializeStats(Set.of(Entity.TABLE)));

    invokePrivateMethod(
        "handleGenericException",
        new Class<?>[] {String.class, ResultList.class, Exception.class},
        Entity.TABLE,
        batch,
        new IOException("process boom"));

    verify(listener).onError(eq(Entity.TABLE), any(IndexingError.class), any(Stats.class));
    assertEquals(3, executor.getStats().get().getJobStats().getFailedRecords());
  }

  @Test
  void signalConsumersToStopEnqueuesPoisonPills() throws Exception {
    LinkedBlockingQueue<Object> queue = new LinkedBlockingQueue<>();
    setField("taskQueue", queue);

    invokePrivateMethod("signalConsumersToStop", new Class<?>[] {int.class}, 2);

    assertTrue(((java.util.concurrent.atomic.AtomicBoolean) getField("producersDone")).get());
    assertEquals(2, queue.size());
    Object firstTask = queue.poll();
    assertEquals("__POISON_PILL__", invokeTaskAccessor(firstTask, "entityType"));
  }

  @Test
  void processReadTaskQueuesEntitiesFromSource() throws Exception {
    @SuppressWarnings("unchecked")
    Source<Object> source = mock(Source.class);
    LinkedBlockingQueue<Object> queue = new LinkedBlockingQueue<>();
    when(source.readWithCursor(RestUtil.encodeCursor("25")))
        .thenReturn(new ResultList<>(List.of("entity")));
    setField("taskQueue", queue);

    invokePrivateMethod(
        "processReadTask",
        new Class<?>[] {String.class, Source.class, int.class},
        Entity.TABLE,
        source,
        25);

    assertEquals(1, queue.size());
    Object task = queue.poll();
    assertEquals(Entity.TABLE, invokeTaskAccessor(task, "entityType"));
    assertEquals(25, invokeTaskAccessor(task, "offset"));
  }

  @Test
  void processReadTaskRecordsReaderFailuresUsingBatchSizeFallback() throws Exception {
    @SuppressWarnings("unchecked")
    Source<Object> source = mock(Source.class);
    IndexingFailureRecorder failureRecorder = mock(IndexingFailureRecorder.class);
    ReindexingProgressListener listener = mock(ReindexingProgressListener.class);
    SearchIndexException exception =
        new SearchIndexException(new IndexingError().withMessage("read failed"));

    when(source.readWithCursor(any(String.class))).thenThrow(exception);
    setField("failureRecorder", failureRecorder);
    setField("batchSize", new java.util.concurrent.atomic.AtomicReference<>(25));
    executor.addListener(listener);
    executor.getStats().set(initializeStats(Set.of(Entity.TABLE)));

    invokePrivateMethod(
        "processReadTask",
        new Class<?>[] {String.class, Source.class, int.class},
        Entity.TABLE,
        source,
        0);

    verify(failureRecorder)
        .recordReaderFailure(eq(Entity.TABLE), eq("read failed"), any(String.class));
    verify(listener).onError(eq(Entity.TABLE), eq(exception.getIndexingError()), any(Stats.class));
    assertEquals(25, executor.getStats().get().getReaderStats().getFailedRecords());
    assertEquals(25, executor.getStats().get().getJobStats().getFailedRecords());
  }

  @Test
  void finalizeReindexSkipsPromotedEntitiesPropagatesFailuresAndClearsState() throws Exception {
    RecreateIndexHandler handler = mock(RecreateIndexHandler.class);
    ReindexContext recreateContext = new ReindexContext();
    recreateContext.add(
        Entity.TABLE,
        "table_canonical",
        "table_original",
        "table_staged",
        Set.of("table_existing"),
        "table_alias",
        List.of("column_alias"));
    recreateContext.add(
        Entity.DASHBOARD,
        "dashboard_canonical",
        "dashboard_original",
        "dashboard_staged",
        Set.of("dashboard_existing"),
        "dashboard_alias",
        List.of("chart_alias"));
    @SuppressWarnings("unchecked")
    Set<String> promotedEntities = (Set<String>) getField("promotedEntities");
    @SuppressWarnings("unchecked")
    Map<String, AtomicInteger> failures =
        (Map<String, AtomicInteger>) getField("entityBatchFailures");
    promotedEntities.add(Entity.TABLE);
    failures.put(Entity.DASHBOARD, new AtomicInteger(1));
    setField("recreateIndexHandler", handler);
    setField("recreateContext", recreateContext);

    invokePrivateMethod("finalizeReindex", new Class<?>[0]);

    ArgumentCaptor<EntityReindexContext> contextCaptor =
        ArgumentCaptor.forClass(EntityReindexContext.class);
    verify(handler).finalizeReindex(contextCaptor.capture(), eq(false));
    assertEquals(Entity.DASHBOARD, contextCaptor.getValue().getEntityType());
    assertEquals("dashboard_canonical", contextCaptor.getValue().getCanonicalIndex());
    assertEquals(Set.of("dashboard_existing"), contextCaptor.getValue().getExistingAliases());
    assertEquals(Set.of("chart_alias"), contextCaptor.getValue().getParentAliases());
    assertSame(null, getField("recreateContext"));
    assertTrue(((Set<?>) getField("promotedEntities")).isEmpty());
  }

  @Test
  void createSourceBuildsRegularEntitySourceWithKnownTotals() throws Exception {
    executor.getStats().set(initializeStats(Set.of(Entity.TABLE)));
    executor
        .getStats()
        .get()
        .getEntityStats()
        .getAdditionalProperties()
        .get(Entity.TABLE)
        .setTotalRecords(7);
    setField("batchSize", new java.util.concurrent.atomic.AtomicReference<>(50));

    try (MockedConstruction<PaginatedEntitiesSource> ignored =
        mockConstruction(
            PaginatedEntitiesSource.class,
            (source, context) -> {
              assertEquals(Entity.TABLE, context.arguments().get(0));
              assertEquals(50, context.arguments().get(1));
              assertEquals(List.of("*"), context.arguments().get(2));
              assertEquals(7, context.arguments().get(3));
            })) {
      assertNotNull(
          invokePrivateMethod("createSource", new Class<?>[] {String.class}, Entity.TABLE));
    }
  }

  @Test
  void createSourceBuildsTimeSeriesSourceForCorrectedQueryCostType() throws Exception {
    executor.getStats().set(initializeStats(Set.of(Entity.QUERY_COST_RECORD)));
    executor
        .getStats()
        .get()
        .getEntityStats()
        .getAdditionalProperties()
        .get(Entity.QUERY_COST_RECORD)
        .setTotalRecords(5);
    setField("batchSize", new java.util.concurrent.atomic.AtomicReference<>(40));
    setField(
        "config",
        ReindexingConfiguration.builder()
            .timeSeriesEntityDays(Map.of(Entity.QUERY_COST_RECORD, 1))
            .build());

    try (MockedConstruction<PaginatedEntityTimeSeriesSource> ignored =
        mockConstruction(
            PaginatedEntityTimeSeriesSource.class,
            (source, context) -> {
              assertEquals(Entity.QUERY_COST_RECORD, context.arguments().get(0));
              assertEquals(40, context.arguments().get(1));
              assertEquals(List.of(), context.arguments().get(2));
              assertEquals(5, context.arguments().get(3));
              assertEquals(6, context.arguments().size());
              assertTrue((Long) context.arguments().get(4) > 0);
              assertTrue((Long) context.arguments().get(5) >= (Long) context.arguments().get(4));
            })) {
      assertNotNull(
          invokePrivateMethod("createSource", new Class<?>[] {String.class}, "queryCostResult"));
    }
  }

  @Test
  void searchFieldAndExtractionHelpersRespectEntityKinds() throws Exception {
    @SuppressWarnings("unchecked")
    List<String> regularFields =
        (List<String>)
            invokePrivateMethod(
                "getSearchIndexFields", new Class<?>[] {String.class}, Entity.TABLE);
    @SuppressWarnings("unchecked")
    List<String> timeSeriesFields =
        (List<String>)
            invokePrivateMethod(
                "getSearchIndexFields", new Class<?>[] {String.class}, Entity.QUERY_COST_RECORD);
    ResultList<String> regularEntities = new ResultList<>(List.of("regular"));
    ResultList<String> timeSeriesEntities = new ResultList<>(List.of("timeseries"));

    assertEquals(List.of("*"), regularFields);
    assertEquals(List.of(), timeSeriesFields);
    assertSame(
        regularEntities,
        invokePrivateMethod(
            "extractEntities",
            new Class<?>[] {String.class, Object.class},
            Entity.TABLE,
            regularEntities));
    assertSame(
        timeSeriesEntities,
        invokePrivateMethod(
            "extractEntities",
            new Class<?>[] {String.class, Object.class},
            Entity.QUERY_COST_RECORD,
            timeSeriesEntities));
  }

  @Test
  void updateSinkTotalSubmittedInitializesStatsAndDetermineStatusTracksIncompleteWork()
      throws Exception {
    Stats stats = new Stats();
    stats.setJobStats(
        new StepStats().withTotalRecords(10).withSuccessRecords(9).withFailedRecords(0));
    executor.getStats().set(stats);

    executor.updateSinkTotalSubmitted(4);

    assertEquals(4, executor.getStats().get().getSinkStats().getTotalRecords());
    assertEquals(
        ExecutionResult.Status.COMPLETED_WITH_ERRORS,
        invokePrivateMethod("determineStatus", new Class<?>[0]));

    ((java.util.concurrent.atomic.AtomicBoolean) getField("stopped")).set(true);
    assertEquals(
        ExecutionResult.Status.STOPPED, invokePrivateMethod("determineStatus", new Class<?>[0]));
    ((java.util.concurrent.atomic.AtomicBoolean) getField("stopped")).set(false);
  }

  @Test
  void buildEntityReindexContextCopiesAliasAndIndexState() throws Exception {
    ReindexContext recreateContext = new ReindexContext();
    recreateContext.add(
        Entity.TABLE,
        "table_canonical",
        "table_original",
        "table_staged",
        Set.of("table_existing"),
        "table_alias",
        List.of("column_alias"));
    setField("recreateContext", recreateContext);

    EntityReindexContext context =
        (EntityReindexContext)
            invokePrivateMethod(
                "buildEntityReindexContext", new Class<?>[] {String.class}, Entity.TABLE);

    assertEquals(Entity.TABLE, context.getEntityType());
    assertEquals("table_original", context.getOriginalIndex());
    assertEquals("table_canonical", context.getCanonicalIndex());
    assertEquals("table_original", context.getActiveIndex());
    assertEquals("table_staged", context.getStagedIndex());
    assertEquals("table_alias", context.getCanonicalAliases());
    assertEquals(Set.of("table_existing"), context.getExistingAliases());
    assertEquals(Set.of("column_alias"), context.getParentAliases());
  }

  @Test
  void reCreateIndexesDelegatesWhenHandlerExistsAndReturnsNullOtherwise() throws Exception {
    RecreateIndexHandler handler = mock(RecreateIndexHandler.class);
    ReindexContext recreateContext = new ReindexContext();
    when(handler.reCreateIndexes(Set.of(Entity.TABLE))).thenReturn(recreateContext);
    setField("recreateIndexHandler", handler);

    assertSame(
        recreateContext,
        invokePrivateMethod("reCreateIndexes", new Class<?>[] {Set.class}, Set.of(Entity.TABLE)));

    setField("recreateIndexHandler", null);
    assertSame(
        null,
        invokePrivateMethod("reCreateIndexes", new Class<?>[] {Set.class}, Set.of(Entity.TABLE)));
  }

  @Test
  void closeFlushesStatsManagerAndSinkTrackersBeforeShutdown() throws Exception {
    JobStatsManager statsManager = mock(JobStatsManager.class);
    StageStatsTracker tracker = mock(StageStatsTracker.class);
    @SuppressWarnings("unchecked")
    Map<String, StageStatsTracker> sinkTrackers =
        (Map<String, StageStatsTracker>) getField("sinkTrackers");
    setField("statsManager", statsManager);
    sinkTrackers.put(Entity.TABLE, tracker);

    executor.close();

    verify(statsManager).flushAll();
    verify(tracker).flush();
    assertTrue(executor.isStopped());
  }

  @Test
  void executeCompletesRecreateFlowForZeroEntityWorkload() {
    ReindexingProgressListener listener = mock(ReindexingProgressListener.class);
    ReindexingJobContext jobContext = mock(ReindexingJobContext.class);
    CollectionDAO.SearchIndexFailureDAO failureDao =
        mock(CollectionDAO.SearchIndexFailureDAO.class);
    EntityRepository<?> entityRepository = mock(EntityRepository.class);
    EntityDAO entityDao = mock(EntityDAO.class);
    BulkSink sink = mock(BulkSink.class);
    DefaultRecreateHandler handler = mock(DefaultRecreateHandler.class);
    UUID jobId = UUID.randomUUID();
    ReindexContext recreateContext = new ReindexContext();
    ReindexingConfiguration config =
        ReindexingConfiguration.builder()
            .entities(Set.of(Entity.TABLE))
            .recreateIndex(true)
            .build();

    recreateContext.add(
        Entity.TABLE,
        "table_canonical",
        "table_original",
        "table_staged",
        Set.of("table_existing"),
        "table_alias",
        List.of("column_alias"));
    when(jobContext.getJobId()).thenReturn(jobId);
    when(collectionDAO.searchIndexFailureDAO()).thenReturn(failureDao);
    when(entityRepository.getDao()).thenReturn(entityDao);
    when(entityDao.listCount(any(ListFilter.class))).thenReturn(0);
    when(searchRepository.createBulkSink(100, 100, 104857600L)).thenReturn(sink);
    when(searchRepository.createReindexHandler()).thenReturn(handler);
    when(handler.reCreateIndexes(Set.of(Entity.TABLE))).thenReturn(recreateContext);
    executor.addListener(listener);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedConstruction<SearchIndexClusterValidator> ignored =
            mockConstruction(SearchIndexClusterValidator.class)) {
      entityMock.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(entityRepository);

      ExecutionResult result = executor.execute(config, jobContext);

      assertEquals(ExecutionResult.Status.COMPLETED, result.status());
    }

    verify(listener).onJobStarted(jobContext);
    verify(listener).onJobConfigured(jobContext, config);
    verify(listener).onIndexRecreationStarted(Set.of(Entity.TABLE));
    verify(listener).onEntityTypeStarted(Entity.TABLE, 0);
    verify(listener).onEntityTypeCompleted(eq(Entity.TABLE), any());
    verify(listener).onJobCompleted(any(Stats.class), anyLong());
    verify(handler).reCreateIndexes(Set.of(Entity.TABLE));
    verify(handler).promoteEntityIndex(any(EntityReindexContext.class), eq(true));
    verify(sink).close();
  }

  @Test
  void executeReturnsFailedResultWhenInitializationThrows() {
    ReindexingProgressListener listener = mock(ReindexingProgressListener.class);
    ReindexingJobContext jobContext = mock(ReindexingJobContext.class);
    EntityRepository<?> entityRepository = mock(EntityRepository.class);
    EntityDAO entityDao = mock(EntityDAO.class);
    ReindexingConfiguration config =
        ReindexingConfiguration.builder().entities(Set.of(Entity.TABLE)).build();

    when(jobContext.getJobId()).thenReturn(UUID.randomUUID());
    when(entityRepository.getDao()).thenReturn(entityDao);
    when(entityDao.listCount(any(ListFilter.class))).thenReturn(0);
    when(searchRepository.createBulkSink(100, 100, 104857600L))
        .thenThrow(new IllegalStateException("sink init failed"));
    executor.addListener(listener);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(entityRepository);

      ExecutionResult result = executor.execute(config, jobContext);

      assertEquals(ExecutionResult.Status.FAILED, result.status());
    }

    verify(listener).onJobStarted(jobContext);
    verify(listener).onJobFailed(any(Stats.class), any(IllegalStateException.class));
  }

  @Test
  void processEntityTypeSubmitsRegularReadersAndAdjustsBoundaryShortfall() throws Exception {
    ExecutorService producerExecutor = mock(ExecutorService.class);
    ReindexingProgressListener listener = mock(ReindexingProgressListener.class);
    LinkedBlockingQueue<Object> queue = new LinkedBlockingQueue<>();
    Phaser producerPhaser = new Phaser(1);
    String boundaryCursor = RestUtil.encodeCursor("{\"name\":\"m\",\"id\":\"1\"}");

    doAnswer(
            invocation -> {
              ((Runnable) invocation.getArgument(0)).run();
              return null;
            })
        .when(producerExecutor)
        .submit(any(Runnable.class));
    executor.addListener(listener);
    executor.getStats().set(statsWithEntityTotals(Map.of(Entity.USER, 45)));
    setField("producerExecutor", producerExecutor);
    setField("taskQueue", queue);
    setField("config", ReindexingConfiguration.builder().entities(Set.of(Entity.USER)).build());
    setField("batchSize", new java.util.concurrent.atomic.AtomicReference<>(10));

    try (MockedConstruction<PaginatedEntitiesSource> ignored =
        mockConstruction(
            PaginatedEntitiesSource.class,
            (source, context) -> {
              when(source.findBoundaryCursors(3, 45)).thenReturn(List.of(boundaryCursor));
              when(source.readNextKeyset(any()))
                  .thenReturn(
                      (ResultList)
                          new ResultList<>(List.of(mock(EntityInterface.class)), null, null, 1));
            })) {
      invokePrivateMethod(
          "processEntityType",
          new Class<?>[] {String.class, Phaser.class},
          Entity.USER,
          producerPhaser);
    }

    assertEquals(2, queue.size());
    assertTrue(producerPhaser.isTerminated());
    @SuppressWarnings("unchecked")
    Map<String, AtomicInteger> batchCounters =
        (Map<String, AtomicInteger>) getField("entityBatchCounters");
    assertEquals(0, batchCounters.get(Entity.USER).get());
    verify(listener).onEntityTypeStarted(Entity.USER, 45);
    verify(listener).onEntityTypeCompleted(eq(Entity.USER), any());
  }

  @Test
  void processKeysetBatchesRecordsSuccessfulReadAndPromotesEntity() throws Exception {
    LinkedBlockingQueue<Object> queue = new LinkedBlockingQueue<>();
    DefaultRecreateHandler handler = mock(DefaultRecreateHandler.class);
    ReindexContext recreateContext = new ReindexContext();
    Phaser producerPhaser = new Phaser(1);

    recreateContext.add(
        Entity.TABLE,
        "table_canonical",
        "table_original",
        "table_staged",
        Set.of("table_existing"),
        "table_alias",
        List.of("column_alias"));
    setField("taskQueue", queue);
    setField("config", ReindexingConfiguration.builder().recreateIndex(true).build());
    setField("recreateIndexHandler", handler);
    setField("recreateContext", recreateContext);
    @SuppressWarnings("unchecked")
    Map<String, AtomicInteger> batchCounters =
        (Map<String, AtomicInteger>) getField("entityBatchCounters");
    @SuppressWarnings("unchecked")
    Map<String, AtomicInteger> batchFailures =
        (Map<String, AtomicInteger>) getField("entityBatchFailures");
    batchCounters.put(Entity.TABLE, new AtomicInteger(1));
    batchFailures.put(Entity.TABLE, new AtomicInteger(0));

    invokePrivateMethod(
        "processKeysetBatches",
        new Class<?>[] {
          String.class,
          int.class,
          int.class,
          String.class,
          SearchIndexExecutor.KeysetBatchReader.class,
          Phaser.class
        },
        Entity.TABLE,
        10,
        5,
        null,
        (SearchIndexExecutor.KeysetBatchReader)
            cursor -> new ResultList<>(List.of("entity"), null, null, 1),
        producerPhaser);

    assertEquals(1, queue.size());
    assertTrue(producerPhaser.isTerminated());
    assertEquals(0, batchFailures.get(Entity.TABLE).get());
    verify(handler).promoteEntityIndex(any(EntityReindexContext.class), eq(true));
  }

  @Test
  void processKeysetBatchesRecordsReaderFailuresAndMarksEntityFailed() throws Exception {
    ReindexingProgressListener listener = mock(ReindexingProgressListener.class);
    IndexingFailureRecorder failureRecorder = mock(IndexingFailureRecorder.class);
    Phaser producerPhaser = new Phaser(1);
    SearchIndexException exception =
        new SearchIndexException(
            new IndexingError().withMessage("read timeout").withFailedCount(2));

    executor.addListener(listener);
    executor.getStats().set(statsWithEntityTotals(Map.of(Entity.TABLE, 5)));
    setField("taskQueue", new LinkedBlockingQueue<>());
    setField("failureRecorder", failureRecorder);
    @SuppressWarnings("unchecked")
    Map<String, AtomicInteger> batchCounters =
        (Map<String, AtomicInteger>) getField("entityBatchCounters");
    @SuppressWarnings("unchecked")
    Map<String, AtomicInteger> batchFailures =
        (Map<String, AtomicInteger>) getField("entityBatchFailures");
    batchCounters.put(Entity.TABLE, new AtomicInteger(1));
    batchFailures.put(Entity.TABLE, new AtomicInteger(0));

    invokePrivateMethod(
        "processKeysetBatches",
        new Class<?>[] {
          String.class,
          int.class,
          int.class,
          String.class,
          SearchIndexExecutor.KeysetBatchReader.class,
          Phaser.class
        },
        Entity.TABLE,
        5,
        5,
        null,
        (SearchIndexExecutor.KeysetBatchReader)
            cursor -> {
              throw exception;
            },
        producerPhaser);

    verify(failureRecorder)
        .recordReaderFailure(eq(Entity.TABLE), eq("read timeout"), any(String.class));
    verify(listener).onError(eq(Entity.TABLE), eq(exception.getIndexingError()), any(Stats.class));
    assertEquals(2, executor.getStats().get().getReaderStats().getFailedRecords());
    assertEquals(2, executor.getStats().get().getJobStats().getFailedRecords());
    assertEquals(1, batchFailures.get(Entity.TABLE).get());
    assertTrue(producerPhaser.isTerminated());
  }

  @Test
  void submitReadersSingleReaderQueuesBatchesWithoutBoundaryLookup() throws Exception {
    ExecutorService producerExecutor = mock(ExecutorService.class);
    LinkedBlockingQueue<Object> queue = new LinkedBlockingQueue<>();
    Phaser producerPhaser = new Phaser(1);

    doAnswer(
            invocation -> {
              ((Runnable) invocation.getArgument(0)).run();
              return null;
            })
        .when(producerExecutor)
        .submit(any(Runnable.class));
    setField("producerExecutor", producerExecutor);
    setField("taskQueue", queue);
    @SuppressWarnings("unchecked")
    Map<String, AtomicInteger> batchCounters =
        (Map<String, AtomicInteger>) getField("entityBatchCounters");
    @SuppressWarnings("unchecked")
    Map<String, AtomicInteger> batchFailures =
        (Map<String, AtomicInteger>) getField("entityBatchFailures");
    batchCounters.put(Entity.TABLE, new AtomicInteger(1));
    batchFailures.put(Entity.TABLE, new AtomicInteger(0));

    invokePrivateMethod(
        "submitReaders",
        new Class<?>[] {
          String.class,
          int.class,
          int.class,
          int.class,
          Phaser.class,
          java.util.function.Supplier.class,
          java.util.function.BiFunction.class
        },
        Entity.TABLE,
        1,
        5,
        1,
        producerPhaser,
        (java.util.function.Supplier<SearchIndexExecutor.KeysetBatchReader>)
            () -> cursor -> new ResultList<>(List.of("entity"), null, null, 1),
        (java.util.function.BiFunction<Integer, Integer, List<String>>)
            (readers, total) -> {
              throw new AssertionError("Boundary lookup should not run for a single reader");
            });

    assertEquals(1, queue.size());
    assertTrue(producerPhaser.isTerminated());
    assertEquals(0, batchFailures.get(Entity.TABLE).get());
  }

  @Test
  void processBatchQueuesReadResultsAndPromotesFinalBatch() throws Exception {
    LinkedBlockingQueue<Object> queue = new LinkedBlockingQueue<>();
    CountDownLatch latch = new CountDownLatch(1);
    DefaultRecreateHandler handler = mock(DefaultRecreateHandler.class);
    ReindexContext recreateContext = new ReindexContext();

    recreateContext.add(
        Entity.USER,
        "user_canonical",
        "user_original",
        "user_staged",
        Set.of("user_existing"),
        "user_alias",
        List.of("team_alias"));
    executor.getStats().set(statsWithEntityTotals(Map.of(Entity.USER, 1)));
    setField("taskQueue", queue);
    setField("batchSize", new java.util.concurrent.atomic.AtomicReference<>(10));
    setField("config", ReindexingConfiguration.builder().recreateIndex(true).build());
    setField("recreateIndexHandler", handler);
    setField("recreateContext", recreateContext);
    @SuppressWarnings("unchecked")
    Map<String, AtomicInteger> batchCounters =
        (Map<String, AtomicInteger>) getField("entityBatchCounters");
    @SuppressWarnings("unchecked")
    Map<String, AtomicInteger> batchFailures =
        (Map<String, AtomicInteger>) getField("entityBatchFailures");
    batchCounters.put(Entity.USER, new AtomicInteger(1));
    batchFailures.put(Entity.USER, new AtomicInteger(0));

    try (MockedConstruction<PaginatedEntitiesSource> ignored =
        mockConstruction(
            PaginatedEntitiesSource.class,
            (source, context) ->
                when(source.readWithCursor(RestUtil.encodeCursor("0")))
                    .thenReturn(
                        (ResultList) new ResultList<>(List.of(mock(EntityInterface.class)))))) {
      invokePrivateMethod(
          "processBatch",
          new Class<?>[] {String.class, int.class, CountDownLatch.class},
          Entity.USER,
          0,
          latch);
    }

    assertEquals(0, latch.getCount());
    assertEquals(1, queue.size());
    verify(handler).promoteEntityIndex(any(EntityReindexContext.class), eq(true));
  }

  @Test
  void handleSinkFailureRoutesProcessAndSinkStagesToRecorder() throws Exception {
    IndexingFailureRecorder failureRecorder = mock(IndexingFailureRecorder.class);
    setField("failureRecorder", failureRecorder);

    invokePrivateMethod(
        "handleSinkFailure",
        new Class<?>[] {
          String.class,
          String.class,
          String.class,
          String.class,
          IndexingFailureRecorder.FailureStage.class
        },
        Entity.TABLE,
        "1",
        "svc.db.table",
        "process boom",
        IndexingFailureRecorder.FailureStage.PROCESS);
    invokePrivateMethod(
        "handleSinkFailure",
        new Class<?>[] {
          String.class,
          String.class,
          String.class,
          String.class,
          IndexingFailureRecorder.FailureStage.class
        },
        Entity.TABLE,
        "2",
        "svc.db.table",
        "sink boom",
        IndexingFailureRecorder.FailureStage.SINK);

    verify(failureRecorder).recordProcessFailure(Entity.TABLE, "1", "svc.db.table", "process boom");
    verify(failureRecorder).recordSinkFailure(Entity.TABLE, "2", "svc.db.table", "sink boom");
  }

  @Test
  void isBackpressureActiveTracksQueueFillRatio() throws Exception {
    LinkedBlockingQueue<Object> queue = new LinkedBlockingQueue<>(10);
    ReindexingMetrics metrics = mock(ReindexingMetrics.class);

    for (int i = 0; i < 10; i++) {
      queue.add(i);
    }
    setField("taskQueue", queue);

    try (MockedStatic<ReindexingMetrics> metricsMock = mockStatic(ReindexingMetrics.class)) {
      metricsMock.when(ReindexingMetrics::getInstance).thenReturn(metrics);

      assertTrue((Boolean) invokePrivateMethod("isBackpressureActive", new Class<?>[0]));
      verify(metrics).updateQueueFillRatio(100);

      queue.clear();
      assertFalse((Boolean) invokePrivateMethod("isBackpressureActive", new Class<?>[0]));
      verify(metrics).updateQueueFillRatio(0);
    }
  }

  @Test
  void calculateNumberOfThreadsHandlesExactRemaindersAndInvalidBatchSize() throws Exception {
    assertEquals(
        1,
        invokePrivateMethod(
            "calculateNumberOfThreads", new Class<?>[] {int.class, int.class}, 10, 0));
    assertEquals(
        2,
        invokePrivateMethod(
            "calculateNumberOfThreads", new Class<?>[] {int.class, int.class}, 40, 20));
    assertEquals(
        3,
        invokePrivateMethod(
            "calculateNumberOfThreads", new Class<?>[] {int.class, int.class}, 41, 20));
  }

  @Test
  void runConsumerProcessesQueuedWorkUntilPoisonPill() throws Exception {
    BulkSink sink = mock(BulkSink.class);
    @SuppressWarnings("unchecked")
    Source<Object> source = mock(Source.class);
    LinkedBlockingQueue<Object> queue = new LinkedBlockingQueue<>();
    CountDownLatch latch = new CountDownLatch(1);

    executor.getStats().set(statsWithEntityTotals(Map.of(Entity.TABLE, 1)));
    setField("config", ReindexingConfiguration.builder().build());
    setField("searchIndexSink", sink);
    setField("taskQueue", queue);
    when(source.readWithCursor(RestUtil.encodeCursor("0")))
        .thenReturn(new ResultList<>(List.of(mock(EntityInterface.class))));

    invokePrivateMethod(
        "processReadTask",
        new Class<?>[] {String.class, Source.class, int.class},
        Entity.TABLE,
        source,
        0);
    invokePrivateMethod("signalConsumersToStop", new Class<?>[] {int.class}, 1);
    invokePrivateMethod("runConsumer", new Class<?>[] {int.class, CountDownLatch.class}, 0, latch);

    verify(sink).write(any(List.class), any(Map.class));
    assertEquals(0, latch.getCount());
    assertEquals(1, executor.getStats().get().getJobStats().getSuccessRecords());
  }

  @Test
  void processEntityReindexStopsImmediatelyWhenExecutorIsStopped() throws Exception {
    ExecutorService producerExecutor = mock(ExecutorService.class);
    ExecutorService jobExecutor = mock(ExecutorService.class);

    setField("producerExecutor", producerExecutor);
    setField("jobExecutor", jobExecutor);
    ((java.util.concurrent.atomic.AtomicBoolean) getField("stopped")).set(true);

    invokePrivateMethod("processEntityReindex", new Class<?>[] {Set.class}, Set.of(Entity.TABLE));

    verify(producerExecutor).shutdownNow();
    verify(jobExecutor).shutdownNow();
    ((java.util.concurrent.atomic.AtomicBoolean) getField("stopped")).set(false);
  }

  @Test
  void cleanupExecutorsShutsDownAllPoolsWhenStillRunning() throws Exception {
    ExecutorService consumerExecutor = Executors.newSingleThreadExecutor();
    ExecutorService jobExecutor = Executors.newSingleThreadExecutor();
    ExecutorService producerExecutor = Executors.newSingleThreadExecutor();

    setField("consumerExecutor", consumerExecutor);
    setField("jobExecutor", jobExecutor);
    setField("producerExecutor", producerExecutor);

    invokePrivateMethod("cleanupExecutors", new Class<?>[0]);

    assertTrue(consumerExecutor.isShutdown());
    assertTrue(jobExecutor.isShutdown());
    assertTrue(producerExecutor.isShutdown());
  }

  @Test
  void removeListenerReturnsExecutorInstance() {
    ReindexingProgressListener listener = mock(ReindexingProgressListener.class);

    assertSame(executor, executor.addListener(listener).removeListener(listener));
  }

  @Test
  void expandEntitiesReturnsIndexedUniverseWhenAllRequested() throws Exception {
    when(searchRepository.getEntityIndexMap())
        .thenReturn(
            Map.of(
                Entity.TABLE, mock(org.openmetadata.search.IndexMapping.class),
                Entity.ENTITY_REPORT_DATA, mock(org.openmetadata.search.IndexMapping.class)));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getEntityList).thenReturn(Set.of(Entity.TABLE, Entity.USER));

      @SuppressWarnings("unchecked")
      Set<String> expanded =
          (Set<String>)
              invokePrivateMethod("expandEntities", new Class<?>[] {Set.class}, Set.of("all"));

      assertTrue(expanded.contains(Entity.TABLE));
      assertTrue(expanded.contains(Entity.ENTITY_REPORT_DATA));
      assertFalse(expanded.contains(Entity.USER));
    }
  }

  @Test
  void calculateThreadConfigurationHonorsConfiguredProducerAndConsumerThreads() throws Exception {
    setField(
        "config",
        ReindexingConfiguration.builder()
            .entities(Set.of(Entity.TABLE))
            .producerThreads(6)
            .consumerThreads(4)
            .build());

    Object threadConfiguration =
        invokePrivateMethod("calculateThreadConfiguration", new Class<?>[] {long.class}, 50_000L);

    assertEquals(6, invokeRecordAccessor(threadConfiguration, "numProducers"));
    assertEquals(4, invokeRecordAccessor(threadConfiguration, "numConsumers"));
  }

  @Test
  void runConsumerContinuesPollingAndExitsWhenInterrupted() throws Exception {
    LinkedBlockingQueue<Object> queue = new LinkedBlockingQueue<>();
    CountDownLatch latch = new CountDownLatch(1);
    setField("taskQueue", queue);

    Thread consumerThread =
        new Thread(
            () -> {
              try {
                invokePrivateMethod(
                    "runConsumer", new Class<?>[] {int.class, CountDownLatch.class}, 7, latch);
              } catch (Exception e) {
                throw new RuntimeException(e);
              }
            });

    consumerThread.start();
    Thread.sleep(250);
    consumerThread.interrupt();
    consumerThread.join(2_000);

    assertFalse(consumerThread.isAlive());
    assertEquals(0, latch.getCount());
  }

  @Test
  void processTaskRecordsReaderBatchAndHandlesTimeSeriesSinkFailuresWithoutIndexingError()
      throws Exception {
    BulkSink sink = mock(BulkSink.class);
    JobStatsManager statsManager = mock(JobStatsManager.class);
    org.openmetadata.service.apps.bundles.searchIndex.stats.EntityStatsTracker tracker =
        mock(org.openmetadata.service.apps.bundles.searchIndex.stats.EntityStatsTracker.class);
    ReindexingProgressListener listener = mock(ReindexingProgressListener.class);
    EntityTimeSeriesInterface timeSeriesEntity = mock(EntityTimeSeriesInterface.class);

    executor.addListener(listener);
    executor.getStats().set(statsWithEntityTotals(Map.of(Entity.TEST_CASE_RESULT, 1)));
    setField("config", ReindexingConfiguration.builder().build());
    setField("searchIndexSink", sink);
    setField("statsManager", statsManager);
    when(statsManager.getTracker(Entity.TEST_CASE_RESULT)).thenReturn(tracker);
    doThrow(new SearchIndexException(new RuntimeException("sink failed")))
        .when(sink)
        .write(any(List.class), any(Map.class));

    invokeProcessTask(
        newIndexingTask(
            Entity.TEST_CASE_RESULT,
            new ResultList<>(List.of(timeSeriesEntity), null, null, 0),
            0));

    verify(tracker).recordReaderBatch(1, 0, 0);
    verify(sink).write(any(List.class), any(Map.class));
    verify(listener)
        .onError(eq(Entity.TEST_CASE_RESULT), any(IndexingError.class), any(Stats.class));
  }

  @Test
  void processTaskRoutesGenericSinkExceptionsToFailureHandler() throws Exception {
    BulkSink sink = mock(BulkSink.class);
    ReindexingProgressListener listener = mock(ReindexingProgressListener.class);
    EntityInterface entity = mock(EntityInterface.class);

    executor.addListener(listener);
    executor.getStats().set(statsWithEntityTotals(Map.of(Entity.TABLE, 1)));
    setField("config", ReindexingConfiguration.builder().build());
    setField("searchIndexSink", sink);
    doThrow(new IllegalStateException("generic sink failure"))
        .when(sink)
        .write(any(List.class), any(Map.class));

    invokeProcessTask(
        newIndexingTask(Entity.TABLE, new ResultList<>(List.of(entity), null, null, 0), 0));

    verify(listener).onError(eq(Entity.TABLE), any(IndexingError.class), any(Stats.class));
  }

  @Test
  void processEntityTypeUsesTimeSeriesSourcesWithConfiguredWindow() throws Exception {
    ExecutorService producerExecutor = mock(ExecutorService.class);
    LinkedBlockingQueue<Object> queue = new LinkedBlockingQueue<>();
    Phaser producerPhaser = new Phaser(1);

    doAnswer(
            invocation -> {
              ((Runnable) invocation.getArgument(0)).run();
              return null;
            })
        .when(producerExecutor)
        .submit(any(Runnable.class));
    executor.getStats().set(statsWithEntityTotals(Map.of(Entity.TEST_CASE_RESULT, 24)));
    setField("producerExecutor", producerExecutor);
    setField("taskQueue", queue);
    setField(
        "config",
        ReindexingConfiguration.builder()
            .entities(Set.of(Entity.TEST_CASE_RESULT))
            .timeSeriesEntityDays(Map.of(Entity.TEST_CASE_RESULT, 7))
            .build());
    setField("batchSize", new AtomicReference<>(10));

    try (MockedConstruction<PaginatedEntityTimeSeriesSource> ignored =
        mockConstruction(
            PaginatedEntityTimeSeriesSource.class,
            (source, context) ->
                when(source.readWithCursor(any()))
                    .thenReturn(
                        (ResultList)
                            new ResultList<>(List.of(mock(EntityTimeSeriesInterface.class)))))) {
      invokePrivateMethod(
          "processEntityType",
          new Class<?>[] {String.class, Phaser.class},
          Entity.TEST_CASE_RESULT,
          producerPhaser);
    }

    assertFalse(queue.isEmpty());
    assertTrue(producerPhaser.isTerminated());
  }

  @Test
  void processEntityTypeDeregistersReaderPartiesWhenSubmissionFails() throws Exception {
    ExecutorService producerExecutor = mock(ExecutorService.class);
    Phaser producerPhaser = new Phaser(1);

    when(producerExecutor.submit(any(Runnable.class)))
        .thenThrow(new IllegalStateException("submit failed"));
    executor.getStats().set(statsWithEntityTotals(Map.of(Entity.USER, 40)));
    setField("producerExecutor", producerExecutor);
    setField("taskQueue", new LinkedBlockingQueue<>());
    setField("config", ReindexingConfiguration.builder().entities(Set.of(Entity.USER)).build());
    setField("batchSize", new AtomicReference<>(10));

    invokePrivateMethod(
        "processEntityType",
        new Class<?>[] {String.class, Phaser.class},
        Entity.USER,
        producerPhaser);

    assertTrue(producerPhaser.isTerminated());
  }

  @Test
  void processKeysetBatchesStopsWhenReaderReachesEndCursorBoundary() throws Exception {
    LinkedBlockingQueue<Object> queue = new LinkedBlockingQueue<>();
    Phaser producerPhaser = new Phaser(1);
    String boundaryCursor = "{\"name\":\"orders\",\"id\":\"2\"}";
    String endCursor = RestUtil.encodeCursor(boundaryCursor);
    ResultList<String> page = new ResultList<>(List.of("entity"), null, null, boundaryCursor, 1);

    setField("taskQueue", queue);
    @SuppressWarnings("unchecked")
    Map<String, AtomicInteger> batchCounters =
        (Map<String, AtomicInteger>) getField("entityBatchCounters");
    @SuppressWarnings("unchecked")
    Map<String, AtomicInteger> batchFailures =
        (Map<String, AtomicInteger>) getField("entityBatchFailures");
    batchCounters.put(Entity.TABLE, new AtomicInteger(1));
    batchFailures.put(Entity.TABLE, new AtomicInteger(0));

    invokePrivateMethod(
        "processKeysetBatches",
        new Class<?>[] {
          String.class,
          int.class,
          int.class,
          String.class,
          SearchIndexExecutor.KeysetBatchReader.class,
          Phaser.class,
          String.class
        },
        Entity.TABLE,
        10,
        5,
        null,
        (SearchIndexExecutor.KeysetBatchReader) cursor -> page,
        producerPhaser,
        endCursor);

    assertEquals(1, queue.size());
    assertEquals(0, batchFailures.get(Entity.TABLE).get());
    assertTrue(producerPhaser.isTerminated());
  }

  @Test
  void processKeysetBatchesMarksFailuresForUnexpectedExceptions() throws Exception {
    Phaser producerPhaser = new Phaser(1);
    @SuppressWarnings("unchecked")
    Map<String, AtomicInteger> batchCounters =
        (Map<String, AtomicInteger>) getField("entityBatchCounters");
    @SuppressWarnings("unchecked")
    Map<String, AtomicInteger> batchFailures =
        (Map<String, AtomicInteger>) getField("entityBatchFailures");
    batchCounters.put(Entity.TABLE, new AtomicInteger(1));
    batchFailures.put(Entity.TABLE, new AtomicInteger(0));
    setField("taskQueue", new LinkedBlockingQueue<>());

    invokePrivateMethod(
        "processKeysetBatches",
        new Class<?>[] {
          String.class,
          int.class,
          int.class,
          String.class,
          SearchIndexExecutor.KeysetBatchReader.class,
          Phaser.class
        },
        Entity.TABLE,
        5,
        5,
        null,
        (SearchIndexExecutor.KeysetBatchReader)
            cursor -> {
              throw new IllegalStateException("unexpected");
            },
        producerPhaser);

    assertEquals(1, batchFailures.get(Entity.TABLE).get());
    assertTrue(producerPhaser.isTerminated());
  }

  private Stats initializeStats(Set<String> entities) {
    Stats stats = executor.initializeTotalRecords(entities);
    if (stats.getEntityStats() == null) {
      stats.setEntityStats(new EntityStats());
    }
    return stats;
  }

  private Stats statsWithEntityTotals(Map<String, Integer> entityTotals) {
    Stats stats = new Stats();
    EntityStats entityStats = new EntityStats();
    int totalRecords = 0;

    for (Map.Entry<String, Integer> entry : entityTotals.entrySet()) {
      totalRecords += entry.getValue();
      entityStats
          .getAdditionalProperties()
          .put(
              entry.getKey(),
              new StepStats()
                  .withTotalRecords(entry.getValue())
                  .withSuccessRecords(0)
                  .withFailedRecords(0));
    }

    stats.setEntityStats(entityStats);
    stats.setJobStats(
        new StepStats().withTotalRecords(totalRecords).withSuccessRecords(0).withFailedRecords(0));
    stats.setReaderStats(
        new StepStats()
            .withTotalRecords(totalRecords)
            .withSuccessRecords(0)
            .withFailedRecords(0)
            .withWarningRecords(0));
    stats.setSinkStats(
        new StepStats().withTotalRecords(0).withSuccessRecords(0).withFailedRecords(0));
    stats.setProcessStats(
        new StepStats().withTotalRecords(0).withSuccessRecords(0).withFailedRecords(0));
    return stats;
  }

  private Object invokePrivateMethod(String methodName, Class<?>[] parameterTypes, Object... args)
      throws Exception {
    Method method = SearchIndexExecutor.class.getDeclaredMethod(methodName, parameterTypes);
    method.setAccessible(true);
    return method.invoke(executor, args);
  }

  private void setField(String fieldName, Object value) throws Exception {
    Field field = SearchIndexExecutor.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(executor, value);
  }

  private Object getField(String fieldName) throws Exception {
    Field field = SearchIndexExecutor.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    return field.get(executor);
  }

  private Object newIndexingTask(String entityType, ResultList<?> entities, int offset)
      throws Exception {
    Class<?> taskClass =
        Class.forName(
            "org.openmetadata.service.apps.bundles.searchIndex.SearchIndexExecutor$IndexingTask");
    var constructor = taskClass.getDeclaredConstructor(String.class, ResultList.class, int.class);
    constructor.setAccessible(true);
    return constructor.newInstance(entityType, entities, offset);
  }

  private void invokeProcessTask(Object task) throws Exception {
    Method method = SearchIndexExecutor.class.getDeclaredMethod("processTask", task.getClass());
    method.setAccessible(true);
    method.invoke(executor, task);
  }

  private Object invokeRecordAccessor(Object record, String accessor) throws Exception {
    Method method = record.getClass().getDeclaredMethod(accessor);
    method.setAccessible(true);
    return method.invoke(record);
  }

  private Object invokeTaskAccessor(Object task, String accessor) throws Exception {
    Method method = task.getClass().getDeclaredMethod(accessor);
    method.setAccessible(true);
    return method.invoke(task);
  }
}
