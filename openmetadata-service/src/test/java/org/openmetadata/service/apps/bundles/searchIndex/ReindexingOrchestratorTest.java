package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.apps.scheduler.AppScheduler.ON_DEMAND_JOB;

import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.SuccessContext;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.OrphanedIndexCleaner.CleanupResult;
import org.openmetadata.service.apps.bundles.searchIndex.SearchIndexApp.ReindexingException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.socket.WebSocketManager;

@SuppressWarnings({"rawtypes", "unchecked"})
class ReindexingOrchestratorTest {

  private CollectionDAO collectionDAO;
  private CollectionDAO.AppExtensionTimeSeries appExtensionTimeSeriesDao;
  private CollectionDAO.SearchIndexFailureDAO searchIndexFailureDAO;
  private SearchRepository searchRepository;
  private SearchClient searchClient;
  private OrchestratorContext context;
  private AppRunRecord appRunRecord;
  private ReindexingOrchestrator orchestrator;

  @BeforeEach
  void setUp() {
    collectionDAO = mock(CollectionDAO.class);
    appExtensionTimeSeriesDao = mock(CollectionDAO.AppExtensionTimeSeries.class);
    searchIndexFailureDAO = mock(CollectionDAO.SearchIndexFailureDAO.class);
    searchRepository = mock(SearchRepository.class);
    searchClient = mock(SearchClient.class);
    context = mock(OrchestratorContext.class);
    appRunRecord =
        new AppRunRecord()
            .withAppId(UUID.fromString("00000000-0000-0000-0000-000000000071"))
            .withAppName("SearchIndexingApplication")
            .withStartTime(1234L)
            .withTimestamp(1234L)
            .withStatus(AppRunRecord.Status.RUNNING)
            .withConfig(new HashMap<>());
    when(collectionDAO.appExtensionTimeSeriesDao()).thenReturn(appExtensionTimeSeriesDao);
    when(collectionDAO.searchIndexFailureDAO()).thenReturn(searchIndexFailureDAO);
    when(searchIndexFailureDAO.deleteAll()).thenReturn(0);
    when(searchRepository.getSearchClient()).thenReturn(searchClient);
    when(context.getJobRecord()).thenReturn(appRunRecord);
    when(context.getAppId()).thenReturn(appRunRecord.getAppId());
    orchestrator = new ReindexingOrchestrator(collectionDAO, searchRepository, context);
  }

