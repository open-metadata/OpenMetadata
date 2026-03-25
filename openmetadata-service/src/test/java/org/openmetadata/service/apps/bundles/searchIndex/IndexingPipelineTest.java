package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.Phaser;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.system.EntityStats;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.EntityTimeSeriesDAO;
import org.openmetadata.service.jdbi3.EntityTimeSeriesRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.search.EntityReindexContext;
import org.openmetadata.service.search.RecreateIndexHandler;
import org.openmetadata.service.search.ReindexContext;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.FullyQualifiedName;

@SuppressWarnings({"rawtypes", "unchecked"})
class IndexingPipelineTest {

  private SearchRepository searchRepository;
  private IndexingPipeline pipeline;

  @BeforeEach
  void setUp() {
    searchRepository = mock(SearchRepository.class);
    pipeline = new IndexingPipeline(searchRepository);
  }

  @AfterEach
  void tearDown() {
    pipeline.close();
  }

  @Test
  void executeProcessesEntitiesUsingComputedTotalsAndCompletes() throws Exception {
    BulkSink sink = mock(BulkSink.class);
    ReindexingProgressListener listener = mock(ReindexingProgressListener.class);
    ReindexingJobContext context = mockJobContext();
    EntityRepository entityRepository = mock(EntityRepository.class);
    EntityDAO entityDao = mock(EntityDAO.class);
    EntityInterface entityA = mock(EntityInterface.class);
    EntityInterface entityB = mock(EntityInterface.class);
    ResultList<EntityInterface> batch = new ResultList<>(List.of(entityA, entityB), null, null, 0);

    when(entityRepository.getDao()).thenReturn(entityDao);
    when(entityDao.listCount(any(ListFilter.class))).thenReturn(2);
    when(sink.getPendingVectorTaskCount()).thenReturn(0);
    when(sink.getStats()).thenReturn(new StepStats().withTotalRecords(2).withSuccessRecords(2));
    when(sink.getProcessStats())
        .thenReturn(new StepStats().withTotalRecords(2).withSuccessRecords(2));

    pipeline.addListener(listener);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedConstruction<EntityReader> ignored =
            mockConstruction(
                EntityReader.class,
                (reader, context1) ->
                    doAnswer(
                            invocation -> {
                              String entityType = invocation.getArgument(0);
                              int totalRecords = invocation.getArgument(1);
                              EntityReader.BatchCallback callback = invocation.getArgument(4);
                              assertEquals(Entity.TABLE, entityType);
                              assertEquals(2, totalRecords);
                              callback.onBatchRead(entityType, batch, 0);
                              return 1;
                            })
                        .when(reader)
                        .readEntity(
                            any(String.class),
                            anyInt(),
                            anyInt(),
                            any(Phaser.class),
                            any(EntityReader.BatchCallback.class),
                            any(),
                            any()))) {
      entityMock.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(entityRepository);

      ExecutionResult result =
          pipeline.execute(
              ReindexingConfiguration.builder()
                  .entities(Set.of(Entity.TABLE))
                  .batchSize(2)
                  .consumerThreads(1)
                  .producerThreads(1)
                  .build(),
              context,
              Set.of(Entity.TABLE),
              sink,
              null,
              null);

      assertEquals(ExecutionResult.Status.COMPLETED, result.status());
      assertEquals(2, result.finalStats().getJobStats().getTotalRecords());
      assertEquals(2, result.finalStats().getJobStats().getSuccessRecords());

      ArgumentCaptor<List> dataCaptor = ArgumentCaptor.forClass(List.class);
      ArgumentCaptor<Map> contextCaptor = ArgumentCaptor.forClass(Map.class);
      verify(sink).write(dataCaptor.capture(), contextCaptor.capture());
      assertEquals(2, dataCaptor.getValue().size());
      assertEquals(Entity.TABLE, contextCaptor.getValue().get("entityType"));
      assertEquals(Boolean.FALSE, contextCaptor.getValue().get("recreateIndex"));

      verify(listener).onJobStarted(context);
      verify(listener).onEntityTypeStarted(Entity.TABLE, 2);
      verify(listener).onProgressUpdate(any(Stats.class), isNull());
      verify(listener).onJobCompleted(any(Stats.class), anyLong());
    }
  }

  @Test
  void executeMarksCompletedWithErrorsWhenSinkWriteFails() throws Exception {
    BulkSink sink = mock(BulkSink.class);
    ReindexingProgressListener listener = mock(ReindexingProgressListener.class);
    ReindexingJobContext context = mockJobContext();
    EntityRepository entityRepository = mock(EntityRepository.class);
    EntityDAO entityDao = mock(EntityDAO.class);
    EntityInterface entity = mock(EntityInterface.class);
    ResultList<EntityInterface> batch = new ResultList<>(List.of(entity), null, null, 0);

    when(entityRepository.getDao()).thenReturn(entityDao);
    when(entityDao.listCount(any(ListFilter.class))).thenReturn(1);
    when(sink.getPendingVectorTaskCount()).thenReturn(0);
    when(sink.getStats()).thenReturn(new StepStats().withTotalRecords(0).withSuccessRecords(0));
    when(sink.getProcessStats())
        .thenReturn(new StepStats().withTotalRecords(0).withSuccessRecords(0));
    pipeline.addListener(listener);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedConstruction<EntityReader> ignored =
            mockConstruction(
                EntityReader.class,
                (reader, context1) ->
                    doAnswer(
                            invocation -> {
                              EntityReader.BatchCallback callback = invocation.getArgument(4);
                              callback.onBatchRead(Entity.TABLE, batch, 0);
                              return 1;
                            })
                        .when(reader)
                        .readEntity(
                            any(String.class),
                            anyInt(),
                            anyInt(),
                            any(Phaser.class),
                            any(EntityReader.BatchCallback.class),
                            any(),
                            any()))) {
      entityMock.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(entityRepository);
      doAnswer(
              invocation -> {
                throw new IllegalStateException("sink boom");
              })
          .when(sink)
          .write(any(List.class), any(Map.class));

      ExecutionResult result =
          pipeline.execute(
              ReindexingConfiguration.builder()
                  .entities(Set.of(Entity.TABLE))
                  .batchSize(1)
                  .consumerThreads(1)
                  .producerThreads(1)
                  .build(),
              context,
              Set.of(Entity.TABLE),
              sink,
              null,
              null);

      assertEquals(ExecutionResult.Status.COMPLETED_WITH_ERRORS, result.status());
      assertEquals(1, result.finalStats().getJobStats().getTotalRecords());
      assertEquals(0, result.finalStats().getJobStats().getSuccessRecords());

      ArgumentCaptor<IndexingError> errorCaptor = ArgumentCaptor.forClass(IndexingError.class);
      verify(listener).onError(eq(Entity.TABLE), errorCaptor.capture(), any(Stats.class));
      assertEquals(IndexingError.ErrorSource.SINK, errorCaptor.getValue().getErrorSource());
      assertEquals("sink boom", errorCaptor.getValue().getMessage());
      verify(listener).onJobCompletedWithErrors(any(Stats.class), anyLong());
    }
  }

  @Test
  void initializeStatsUsesRepositoryTotalsForRegularAndTimeSeriesEntities() throws Exception {
    EntityRepository entityRepository = mock(EntityRepository.class);
    EntityDAO entityDao = mock(EntityDAO.class);
    EntityTimeSeriesRepository<?> timeSeriesRepository = mock(EntityTimeSeriesRepository.class);
    EntityTimeSeriesDAO timeSeriesDao = mock(EntityTimeSeriesDAO.class);
    String reportType = ReportData.ReportDataType.ENTITY_REPORT_DATA.value();

    when(entityRepository.getDao()).thenReturn(entityDao);
    when(entityDao.listCount(any(ListFilter.class))).thenReturn(7);
    when(timeSeriesRepository.getTimeSeriesDao()).thenReturn(timeSeriesDao);
    when(timeSeriesDao.listCount(any(ListFilter.class), anyLong(), anyLong(), eq(false)))
        .thenReturn(3);
    when(searchRepository.getDataInsightReports()).thenReturn(List.of(reportType));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(entityRepository);
      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      entityMock
          .when(() -> Entity.getEntityTimeSeriesRepository(Entity.ENTITY_REPORT_DATA))
          .thenReturn(timeSeriesRepository);

      Stats stats =
          (Stats)
              invokePrivate(
                  "initializeStats",
                  new Class<?>[] {ReindexingConfiguration.class, Set.class},
                  ReindexingConfiguration.builder()
                      .timeSeriesEntityDays(Map.of(reportType, 1))
                      .build(),
                  Set.of(Entity.TABLE, reportType));

      assertEquals(10, stats.getJobStats().getTotalRecords());
      assertEquals(10, stats.getReaderStats().getTotalRecords());
      assertEquals(
          7, stats.getEntityStats().getAdditionalProperties().get(Entity.TABLE).getTotalRecords());
      assertEquals(
          3, stats.getEntityStats().getAdditionalProperties().get(reportType).getTotalRecords());

      ArgumentCaptor<ListFilter> filterCaptor = ArgumentCaptor.forClass(ListFilter.class);
      verify(timeSeriesDao).listCount(filterCaptor.capture(), anyLong(), anyLong(), eq(false));
      assertEquals(
          FullyQualifiedName.buildHash(reportType),
          filterCaptor.getValue().getQueryParams().get("entityFQNHash"));
    }
  }

  @Test
  void getEntityTotalUsesEntitySpecificTimeSeriesRepositoryWithoutTimeWindow() throws Exception {
    EntityTimeSeriesRepository<?> timeSeriesRepository = mock(EntityTimeSeriesRepository.class);
    EntityTimeSeriesDAO timeSeriesDao = mock(EntityTimeSeriesDAO.class);
    String entityType = ReportData.ReportDataType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA.value();

    when(timeSeriesRepository.getTimeSeriesDao()).thenReturn(timeSeriesDao);
    when(timeSeriesDao.listCount(any(ListFilter.class))).thenReturn(5);
    when(searchRepository.getDataInsightReports()).thenReturn(List.of());

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityTimeSeriesRepository(entityType))
          .thenReturn(timeSeriesRepository);
      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);

      int total =
          (int)
              invokePrivate(
                  "getEntityTotal",
                  new Class<?>[] {String.class, ReindexingConfiguration.class},
                  entityType,
                  null);

      assertEquals(5, total);
      verify(timeSeriesDao).listCount(any(ListFilter.class));
    }
  }

  @Test
  void getEntityTotalReturnsZeroWhenTimeSeriesRepositoryCountFails() throws Exception {
    EntityTimeSeriesRepository<?> timeSeriesRepository = mock(EntityTimeSeriesRepository.class);
    EntityTimeSeriesDAO timeSeriesDao = mock(EntityTimeSeriesDAO.class);
    String entityType = ReportData.ReportDataType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA.value();

    when(timeSeriesRepository.getTimeSeriesDao()).thenReturn(timeSeriesDao);
    when(timeSeriesDao.listCount(any(ListFilter.class)))
        .thenThrow(new IllegalStateException("boom"));
    when(searchRepository.getDataInsightReports()).thenReturn(List.of());

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityTimeSeriesRepository(entityType))
          .thenReturn(timeSeriesRepository);
      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);

      int total =
          (int)
              invokePrivate(
                  "getEntityTotal",
                  new Class<?>[] {String.class, ReindexingConfiguration.class},
                  entityType,
                  null);

      assertEquals(0, total);
    }
  }

  @Test
  void createContextDataAndFinalizeReindexUseRecreateMetadata() throws Exception {
    ReindexContext recreateContext = new ReindexContext();
    recreateContext.add(
        Entity.TABLE,
        "table-canonical",
        "table-original",
        "table-staged",
        Set.of("table-alias"),
        "table-canonical-alias",
        List.of("table-parent"));
    recreateContext.add(
        Entity.USER,
        "user-canonical",
        "user-original",
        "user-staged",
        Set.of("user-alias"),
        "user-canonical-alias",
        List.of("user-parent"));
    RecreateIndexHandler handler = mock(RecreateIndexHandler.class);

    setField("recreateContext", recreateContext);
    setField("recreateIndexHandler", handler);
    getPromotedEntities().add(Entity.TABLE);

    Map<String, Object> contextData =
        (Map<String, Object>)
            invokePrivate("createContextData", new Class<?>[] {String.class}, Entity.TABLE);

    assertEquals(Entity.TABLE, contextData.get("entityType"));
    assertEquals(Boolean.TRUE, contextData.get("recreateIndex"));
    assertSame(recreateContext, contextData.get("recreateContext"));
    assertEquals("table-staged", contextData.get("targetIndex"));

    invokePrivate("finalizeReindex", new Class<?>[0]);

    ArgumentCaptor<EntityReindexContext> contextCaptor =
        ArgumentCaptor.forClass(EntityReindexContext.class);
    verify(handler).finalizeReindex(contextCaptor.capture(), eq(true));
    assertEquals(Entity.USER, contextCaptor.getValue().getEntityType());
    assertEquals("user-canonical", contextCaptor.getValue().getCanonicalIndex());
    assertEquals("user-original", contextCaptor.getValue().getOriginalIndex());
    assertEquals("user-staged", contextCaptor.getValue().getStagedIndex());
    assertTrue(contextCaptor.getValue().getExistingAliases().contains("user-alias"));
    assertTrue(contextCaptor.getValue().getParentAliases().contains("user-parent"));
    assertNull(getField("recreateContext"));
    assertTrue(getPromotedEntities().isEmpty());
  }

  @Test
  void buildResultReturnsStoppedAndNotifiesListeners() throws Exception {
    ReindexingProgressListener listener = mock(ReindexingProgressListener.class);
    pipeline.addListener(listener);
    pipeline.getStats().set(createStats("table", 2));
    getStoppedFlag().set(true);

    ExecutionResult result =
        (ExecutionResult)
            invokePrivate(
                "buildResult", new Class<?>[] {long.class}, System.currentTimeMillis() - 1000);

    assertEquals(ExecutionResult.Status.STOPPED, result.status());
    verify(listener).onJobStopped(any(Stats.class));
  }

  @Test
  void stopFlushesSinkStopsReaderAndShutsExecutorsDown() throws Exception {
    BulkSink sink = mock(BulkSink.class);
    EntityReader reader = mock(EntityReader.class);
    LinkedBlockingQueue queue = new LinkedBlockingQueue();
    ExecutorService producerExecutor = Executors.newSingleThreadExecutor();
    ExecutorService jobExecutor = Executors.newSingleThreadExecutor();
    ExecutorService consumerExecutor = Executors.newSingleThreadExecutor();

    queue.offer("pending-task");
    when(sink.getActiveBulkRequestCount()).thenReturn(2);
    when(sink.flushAndAwait(10)).thenReturn(true);

    setField("searchIndexSink", sink);
    setField("entityReader", reader);
    setField("taskQueue", queue);
    setField("producerExecutor", producerExecutor);
    setField("jobExecutor", jobExecutor);
    setField("consumerExecutor", consumerExecutor);

    pipeline.stop();

    assertTrue(getStoppedFlag().get());
    assertFalse(queue.isEmpty());
    verify(reader).stop();
    verify(sink).flushAndAwait(10);
    assertTrue(producerExecutor.isShutdown());
    assertTrue(jobExecutor.isShutdown());
    assertTrue(consumerExecutor.isShutdown());
  }

  private ReindexingJobContext mockJobContext() {
    ReindexingJobContext context = mock(ReindexingJobContext.class);
    when(context.getJobId()).thenReturn(UUID.fromString("00000000-0000-0000-0000-000000000041"));
    when(context.getJobName()).thenReturn("job");
    when(context.getStartTime()).thenReturn(System.currentTimeMillis());
    when(context.isDistributed()).thenReturn(false);
    when(context.getSource()).thenReturn("TEST");
    return context;
  }

  private Stats createStats(String entityType, int totalRecords) {
    Stats stats = new Stats();
    EntityStats entityStats = new EntityStats();
    entityStats.withAdditionalProperty(
        entityType, new StepStats().withTotalRecords(totalRecords).withSuccessRecords(0));
    stats.setEntityStats(entityStats);
    stats.setJobStats(new StepStats().withTotalRecords(totalRecords).withSuccessRecords(0));
    stats.setReaderStats(new StepStats().withTotalRecords(totalRecords).withSuccessRecords(0));
    stats.setSinkStats(new StepStats().withTotalRecords(0).withSuccessRecords(0));
    stats.setProcessStats(new StepStats().withTotalRecords(0).withSuccessRecords(0));
    return stats;
  }

  private AtomicBoolean getStoppedFlag() throws Exception {
    return (AtomicBoolean) getField("stopped");
  }

  private Set<String> getPromotedEntities() throws Exception {
    return (Set<String>) getField("promotedEntities");
  }

  private Object invokePrivate(String methodName, Class<?>[] parameterTypes, Object... args)
      throws Exception {
    Method method = IndexingPipeline.class.getDeclaredMethod(methodName, parameterTypes);
    method.setAccessible(true);
    return method.invoke(pipeline, args);
  }

  private void setField(String fieldName, Object value) throws Exception {
    Field field = IndexingPipeline.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(pipeline, value);
  }

  private Object getField(String fieldName) throws Exception {
    Field field = IndexingPipeline.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    return field.get(pipeline);
  }
}
