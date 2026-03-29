package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.DistributedSearchIndexExecutor;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.EntityCompletionTracker;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.IndexJobStatus;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.SearchIndexJob;
import org.openmetadata.service.jdbi3.CollectionDAO;
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

class DistributedIndexingStrategyTest {

  private static final UUID APP_ID = UUID.fromString("00000000-0000-0000-0000-000000000011");

  private CollectionDAO collectionDAO;
  private SearchRepository searchRepository;
  private DistributedIndexingStrategy strategy;

  @BeforeEach
  void setUp() {
    collectionDAO = mock(CollectionDAO.class);
    searchRepository = mock(SearchRepository.class);
    strategy =
        new DistributedIndexingStrategy(
            collectionDAO, searchRepository, new EventPublisherJob(), APP_ID, 1234L, "admin");
  }

  @Test
  void lifecycleHelpersExposeInjectedStateAndStopDelegatesOnce() throws Exception {
    ReindexingProgressListener listener = mock(ReindexingProgressListener.class);
    DistributedSearchIndexExecutor executor = mock(DistributedSearchIndexExecutor.class);

    strategy.addListener(listener);

    assertTrue(strategy.getStats().isEmpty());
    assertFalse(strategy.isStopped());
    assertNull(strategy.getDistributedExecutor());
    assertEquals(1, ((CompositeProgressListener) getField("listeners")).getListenerCount());

    setField("distributedExecutor", executor);
    strategy.stop();
    strategy.stop();

    assertTrue(strategy.isStopped());
    assertNotNull(strategy.getStats());
    assertEquals(executor, strategy.getDistributedExecutor());
    verify(executor, times(1)).stop();
  }