  @Test
  void runSingleServerPreservesResultMetadataInSuccessContext() {
    EventPublisherJob jobData =
        new EventPublisherJob()
            .withEntities(Set.of(Entity.TABLE))
            .withBatchSize(25)
            .withUseDistributedIndexing(false);
    ReindexingProgressListener progressListener = mock(ReindexingProgressListener.class);
    ReindexingJobContext jobContext = mock(ReindexingJobContext.class);
    EntityRepository entityRepository = mock(EntityRepository.class);
    EntityDAO entityDao = mock(EntityDAO.class);
    Stats stats = createStats(5);

    when(context.getJobName()).thenReturn("scheduled");
    when(context.createProgressListener(jobData)).thenReturn(progressListener);
    when(context.createReindexingContext(false)).thenReturn(jobContext);
    when(searchIndexFailureDAO.countByJobId(appRunRecord.getAppId().toString())).thenReturn(0);
    when(entityRepository.getDao()).thenReturn(entityDao);
    when(entityDao.listCount(any())).thenReturn(5);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<ReindexingMetrics> metricsMock = mockStatic(ReindexingMetrics.class);
        MockedStatic<WebSocketManager> websocketMock = mockStatic(WebSocketManager.class);
        MockedConstruction<OrphanedIndexCleaner> cleanerConstruction = mockOrphanCleaner();
        MockedConstruction<SingleServerIndexingStrategy> strategyConstruction =
            mockConstruction(
                SingleServerIndexingStrategy.class,
                (strategy, context1) -> {
                  when(strategy.execute(any(), any()))
                      .thenReturn(
                          ExecutionResult.builder()
                              .status(ExecutionResult.Status.COMPLETED)
                              .totalRecords(5)
                              .successRecords(5)
                              .failedRecords(0)
                              .startTime(10L)
                              .endTime(20L)
                              .finalStats(stats)
                              .metadata(Map.of("retainedKey", "retainedValue"))
                              .build());
                  when(strategy.getStats()).thenReturn(Optional.of(stats));
                })) {
      metricsMock.when(ReindexingMetrics::getInstance).thenReturn(null);
      websocketMock.when(WebSocketManager::getInstance).thenReturn(null);
      entityMock.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(entityRepository);

      orchestrator.run(jobData);

      SingleServerIndexingStrategy strategy = strategyConstruction.constructed().getFirst();
      verify(strategy, times(2)).addListener(any(ReindexingProgressListener.class));
      verify(strategy).execute(any(ReindexingConfiguration.class), eq(jobContext));
      verify(context).storeRunStats(stats);
      verify(context, times(2)).storeRunRecord(anyString());
      assertEquals(EventPublisherJob.Status.COMPLETED, orchestrator.getJobData().getStatus());
      assertSame(stats, orchestrator.getJobData().getStats());
      assertEquals(
          "retainedValue",
          appRunRecord.getSuccessContext().getAdditionalProperties().get("retainedKey"));
      assertSame(stats, appRunRecord.getSuccessContext().getAdditionalProperties().get("stats"));
      assertTrue(cleanerConstruction.constructed().size() >= 2);
    }
  }

  @Test
  void runLoadsOnDemandConfigAndCompletesWithoutBuildingStrategy() {
    EventPublisherJob jobData = new EventPublisherJob().withEntities(Set.of());

    when(context.getJobName()).thenReturn(ON_DEMAND_JOB);
    when(context.getAppConfigJson()).thenReturn(JsonUtils.pojoToJson(jobData));
    when(searchIndexFailureDAO.countByJobId(appRunRecord.getAppId().toString())).thenReturn(0);

    try (MockedStatic<ReindexingMetrics> metricsMock = mockStatic(ReindexingMetrics.class);
        MockedStatic<WebSocketManager> websocketMock = mockStatic(WebSocketManager.class);
        MockedConstruction<OrphanedIndexCleaner> ignoredCleaner = mockOrphanCleaner();
        MockedConstruction<SingleServerIndexingStrategy> ignoredStrategy =
            mockConstruction(SingleServerIndexingStrategy.class)) {
      metricsMock.when(ReindexingMetrics::getInstance).thenReturn(null);
      websocketMock.when(WebSocketManager::getInstance).thenReturn(null);

      orchestrator.run(null);

      verify(context).updateAppConfiguration(any(Map.class));
      verify(searchRepository).ensureHybridSearchPipeline();
      verify(searchRepository).createOrUpdateIndexTemplates();
      assertEquals(EventPublisherJob.Status.COMPLETED, orchestrator.getJobData().getStatus());
      assertNotNull(orchestrator.getJobData().getStats());
      assertTrue(ignoredStrategy.constructed().isEmpty());
    }
  }

  @Test
  void runContinuesWhenHybridPipelinePreflightFails() {
    EventPublisherJob jobData = new EventPublisherJob().withEntities(Set.of());

    when(context.getJobName()).thenReturn(ON_DEMAND_JOB);
    when(context.getAppConfigJson()).thenReturn(JsonUtils.pojoToJson(jobData));
    when(searchIndexFailureDAO.countByJobId(appRunRecord.getAppId().toString())).thenReturn(0);
    doThrow(new RuntimeException("Pipeline creation failed"))
        .when(searchRepository)
        .ensureHybridSearchPipeline();

    try (MockedStatic<ReindexingMetrics> metricsMock = mockStatic(ReindexingMetrics.class);
        MockedStatic<WebSocketManager> websocketMock = mockStatic(WebSocketManager.class);
        MockedConstruction<OrphanedIndexCleaner> ignoredCleaner = mockOrphanCleaner();
        MockedConstruction<SingleServerIndexingStrategy> ignoredStrategy =
            mockConstruction(SingleServerIndexingStrategy.class)) {
      metricsMock.when(ReindexingMetrics::getInstance).thenReturn(null);
      websocketMock.when(WebSocketManager::getInstance).thenReturn(null);

      orchestrator.run(null);

      verify(searchRepository).ensureHybridSearchPipeline();
      verify(searchRepository).createOrUpdateIndexTemplates();
      assertEquals(EventPublisherJob.Status.COMPLETED, orchestrator.getJobData().getStatus());
      assertTrue(ignoredStrategy.constructed().isEmpty());
    }
  }

  @Test
  void runMarksJobFailedAndCapturesStrategyStatsOnExecutionException() {
    EventPublisherJob jobData =
        new EventPublisherJob()
            .withEntities(Set.of(Entity.TABLE))
            .withUseDistributedIndexing(false);
    ReindexingProgressListener progressListener = mock(ReindexingProgressListener.class);
    ReindexingJobContext jobContext = mock(ReindexingJobContext.class);
    EntityRepository entityRepository = mock(EntityRepository.class);
    EntityDAO entityDao = mock(EntityDAO.class);
    Stats stats = createStats(3);

    when(context.getJobName()).thenReturn("scheduled");
    when(context.createProgressListener(jobData)).thenReturn(progressListener);
    when(context.createReindexingContext(false)).thenReturn(jobContext);
    when(searchIndexFailureDAO.countByJobId(appRunRecord.getAppId().toString())).thenReturn(0);
    when(entityRepository.getDao()).thenReturn(entityDao);
    when(entityDao.listCount(any())).thenReturn(3);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<ReindexingMetrics> metricsMock = mockStatic(ReindexingMetrics.class);
        MockedStatic<WebSocketManager> websocketMock = mockStatic(WebSocketManager.class);
        MockedConstruction<OrphanedIndexCleaner> ignoredCleaner = mockOrphanCleaner();
        MockedConstruction<SingleServerIndexingStrategy> ignoredStrategy =
            mockConstruction(
                SingleServerIndexingStrategy.class,
                (strategy, context1) -> {
                  when(strategy.execute(any(), any())).thenThrow(new RuntimeException("boom"));
                  when(strategy.getStats()).thenReturn(Optional.of(stats));
                })) {
      metricsMock.when(ReindexingMetrics::getInstance).thenReturn(null);
      websocketMock.when(WebSocketManager::getInstance).thenReturn(null);
      entityMock.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(entityRepository);

      orchestrator.run(jobData);

      assertEquals(EventPublisherJob.Status.FAILED, orchestrator.getJobData().getStatus());
      assertSame(stats, orchestrator.getJobData().getStats());
      assertEquals(
          IndexingError.ErrorSource.JOB, orchestrator.getJobData().getFailure().getErrorSource());
      assertEquals(
          "Reindexing Job Exception: boom", orchestrator.getJobData().getFailure().getMessage());
      assertNotNull(appRunRecord.getFailureContext());
    }
  }

  @Test
  void stopStopsActiveStrategyAndPushesStoppedStatus() throws Exception {
    IndexingStrategy strategy = mock(IndexingStrategy.class);
    EventPublisherJob jobData =
        new EventPublisherJob()
            .withEntities(Set.of(Entity.TABLE))
            .withStatus(EventPublisherJob.Status.ACTIVE);

    setField("activeStrategy", strategy);
    setField("jobData", jobData);

    orchestrator.stop();

    verify(strategy).stop();
    verify(context).storeRunRecord(anyString());
    verify(context).pushStatusUpdate(appRunRecord, true);
    assertEquals(EventPublisherJob.Status.STOPPED, jobData.getStatus());
    assertEquals(AppRunRecord.Status.STOPPED, appRunRecord.getStatus());
    assertNotNull(appRunRecord.getEndTime());
  }

  @Test
  void setupEntitiesExpandsAllAndCountTotalEntitiesSkipsUnsupportedTypes() throws Exception {
    EventPublisherJob jobData = new EventPublisherJob().withEntities(Set.of("all", Entity.TABLE));
    EntityRepository entityRepository = mock(EntityRepository.class);
    EntityDAO entityDao = mock(EntityDAO.class);
    String reportType =
        org.openmetadata.schema.analytics.ReportData.ReportDataType.ENTITY_REPORT_DATA.value();

    when(searchRepository.getEntityIndexMap())
        .thenReturn(
            Map.of(Entity.TABLE, mock(IndexMapping.class), reportType, mock(IndexMapping.class)));
    when(entityRepository.getDao()).thenReturn(entityDao);
    when(entityDao.listCount(any())).thenReturn(7);

    setField("jobData", jobData);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getEntityList).thenReturn(Set.of(Entity.TABLE, Entity.USER));
      entityMock.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(entityRepository);

      invokePrivate("setupEntities", new Class<?>[0]);
      long total = (Long) invokePrivate("countTotalEntities", new Class<?>[0]);

      assertTrue(jobData.getEntities().contains(Entity.TABLE));
      assertTrue(jobData.getEntities().contains(reportType));
      assertFalse(jobData.getEntities().contains(Entity.USER));
      assertEquals(7L, total);
    }
  }

  @Test
  void runAddsSlackListenerUsingInstanceUrlFromSettings() {
    EventPublisherJob jobData =
        new EventPublisherJob()
            .withEntities(Set.of(Entity.TABLE))
            .withSlackBotToken("token")
            .withSlackChannel("#alerts")
            .withUseDistributedIndexing(false);
    ReindexingProgressListener progressListener = mock(ReindexingProgressListener.class);
    ReindexingJobContext jobContext = mock(ReindexingJobContext.class);
    EntityRepository entityRepository = mock(EntityRepository.class);
    EntityDAO entityDao = mock(EntityDAO.class);
    SystemRepository systemRepository = mock(SystemRepository.class);
    Stats stats = createStats(2);

    when(context.getJobName()).thenReturn("scheduled");
    when(context.createProgressListener(jobData)).thenReturn(progressListener);
    when(context.createReindexingContext(false)).thenReturn(jobContext);
    when(searchIndexFailureDAO.countByJobId(appRunRecord.getAppId().toString())).thenReturn(0);
    when(entityRepository.getDao()).thenReturn(entityDao);
    when(entityDao.listCount(any())).thenReturn(2);
    when(systemRepository.getOMBaseUrlConfigInternal())
        .thenReturn(
            new Settings()
                .withConfigValue(
                    new OpenMetadataBaseUrlConfiguration().withOpenMetadataUrl("http://instance")));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<ReindexingMetrics> metricsMock = mockStatic(ReindexingMetrics.class);
        MockedStatic<WebSocketManager> websocketMock = mockStatic(WebSocketManager.class);
        MockedConstruction<OrphanedIndexCleaner> ignoredCleaner = mockOrphanCleaner();
        MockedConstruction<SingleServerIndexingStrategy> strategyConstruction =
            mockConstruction(
                SingleServerIndexingStrategy.class,
                (strategy, context1) ->
                    when(strategy.execute(any(), any()))
                        .thenReturn(
                            ExecutionResult.builder()
                                .status(ExecutionResult.Status.COMPLETED)
                                .totalRecords(2)
                                .successRecords(2)
                                .failedRecords(0)
                                .startTime(1L)
                                .endTime(2L)
                                .finalStats(stats)
                                .metadata(Map.of())
                                .build()))) {
      metricsMock.when(ReindexingMetrics::getInstance).thenReturn(null);
      websocketMock.when(WebSocketManager::getInstance).thenReturn(null);
      entityMock.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(entityRepository);
      entityMock.when(Entity::getSystemRepository).thenReturn(systemRepository);

      orchestrator.run(jobData);

      SingleServerIndexingStrategy strategy = strategyConstruction.constructed().getFirst();
      verify(strategy, times(3)).addListener(any(ReindexingProgressListener.class));
      verify(context, never()).updateAppConfiguration(any(Map.class));
    }
  }

  @Test
  void loadJobDataReadsFromAppConfigurationAndThrowsWhenMissing() throws Exception {
    EventPublisherJob jobData =
        new EventPublisherJob().withEntities(Set.of(Entity.TABLE)).withBatchSize(11);

    when(context.getAppConfigJson()).thenReturn(null);
    when(context.getAppConfiguration()).thenReturn(JsonUtils.convertValue(jobData, Map.class));

    EventPublisherJob loaded = (EventPublisherJob) invokePrivate("loadJobData", new Class<?>[0]);

    assertEquals(Set.of(Entity.TABLE), loaded.getEntities());
    assertEquals(11, loaded.getBatchSize());

    when(context.getAppConfiguration()).thenReturn(null);

    InvocationTargetException thrown =
        assertThrows(
            InvocationTargetException.class, () -> invokePrivate("loadJobData", new Class<?>[0]));
    assertInstanceOf(ReindexingException.class, thrown.getCause());
  }

  @Test
  void updateRecordToDbAndNotifyPreservesExistingSuccessContextAndBroadcasts() throws Exception {
    WebSocketManager webSocketManager = mock(WebSocketManager.class);
    EventPublisherJob jobData =
        new EventPublisherJob()
            .withEntities(Set.of(Entity.TABLE))
            .withStatus(EventPublisherJob.Status.FAILED)
            .withStats(createStats(2))
            .withFailure(new IndexingError().withMessage("failed"));
    Map<String, Object> serverStats = Map.of("server-1", Map.of("success", 2));

    appRunRecord.setSuccessContext(new SuccessContext().withAdditionalProperty("existing", "keep"));
    when(searchIndexFailureDAO.countByJobId("job-123")).thenReturn(4);
    setField("jobData", jobData);
    setField(
        "resultMetadata",
        new HashMap<>(
            Map.of("distributedJobId", "job-123", "serverStats", serverStats, "serverCount", 1)));

    try (MockedStatic<WebSocketManager> websocketMock = mockStatic(WebSocketManager.class)) {
      websocketMock.when(WebSocketManager::getInstance).thenReturn(webSocketManager);

      invokePrivate("updateRecordToDbAndNotify", new Class<?>[0]);

      assertEquals(AppRunRecord.Status.FAILED, appRunRecord.getStatus());
      assertEquals(
          "keep", appRunRecord.getSuccessContext().getAdditionalProperties().get("existing"));
      assertSame(
          jobData.getStats(),
          appRunRecord.getSuccessContext().getAdditionalProperties().get("stats"));
      assertEquals(
          4, appRunRecord.getSuccessContext().getAdditionalProperties().get("failureRecordCount"));
      assertSame(
          serverStats,
          appRunRecord.getSuccessContext().getAdditionalProperties().get("serverStats"));
      assertEquals(
          "job-123",
          appRunRecord.getSuccessContext().getAdditionalProperties().get("distributedJobId"));
      assertNotNull(appRunRecord.getFailureContext());
      verify(webSocketManager).broadCastMessageToAll(anyString(), anyString());
    }
  }

  @Test
  void finalizeJobExecutionStoresStoppedRecordAndCleanupHelpersHandlePositiveResults()
      throws Exception {
    EventPublisherJob jobData =
        new EventPublisherJob()
            .withEntities(Set.of(Entity.TABLE))
            .withStatus(EventPublisherJob.Status.STOPPED);
    setField("jobData", jobData);
    setField("stopped", true);

    try (MockedStatic<WebSocketManager> websocketMock = mockStatic(WebSocketManager.class);
        MockedConstruction<OrphanedIndexCleaner> cleanerConstruction =
            mockConstruction(
                OrphanedIndexCleaner.class,
                (cleaner, context1) ->
                    when(cleaner.cleanupOrphanedIndices(any(SearchClient.class)))
                        .thenReturn(new CleanupResult(3, 2, 1, List.of("idx-a", "idx-b"))))) {
      websocketMock.when(WebSocketManager::getInstance).thenReturn(null);

      invokePrivate("cleanupOrphanedIndicesPreFlight", new Class<?>[0]);
      invokePrivate("cleanupOrphanedIndices", new Class<?>[0]);
      invokePrivate("finalizeJobExecution", new Class<?>[0]);

      assertEquals(2, cleanerConstruction.constructed().size());
      verify(context).storeRunRecord(anyString());
      assertEquals(AppRunRecord.Status.STOPPED, appRunRecord.getStatus());
    }
  }

  @Test
  void getInstanceUrlFallsBackToLocalhostWhenSettingsUnavailable() throws Exception {
    SystemRepository systemRepository = mock(SystemRepository.class);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getSystemRepository).thenReturn(systemRepository);
      when(systemRepository.getOMBaseUrlConfigInternal())
          .thenThrow(new RuntimeException("missing"));

      assertEquals("http://localhost:8585", invokePrivate("getInstanceUrl", new Class<?>[0]));
    }
  }

  private MockedConstruction<OrphanedIndexCleaner> mockOrphanCleaner() {
    return mockConstruction(
        OrphanedIndexCleaner.class,
        (cleaner, context1) ->
            when(cleaner.cleanupOrphanedIndices(any(SearchClient.class)))
                .thenReturn(new CleanupResult(0, 0, 0, List.of())));
  }

  private Stats createStats(int totalRecords) {
    Stats stats = new Stats();
    stats.setJobStats(
        new StepStats().withTotalRecords(totalRecords).withSuccessRecords(totalRecords));
    stats.setReaderStats(
        new StepStats().withTotalRecords(totalRecords).withSuccessRecords(totalRecords));
    stats.setSinkStats(
        new StepStats().withTotalRecords(totalRecords).withSuccessRecords(totalRecords));
    return stats;
  }

  private Object invokePrivate(String methodName, Class<?>[] parameterTypes, Object... args)
      throws Exception {
    Method method = ReindexingOrchestrator.class.getDeclaredMethod(methodName, parameterTypes);
    method.setAccessible(true);
    return method.invoke(orchestrator, args);
  }

  private void setField(String fieldName, Object value) throws Exception {
    Field field = ReindexingOrchestrator.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(orchestrator, value);
  }
}