  @Test
  @SuppressWarnings({"rawtypes", "unchecked"})
  void initializeTotalRecordsBuildsTotalsForRegularAndTimeSeriesEntities() {
    EntityRepository entityRepository = mock(EntityRepository.class);
    EntityDAO entityDao = mock(EntityDAO.class);
    @SuppressWarnings("unchecked")
    EntityTimeSeriesRepository<?> timeSeriesRepository = mock(EntityTimeSeriesRepository.class);
    EntityTimeSeriesDAO timeSeriesDao = mock(EntityTimeSeriesDAO.class);
    String reportDataType = ReportData.ReportDataType.ENTITY_REPORT_DATA.value();

    when(entityRepository.getDao()).thenReturn(entityDao);
    when(entityDao.listCount(any(ListFilter.class))).thenReturn(7);
    when(timeSeriesRepository.getTimeSeriesDao()).thenReturn(timeSeriesDao);
    when(timeSeriesDao.listCount(any(ListFilter.class))).thenReturn(3);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(entityRepository);
      entityMock
          .when(() -> Entity.getEntityTimeSeriesRepository(Entity.ENTITY_REPORT_DATA))
          .thenReturn(timeSeriesRepository);

      Stats stats = strategy.initializeTotalRecords(Set.of(Entity.TABLE, reportDataType));

      assertEquals(10, stats.getJobStats().getTotalRecords());
      assertEquals(10, stats.getReaderStats().getTotalRecords());
      assertEquals(0, stats.getJobStats().getSuccessRecords());
      assertEquals(0, stats.getSinkStats().getSuccessRecords());
      assertEquals(
          7, stats.getEntityStats().getAdditionalProperties().get(Entity.TABLE).getTotalRecords());
      assertEquals(
          3,
          stats.getEntityStats().getAdditionalProperties().get(reportDataType).getTotalRecords());

      ArgumentCaptor<ListFilter> filterCaptor = ArgumentCaptor.forClass(ListFilter.class);
      verify(timeSeriesDao).listCount(filterCaptor.capture());
      assertEquals(
          FullyQualifiedName.buildHash(reportDataType),
          filterCaptor.getValue().getQueryParams().get("entityFQNHash"));
    }
  }

  @Test
  void getEntityTotalUsesConfiguredTimeSeriesWindowAndReturnsZeroOnLookupErrors() throws Exception {
    @SuppressWarnings("unchecked")
    EntityTimeSeriesRepository<?> timeSeriesRepository = mock(EntityTimeSeriesRepository.class);
    EntityTimeSeriesDAO timeSeriesDao = mock(EntityTimeSeriesDAO.class);
    String reportDataType = ReportData.ReportDataType.ENTITY_REPORT_DATA.value();

    when(timeSeriesRepository.getTimeSeriesDao()).thenReturn(timeSeriesDao);
    when(timeSeriesDao.listCount(any(ListFilter.class), anyLong(), anyLong(), eq(false)))
        .thenReturn(4);

    setField(
        "config",
        ReindexingConfiguration.builder().timeSeriesEntityDays(Map.of(reportDataType, 1)).build());

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityTimeSeriesRepository(Entity.ENTITY_REPORT_DATA))
          .thenReturn(timeSeriesRepository);

      int total =
          (Integer) invokePrivate("getEntityTotal", new Class<?>[] {String.class}, reportDataType);

      assertEquals(4, total);

      @SuppressWarnings("unchecked")
      ArgumentCaptor<ListFilter> filterCaptor = ArgumentCaptor.forClass(ListFilter.class);
      ArgumentCaptor<Long> startCaptor = ArgumentCaptor.forClass(Long.class);
      ArgumentCaptor<Long> endCaptor = ArgumentCaptor.forClass(Long.class);
      verify(timeSeriesDao)
          .listCount(filterCaptor.capture(), startCaptor.capture(), endCaptor.capture(), eq(false));
      assertEquals(
          FullyQualifiedName.buildHash(reportDataType),
          filterCaptor.getValue().getQueryParams().get("entityFQNHash"));
      assertTrue(startCaptor.getValue() > 0);
      assertTrue(endCaptor.getValue() >= startCaptor.getValue());
    }

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.TABLE))
          .thenThrow(new RuntimeException("db unavailable"));

      assertEquals(0, invokePrivate("getEntityTotal", new Class<?>[] {String.class}, Entity.TABLE));
    }
  }

  @Test
  void updateStatsFromDistributedJobPrefersAggregatedServerStats() throws Exception {
    CollectionDAO.SearchIndexServerStatsDAO serverStatsDao =
        mock(CollectionDAO.SearchIndexServerStatsDAO.class);
    UUID jobId = UUID.fromString("00000000-0000-0000-0000-000000000021");
    Stats stats = createBaseStats("table", 20);
    SearchIndexJob distributedJob =
        SearchIndexJob.builder()
            .id(jobId)
            .totalRecords(20)
            .successRecords(14)
            .failedRecords(6)
            .entityStats(
                Map.of(
                    "table",
                    SearchIndexJob.EntityTypeStats.builder()
                        .entityType("table")
                        .totalRecords(20)
                        .successRecords(17)
                        .failedRecords(3)
                        .build()))
            .build();

    when(collectionDAO.searchIndexServerStatsDAO()).thenReturn(serverStatsDao);
    when(serverStatsDao.getAggregatedStats(jobId.toString()))
        .thenReturn(
            new CollectionDAO.SearchIndexServerStatsDAO.AggregatedServerStats(
                18, 1, 1, 15, 2, 14, 3, 5, 1, 2, 1));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);

      invokePrivate(
          "updateStatsFromDistributedJob",
          new Class<?>[] {Stats.class, SearchIndexJob.class, StepStats.class},
          stats,
          distributedJob,
          new StepStats().withSuccessRecords(8).withFailedRecords(2));
    }

    assertEquals(15, stats.getJobStats().getSuccessRecords());
    assertEquals(6, stats.getJobStats().getFailedRecords());
    assertEquals(20, stats.getReaderStats().getTotalRecords());
    assertEquals(18, stats.getReaderStats().getSuccessRecords());
    assertEquals(1, stats.getReaderStats().getFailedRecords());
    assertEquals(1, stats.getReaderStats().getWarningRecords());
    assertEquals(17, stats.getProcessStats().getTotalRecords());
    assertEquals(14, stats.getProcessStats().getSuccessRecords());
    assertEquals(3, stats.getProcessStats().getFailedRecords());
    assertEquals(17, stats.getSinkStats().getTotalRecords());
    assertEquals(15, stats.getSinkStats().getSuccessRecords());
    assertEquals(2, stats.getSinkStats().getFailedRecords());
    assertEquals(6, stats.getVectorStats().getTotalRecords());
    assertEquals(5, stats.getVectorStats().getSuccessRecords());
    assertEquals(1, stats.getVectorStats().getFailedRecords());
    assertEquals(
        17, stats.getEntityStats().getAdditionalProperties().get("table").getSuccessRecords());
    assertEquals(
        3, stats.getEntityStats().getAdditionalProperties().get("table").getFailedRecords());
  }

  @Test
  void updateStatsFromDistributedJobFallsBackToLocalSinkAndPartitionStats() throws Exception {
    CollectionDAO.SearchIndexServerStatsDAO serverStatsDao =
        mock(CollectionDAO.SearchIndexServerStatsDAO.class);
    UUID jobId = UUID.fromString("00000000-0000-0000-0000-000000000022");
    SearchIndexJob distributedJob =
        SearchIndexJob.builder()
            .id(jobId)
            .totalRecords(10)
            .successRecords(6)
            .failedRecords(4)
            .entityStats(
                Map.of(
                    "table",
                    SearchIndexJob.EntityTypeStats.builder()
                        .entityType("table")
                        .totalRecords(10)
                        .successRecords(6)
                        .failedRecords(4)
                        .build()))
            .build();

    when(collectionDAO.searchIndexServerStatsDAO()).thenReturn(serverStatsDao);
    when(serverStatsDao.getAggregatedStats(jobId.toString())).thenReturn(null);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);

      Stats withLocalSink = createBaseStats("table", 10);
      invokePrivate(
          "updateStatsFromDistributedJob",
          new Class<?>[] {Stats.class, SearchIndexJob.class, StepStats.class},
          withLocalSink,
          distributedJob,
          new StepStats().withSuccessRecords(8).withFailedRecords(2));

      assertEquals(8, withLocalSink.getJobStats().getSuccessRecords());
      assertEquals(2, withLocalSink.getJobStats().getFailedRecords());
      assertEquals(10, withLocalSink.getReaderStats().getSuccessRecords());
      assertEquals(10, withLocalSink.getSinkStats().getTotalRecords());

      Stats withPartitionStats = createBaseStats("table", 10);
      invokePrivate(
          "updateStatsFromDistributedJob",
          new Class<?>[] {Stats.class, SearchIndexJob.class, StepStats.class},
          withPartitionStats,
          distributedJob,
          null);

      assertEquals(6, withPartitionStats.getJobStats().getSuccessRecords());
      assertEquals(4, withPartitionStats.getJobStats().getFailedRecords());
      assertEquals(10, withPartitionStats.getSinkStats().getTotalRecords());
      assertEquals(
          6,
          withPartitionStats
              .getEntityStats()
              .getAdditionalProperties()
              .get("table")
              .getSuccessRecords());
    }
  }

  @Test
  void statusHelpersReportStoppedIncompleteAndCompleteJobs() throws Exception {
    Stats complete = createBaseStats("table", 10);
    complete.getJobStats().setTotalRecords(10);
    complete.getJobStats().setSuccessRecords(10);
    complete.getJobStats().setFailedRecords(0);

    assertEquals(
        ExecutionResult.Status.COMPLETED,
        invokePrivate("determineStatus", new Class<?>[] {Stats.class}, complete));
    assertFalse(
        (Boolean) invokePrivate("hasIncompleteProcessing", new Class<?>[] {Stats.class}, complete));

    Stats incomplete = createBaseStats("table", 10);
    incomplete.getJobStats().setTotalRecords(10);
    incomplete.getJobStats().setSuccessRecords(9);
    incomplete.getJobStats().setFailedRecords(0);

    assertEquals(
        ExecutionResult.Status.COMPLETED_WITH_ERRORS,
        invokePrivate("determineStatus", new Class<?>[] {Stats.class}, incomplete));
    assertTrue(
        (Boolean)
            invokePrivate("hasIncompleteProcessing", new Class<?>[] {Stats.class}, incomplete));

    strategy.stop();
    assertEquals(
        ExecutionResult.Status.STOPPED,
        invokePrivate("determineStatus", new Class<?>[] {Stats.class}, complete));
  }

  @Test
  void finalizeAllEntityReindexSkipsPromotedEntitiesAndUsesPerEntitySuccess() throws Exception {
    DistributedSearchIndexExecutor executor = mock(DistributedSearchIndexExecutor.class);
    EntityCompletionTracker tracker = mock(EntityCompletionTracker.class);
    RecreateIndexHandler recreateIndexHandler = mock(RecreateIndexHandler.class);
    ReindexContext recreateContext = new ReindexContext();
    recreateContext.add(
        "table", "table_index", "table_original", "table_staged", Set.of(), "table", List.of());
    recreateContext.add(
        "user",
        "user_index",
        "user_original",
        "user_staged",
        Set.of("user"),
        "user",
        List.of("parent"));
    recreateContext.add(
        "dashboard",
        "dash_index",
        "dash_original",
        "dash_staged",
        Set.of(),
        "dashboard",
        List.of());

    when(tracker.getPromotedEntities()).thenReturn(Set.of("table"));
    when(executor.getEntityTracker()).thenReturn(tracker);
    when(executor.getJobWithFreshStats())
        .thenReturn(
            SearchIndexJob.builder()
                .entityStats(
                    Map.of(
                        "dashboard",
                        SearchIndexJob.EntityTypeStats.builder()
                            .entityType("dashboard")
                            .totalRecords(5)
                            .successRecords(4)
                            .failedRecords(1)
                            .build()))
                .build());
    setField("distributedExecutor", executor);

    boolean result =
        (Boolean)
            invokePrivate(
                "finalizeAllEntityReindex",
                new Class<?>[] {RecreateIndexHandler.class, ReindexContext.class, boolean.class},
                recreateIndexHandler,
                recreateContext,
                true);

    assertTrue(result);

    ArgumentCaptor<EntityReindexContext> contextCaptor =
        ArgumentCaptor.forClass(EntityReindexContext.class);
    ArgumentCaptor<Boolean> successCaptor = ArgumentCaptor.forClass(Boolean.class);
    verify(recreateIndexHandler, times(2))
        .finalizeReindex(contextCaptor.capture(), successCaptor.capture());

    Map<String, Boolean> outcomes = new java.util.HashMap<>();
    for (int i = 0; i < contextCaptor.getAllValues().size(); i++) {
      outcomes.put(
          contextCaptor.getAllValues().get(i).getEntityType(), successCaptor.getAllValues().get(i));
    }

    assertEquals(Boolean.TRUE, outcomes.get("user"));
    assertEquals(Boolean.FALSE, outcomes.get("dashboard"));
  }

  @Test
  void flushAndAwaitSinkWaitsForVectorsFlushesAndCloses() throws Exception {
    BulkSink bulkSink = mock(BulkSink.class);
    when(bulkSink.getPendingVectorTaskCount()).thenReturn(2);
    when(bulkSink.awaitVectorCompletion(120)).thenReturn(false);
    when(bulkSink.flushAndAwait(60)).thenReturn(false);

    setField("searchIndexSink", bulkSink);

    invokePrivate("flushAndAwaitSink", new Class<?>[0]);

    verify(bulkSink).awaitVectorCompletion(120);
    verify(bulkSink).flushAndAwait(60);
    verify(bulkSink).close();
  }

  @Test
  @SuppressWarnings({"rawtypes", "unchecked"})
  void executeReturnsCompletedResultForSuccessfulSinglePassDistributedRun() {
    EntityRepository entityRepository = mock(EntityRepository.class);
    EntityDAO entityDao = mock(EntityDAO.class);
    BulkSink bulkSink = mock(BulkSink.class);
    CollectionDAO.SearchIndexServerStatsDAO serverStatsDao =
        mock(CollectionDAO.SearchIndexServerStatsDAO.class);
    UUID jobId = UUID.fromString("00000000-0000-0000-0000-000000000031");
    SearchIndexJob completedJob =
        SearchIndexJob.builder()
            .id(jobId)
            .status(IndexJobStatus.COMPLETED)
            .totalRecords(5)
            .successRecords(5)
            .failedRecords(0)
            .entityStats(
                Map.of(
                    Entity.TABLE,
                    SearchIndexJob.EntityTypeStats.builder()
                        .entityType(Entity.TABLE)
                        .totalRecords(5)
                        .successRecords(5)
                        .failedRecords(0)
                        .build()))
            .serverStats(
                Map.of(
                    "server-1",
                    SearchIndexJob.ServerStats.builder()
                        .serverId("server-1")
                        .successRecords(5)
                        .failedRecords(0)
                        .build()))
            .build();
    RecreateIndexHandler recreateIndexHandler = mock(RecreateIndexHandler.class);

    when(entityRepository.getDao()).thenReturn(entityDao);
    when(entityDao.listCount(any(ListFilter.class))).thenReturn(5);
    when(searchRepository.createBulkSink(anyInt(), anyInt(), anyLong())).thenReturn(bulkSink);
    when(searchRepository.createReindexHandler()).thenReturn(recreateIndexHandler);
    when(bulkSink.getPendingVectorTaskCount()).thenReturn(0);
    when(bulkSink.flushAndAwait(60)).thenReturn(true);
    when(bulkSink.getStats())
        .thenReturn(new StepStats().withSuccessRecords(5).withFailedRecords(0));
    when(bulkSink.getVectorStats()).thenReturn(new StepStats().withTotalRecords(0));
    when(collectionDAO.searchIndexServerStatsDAO()).thenReturn(serverStatsDao);
    when(serverStatsDao.getAggregatedStats(jobId.toString())).thenReturn(null);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedConstruction<DistributedSearchIndexExecutor> executorConstruction =
            mockConstruction(
                DistributedSearchIndexExecutor.class,
                (mock, context) -> {
                  when(mock.createJob(
                          any(Set.class), any(EventPublisherJob.class), eq("admin"), any()))
                      .thenReturn(completedJob);
                  when(mock.getJobWithFreshStats()).thenReturn(completedJob);
                })) {
      entityMock.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(entityRepository);
      entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);

      ExecutionResult result =
          strategy.execute(
              ReindexingConfiguration.builder()
                  .entities(Set.of(Entity.TABLE))
                  .batchSize(25)
                  .maxConcurrentRequests(3)
                  .payloadSize(1024L)
                  .build(),
              context(jobId));

      assertEquals(ExecutionResult.Status.COMPLETED, result.status());
      assertEquals(5, result.totalRecords());
      assertEquals(5, result.successRecords());
      assertEquals(0, result.failedRecords());
      assertEquals(1, result.metadata().get("serverCount"));
      assertEquals(jobId.toString(), result.metadata().get("distributedJobId"));

      DistributedSearchIndexExecutor constructed = executorConstruction.constructed().getFirst();
      verify(constructed).performStartupRecovery();
      verify(constructed).setAppContext(APP_ID, 1234L);
      verify(constructed)
          .execute(
              bulkSink,
              null,
              false,
              ReindexingConfiguration.builder()
                  .entities(Set.of(Entity.TABLE))
                  .batchSize(25)
                  .maxConcurrentRequests(3)
                  .payloadSize(1024L)
                  .build());
    }
  }

  @Test
  @SuppressWarnings({"rawtypes", "unchecked"})
  void executeReturnsFailedResultWhenDistributedExecutorStartupFails() {
    EntityRepository entityRepository = mock(EntityRepository.class);
    EntityDAO entityDao = mock(EntityDAO.class);

    when(entityRepository.getDao()).thenReturn(entityDao);
    when(entityDao.listCount(any(ListFilter.class))).thenReturn(5);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedConstruction<DistributedSearchIndexExecutor> executorConstruction =
            mockConstruction(
                DistributedSearchIndexExecutor.class,
                (mock, context) -> {
                  org.mockito.Mockito.doThrow(new RuntimeException("startup failed"))
                      .when(mock)
                      .performStartupRecovery();
                })) {
      entityMock.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(entityRepository);

      ExecutionResult result =
          strategy.execute(
              ReindexingConfiguration.builder().entities(Set.of(Entity.TABLE)).build(),
              context(APP_ID));

      assertEquals(ExecutionResult.Status.FAILED, result.status());
      assertEquals(5, result.totalRecords());
      assertNotNull(result.finalStats());
      assertEquals(1, executorConstruction.constructed().size());
    }
  }

  private Stats createBaseStats(String entityType, int totalRecords) {
    Stats stats = new Stats();
    stats.setEntityStats(
        new org.openmetadata.schema.system.EntityStats()
            .withAdditionalProperty(entityType, new StepStats().withTotalRecords(totalRecords)));
    stats.setJobStats(new StepStats().withTotalRecords(totalRecords));
    stats.setReaderStats(new StepStats().withTotalRecords(totalRecords));
    stats.setProcessStats(new StepStats());
    stats.setSinkStats(new StepStats());
    stats.setVectorStats(new StepStats());
    return stats;
  }

  private Object invokePrivate(String methodName, Class<?>[] parameterTypes, Object... args)
      throws Exception {
    Method method = DistributedIndexingStrategy.class.getDeclaredMethod(methodName, parameterTypes);
    method.setAccessible(true);
    return method.invoke(strategy, args);
  }

  private void setField(String fieldName, Object value) throws Exception {
    Field field = DistributedIndexingStrategy.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(strategy, value);
  }

  private Object getField(String fieldName) throws Exception {
    Field field = DistributedIndexingStrategy.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    return field.get(strategy);
  }

  private ReindexingJobContext context(UUID jobId) {
    return new ReindexingJobContext() {
      @Override
      public UUID getJobId() {
        return jobId;
      }

      @Override
      public String getJobName() {
        return "distributed-test";
      }

      @Override
      public Long getStartTime() {
        return 1234L;
      }

      @Override
      public UUID getAppId() {
        return APP_ID;
      }

      @Override
      public boolean isDistributed() {
        return true;
      }

      @Override
      public String getSource() {
        return "UNIT_TEST";
      }
    };
  }
}
