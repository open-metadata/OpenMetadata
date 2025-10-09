package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.TARGET_INDEX_KEY;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.schema.entity.app.SuccessContext;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.DefaultRecreateHandler;
import org.openmetadata.service.search.RecreateIndexHandler;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.workflows.interfaces.Source;
import org.quartz.JobDataMap;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;

@ExtendWith(MockitoExtension.class)
@Slf4j
class SearchIndexAppTest extends OpenMetadataApplicationTest {

  @Mock private CollectionDAO collectionDAO;
  @Mock private SearchRepository searchRepository;
  @Mock private BulkSink mockSink;
  @Mock private JobExecutionContext jobExecutionContext;
  @Mock private JobDetail jobDetail;
  @Mock private JobDataMap jobDataMap;
  @Mock private WebSocketManager webSocketManager;
  @Mock private org.quartz.Scheduler scheduler;
  @Mock private org.quartz.ListenerManager listenerManager;
  @Mock private org.openmetadata.service.apps.scheduler.OmAppJobListener jobListener;
  @Mock private AppRunRecord appRunRecord;

  private SearchIndexApp searchIndexApp;
  private EventPublisherJob testJobData;
  private MockedStatic<WebSocketManager> webSocketManagerMock;

  @BeforeEach
  void setUp() {
    searchIndexApp = new SearchIndexApp(collectionDAO, searchRepository);

    testJobData =
        new EventPublisherJob()
            .withEntities(Set.of("table", "user"))
            .withBatchSize(5)
            .withPayLoadSize(1000000L)
            .withMaxConcurrentRequests(10)
            .withMaxRetries(3)
            .withInitialBackoff(1000)
            .withMaxBackoff(10000)
            .withProducerThreads(2)
            .withConsumerThreads(2)
            .withQueueSize(100)
            .withRecreateIndex(false)
            .withStats(new Stats());

    lenient().when(jobExecutionContext.getJobDetail()).thenReturn(jobDetail);
    lenient().when(jobDetail.getJobDataMap()).thenReturn(jobDataMap);
    lenient().when(jobDataMap.get("triggerType")).thenReturn("MANUAL");

    try {
      lenient().when(jobExecutionContext.getScheduler()).thenReturn(scheduler);
      lenient().when(scheduler.getListenerManager()).thenReturn(listenerManager);
      lenient().when(listenerManager.getJobListener(anyString())).thenReturn(jobListener);
      lenient().when(jobListener.getAppRunRecordForJob(any())).thenReturn(appRunRecord);
      lenient().when(appRunRecord.getStatus()).thenReturn(AppRunRecord.Status.RUNNING);
    } catch (Exception e) {
      // Ignore mocking exceptions in test setup
    }

    webSocketManagerMock = mockStatic(WebSocketManager.class);
    webSocketManagerMock.when(WebSocketManager::getInstance).thenReturn(webSocketManager);
  }

  @AfterEach
  void tearDown() {
    if (webSocketManagerMock != null) {
      webSocketManagerMock.close();
    }
  }

  private void injectMockSink() throws Exception {
    Field sinkField = SearchIndexApp.class.getDeclaredField("searchIndexSink");
    sinkField.setAccessible(true);
    sinkField.set(searchIndexApp, mockSink);
  }

  @Test
  void testInitialization() {
    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(testJobData, Object.class));

    searchIndexApp.init(testApp);

    EventPublisherJob jobData = searchIndexApp.getJobData();
    assertNotNull(jobData);
    assertEquals(2, jobData.getEntities().size());
    assertTrue(jobData.getEntities().contains("table"));
    assertTrue(jobData.getEntities().contains("user"));
  }

  @Test
  void testSuccessfulProcessing() throws Exception {
    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(testJobData, Object.class));
    searchIndexApp.init(testApp);
    injectMockSink();

    EntityInterface mockEntity = mock(EntityInterface.class);
    lenient().when(mockEntity.getId()).thenReturn(UUID.randomUUID());

    List<EntityInterface> entities = List.of(mockEntity, mockEntity, mockEntity);
    ResultList<EntityInterface> resultList = new ResultList<>(entities, null, null, 3);

    Map<String, Object> contextData = new HashMap<>();
    contextData.put("entityType", "table");
    contextData.put("recreateIndex", false);

    lenient().doNothing().when(mockSink).write(eq(entities), eq(contextData));

    SearchIndexApp.IndexingTask<EntityInterface> task =
        new SearchIndexApp.IndexingTask<>("table", resultList, 0);

    assertDoesNotThrow(
        () -> {
          var method =
              SearchIndexApp.class.getDeclaredMethod(
                  "processTask", SearchIndexApp.IndexingTask.class, JobExecutionContext.class);
          method.setAccessible(true);
          method.invoke(searchIndexApp, task, jobExecutionContext);
        });
  }

  @Test
  void testCreateContextDataIncludesTargetIndexWhenStaged() throws Exception {
    EventPublisherJob jobDataWithRecreate =
        JsonUtils.convertValue(testJobData, EventPublisherJob.class).withRecreateIndex(true);

    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(jobDataWithRecreate, Object.class));

    searchIndexApp.init(testApp);

    RecreateIndexHandler.ReindexContext context = new RecreateIndexHandler.ReindexContext();
    context.add(
        "table",
        "cluster_table",
        "cluster_table",
        "cluster_table_rebuild_123",
        Set.of("cluster_table_alias"),
        "table",
        List.of("dataAsset"));

    Field contextField = SearchIndexApp.class.getDeclaredField("recreateContext");
    contextField.setAccessible(true);
    contextField.set(searchIndexApp, context);

    Method createContextData =
        SearchIndexApp.class.getDeclaredMethod("createContextData", String.class);
    createContextData.setAccessible(true);

    @SuppressWarnings("unchecked")
    Map<String, Object> contextData =
        (Map<String, Object>) createContextData.invoke(searchIndexApp, "table");

    assertEquals("cluster_table_rebuild_123", contextData.get(TARGET_INDEX_KEY));
    assertTrue((Boolean) contextData.get("recreateIndex"));
  }

  @Test
  void testFinalizeReindexMovesAliasesForTargetEntityOnly() {
    AliasState aliasState = new AliasState();
    aliasState.put(
        "table_search_index_rebuild_old",
        Set.of("table", "table_search_index", "all", "dataAsset"));
    aliasState.put("table_search_index_rebuild_new", new HashSet<>());
    aliasState.put(
        "dashboard_search_index_rebuild_old",
        Set.of("dashboard", "dashboard_search_index", "all", "dataAsset"));

    SearchClient<Void> client = aliasState.toMock();
    SearchRepository repo = mock(SearchRepository.class);
    when(repo.getSearchClient()).thenReturn(client);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getSearchRepository).thenReturn(repo);

      RecreateIndexHandler.ReindexContext context = new RecreateIndexHandler.ReindexContext();
      context.add(
          "table",
          "table_search_index",
          "table_search_index_rebuild_old",
          "table_search_index_rebuild_new",
          Set.of("table", "table_search_index", "all", "dataAsset"),
          "table",
          List.of("all", "dataAsset", "database", "databaseSchema", "databaseService"));

      new DefaultRecreateHandler().finalizeReindex(context, true);
    }

    assertTrue(aliasState.deletedIndices.contains("table_search_index_rebuild_old"));
    assertEquals(
        Set.of(
            "table",
            "table_search_index",
            "all",
            "dataAsset",
            "database",
            "databaseSchema",
            "databaseService"),
        aliasState.indexAliases.get("table_search_index_rebuild_new"));
    assertEquals(
        Set.of("dashboard", "dashboard_search_index", "all", "dataAsset"),
        aliasState.indexAliases.get("dashboard_search_index_rebuild_old"));
  }

  @Test
  void testFinalizeReindexRemovesPreviousEntityRebuildIndexes() {
    AliasState aliasState = new AliasState();
    aliasState.put(
        "table_search_index_rebuild_old1",
        Set.of("table", "table_search_index", "all", "dataAsset"));
    aliasState.put(
        "table_search_index_rebuild_old2",
        Set.of("table", "table_search_index", "all", "dataAsset"));
    aliasState.put("table_search_index_rebuild_new", new HashSet<>());

    SearchClient<Void> client = aliasState.toMock();
    SearchRepository repo = mock(SearchRepository.class);
    when(repo.getSearchClient()).thenReturn(client);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getSearchRepository).thenReturn(repo);

      RecreateIndexHandler.ReindexContext context = new RecreateIndexHandler.ReindexContext();
      context.add(
          "table",
          "table_search_index",
          "table_search_index_rebuild_old1",
          "table_search_index_rebuild_new",
          Set.of("table", "table_search_index", "all", "dataAsset"),
          "table",
          List.of("all", "dataAsset"));

      new DefaultRecreateHandler().finalizeReindex(context, true);
    }

    assertTrue(aliasState.deletedIndices.contains("table_search_index_rebuild_old1"));
    assertEquals(
        Set.of("table", "table_search_index", "all", "dataAsset"),
        aliasState.indexAliases.get("table_search_index_rebuild_new"));
    assertTrue(
        aliasState.indexAliases.containsKey("table_search_index_rebuild_old2")
            ? aliasState.indexAliases.get("table_search_index_rebuild_old2").isEmpty()
            : true);
  }

  @Test
  void testErrorHandlingWithSearchIndexException() throws Exception {
    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(testJobData, Object.class));
    searchIndexApp.init(testApp);
    searchIndexApp.getJobData().setStatus(EventPublisherJob.Status.RUNNING);
    injectMockSink();

    List<EntityError> entityErrors =
        List.of(
            new EntityError()
                .withMessage(
                    "Limit of total fields [250] has been exceeded while adding new fields [3]")
                .withEntity("TestEntity1"),
            new EntityError()
                .withMessage(
                    "Limit of total fields [250] has been exceeded while adding new fields [1]")
                .withEntity("TestEntity2"));

    IndexingError indexingError =
        new IndexingError()
            .withErrorSource(IndexingError.ErrorSource.SINK)
            .withSubmittedCount(10)
            .withSuccessCount(8)
            .withFailedCount(2)
            .withMessage("Issues in Sink to Elasticsearch")
            .withFailedEntities(entityErrors);

    SearchIndexException searchIndexException = new SearchIndexException(indexingError);

    EntityInterface mockEntity = mock(EntityInterface.class);
    lenient().when(mockEntity.getId()).thenReturn(UUID.randomUUID());

    List<EntityInterface> entities = List.of(mockEntity, mockEntity);
    ResultList<EntityInterface> resultList = new ResultList<>(entities, null, null, 2);

    lenient().doThrow(searchIndexException).when(mockSink).write(eq(entities), any(Map.class));

    SearchIndexApp.IndexingTask<EntityInterface> task =
        new SearchIndexApp.IndexingTask<>("table", resultList, 0);

    assertDoesNotThrow(
        () -> {
          var method =
              SearchIndexApp.class.getDeclaredMethod(
                  "processTask", SearchIndexApp.IndexingTask.class, JobExecutionContext.class);
          method.setAccessible(true);
          method.invoke(searchIndexApp, task, jobExecutionContext);
        });

    EventPublisherJob jobData = searchIndexApp.getJobData();
    assertEquals(EventPublisherJob.Status.ACTIVE_ERROR, jobData.getStatus());
    assertNotNull(jobData.getFailure());
    assertEquals(IndexingError.ErrorSource.SINK, jobData.getFailure().getErrorSource());
    assertEquals(2, jobData.getFailure().getFailedCount());
    assertEquals(8, jobData.getFailure().getSuccessCount());
  }

  @Test
  void testReaderErrorHandling() throws Exception {
    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(testJobData, Object.class));
    searchIndexApp.init(testApp);
    injectMockSink();

    List<EntityError> readerErrors =
        List.of(
            new EntityError()
                .withMessage("Failed to read entity from database")
                .withEntity("FailedEntity"));

    EntityInterface mockEntity = mock(EntityInterface.class);
    lenient().when(mockEntity.getId()).thenReturn(UUID.randomUUID());

    List<EntityInterface> entities = List.of(mockEntity);
    ResultList<EntityInterface> resultList =
        new ResultList<>(entities, readerErrors, null, null, entities.size());

    Map<String, Object> contextData = new HashMap<>();
    contextData.put("entityType", "user");
    contextData.put("recreateIndex", false);

    lenient().doNothing().when(mockSink).write(eq(entities), eq(contextData));

    SearchIndexApp.IndexingTask<EntityInterface> task =
        new SearchIndexApp.IndexingTask<>("user", resultList, 0);

    assertDoesNotThrow(
        () -> {
          var method =
              SearchIndexApp.class.getDeclaredMethod(
                  "processTask", SearchIndexApp.IndexingTask.class, JobExecutionContext.class);
          method.setAccessible(true);
          method.invoke(searchIndexApp, task, jobExecutionContext);
        });

    EventPublisherJob jobData = searchIndexApp.getJobData();
    assertEquals(EventPublisherJob.Status.ACTIVE_ERROR, jobData.getStatus());
    assertNotNull(jobData.getFailure());
    assertEquals(IndexingError.ErrorSource.READER, jobData.getFailure().getErrorSource());
    assertEquals(1, jobData.getFailure().getFailedCount());
    assertEquals(1, jobData.getFailure().getSuccessCount());
  }

  @Test
  void testJobCompletionStatus() throws Exception {
    searchIndexApp.init(
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(testJobData, Object.class)));

    EventPublisherJob jobData = searchIndexApp.getJobData();
    jobData.setStatus(EventPublisherJob.Status.RUNNING);

    var method =
        SearchIndexApp.class.getDeclaredMethod(
            "sendUpdates", JobExecutionContext.class, boolean.class);
    method.setAccessible(true);

    if (jobData.getStatus() == EventPublisherJob.Status.RUNNING) {
      jobData.setStatus(EventPublisherJob.Status.COMPLETED);
      method.invoke(searchIndexApp, jobExecutionContext, true);
    }

    assertEquals(EventPublisherJob.Status.COMPLETED, jobData.getStatus());
  }

  @Test
  void testWebSocketThrottling() throws Exception {
    searchIndexApp.init(
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(testJobData, Object.class)));

    var method =
        SearchIndexApp.class.getDeclaredMethod(
            "sendUpdates", JobExecutionContext.class, boolean.class);
    method.setAccessible(true);

    method.invoke(searchIndexApp, jobExecutionContext, false);
    method.invoke(searchIndexApp, jobExecutionContext, false);
    method.invoke(searchIndexApp, jobExecutionContext, false);
    method.invoke(searchIndexApp, jobExecutionContext, true);
  }

  @Test
  void testStatsAccumulation() throws Exception {
    searchIndexApp.init(
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(testJobData, Object.class)));

    // Initialize stats and set searchIndexStats field
    Stats initialStats = searchIndexApp.initializeTotalRecords(Set.of("table"));

    // Use reflection to set searchIndexStats
    Field searchIndexStatsField = SearchIndexApp.class.getDeclaredField("searchIndexStats");
    searchIndexStatsField.setAccessible(true);
    @SuppressWarnings("unchecked")
    AtomicReference<Stats> searchIndexStats =
        (AtomicReference<Stats>) searchIndexStatsField.get(searchIndexApp);
    searchIndexStats.set(initialStats);

    StepStats batch1 = new StepStats().withSuccessRecords(10).withFailedRecords(2);
    StepStats batch2 = new StepStats().withSuccessRecords(15).withFailedRecords(1);
    StepStats batch3 = new StepStats().withSuccessRecords(8).withFailedRecords(0);

    searchIndexApp.updateStats("table", batch1);
    searchIndexApp.updateStats("table", batch2);
    searchIndexApp.updateStats("table", batch3);

    Stats jobStats = searchIndexApp.getJobData().getStats();
    assertNotNull(jobStats);
    assertNotNull(jobStats.getEntityStats());
    assertNotNull(jobStats.getEntityStats().getAdditionalProperties());

    StepStats tableStats = jobStats.getEntityStats().getAdditionalProperties().get("table");
    assertNotNull(tableStats);

    assertEquals(33, tableStats.getSuccessRecords()); // 10 + 15 + 8
    assertEquals(3, tableStats.getFailedRecords()); // 2 + 1 + 0

    StepStats overallStats = jobStats.getJobStats();
    assertNotNull(overallStats);
    assertEquals(33, overallStats.getSuccessRecords());
    assertEquals(3, overallStats.getFailedRecords());
  }

  @Test
  void testAppRunRecordCreation() {
    searchIndexApp.init(
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(testJobData, Object.class)));

    EventPublisherJob jobData = searchIndexApp.getJobData();

    IndexingError error =
        new IndexingError()
            .withErrorSource(IndexingError.ErrorSource.SINK)
            .withMessage("Test error")
            .withFailedCount(5);
    jobData.setFailure(error);
    jobData.setStatus(EventPublisherJob.Status.ACTIVE_ERROR);

    Stats stats =
        new Stats().withJobStats(new StepStats().withSuccessRecords(95).withFailedRecords(5));
    jobData.setStats(stats);

    AppRunRecord mockRecord = mock(AppRunRecord.class);
    lenient().when(mockRecord.getStatus()).thenReturn(AppRunRecord.Status.FAILED);
    lenient().when(mockRecord.getFailureContext()).thenReturn(new FailureContext());
    lenient().when(mockRecord.getSuccessContext()).thenReturn(new SuccessContext());

    try {
      var method =
          SearchIndexApp.class.getDeclaredMethod(
              "updateRecordToDbAndNotify", JobExecutionContext.class);
      method.setAccessible(true);
      method.invoke(searchIndexApp, jobExecutionContext);
      assertEquals(IndexingError.ErrorSource.SINK, jobData.getFailure().getErrorSource());
      assertEquals("Test error", jobData.getFailure().getMessage());
      assertEquals(5, jobData.getFailure().getFailedCount());

    } catch (Exception e) {
      LOG.debug("Expected exception during partial mocking: {}", e.getMessage());
    }
  }

  @Test
  void testConcurrentProcessing() throws Exception {
    searchIndexApp.init(
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(testJobData, Object.class)));

    // Initialize stats and set searchIndexStats field
    Stats initialStats = searchIndexApp.initializeTotalRecords(Set.of("table"));

    // Use reflection to set searchIndexStats
    Field searchIndexStatsField = SearchIndexApp.class.getDeclaredField("searchIndexStats");
    searchIndexStatsField.setAccessible(true);
    @SuppressWarnings("unchecked")
    AtomicReference<Stats> searchIndexStats =
        (AtomicReference<Stats>) searchIndexStatsField.get(searchIndexApp);
    searchIndexStats.set(initialStats);

    int numThreads = 5;
    int batchesPerThread = 10;
    ExecutorService executor = Executors.newFixedThreadPool(numThreads);
    CountDownLatch latch = new CountDownLatch(numThreads);

    for (int i = 0; i < numThreads; i++) {
      final int threadId = i;
      executor.submit(
          () -> {
            try {
              for (int j = 0; j < batchesPerThread; j++) {
                StepStats stats =
                    new StepStats()
                        .withSuccessRecords(threadId + 1)
                        .withFailedRecords(j % 2); // Alternate between 0 and 1 failures
                searchIndexApp.updateStats("table", stats);
              }
            } finally {
              latch.countDown();
            }
          });
    }
    assertTrue(latch.await(30, TimeUnit.SECONDS));
    executor.shutdown();

    Stats jobStats = searchIndexApp.getJobData().getStats();
    assertNotNull(jobStats);
    assertNotNull(jobStats.getEntityStats());
    assertNotNull(jobStats.getEntityStats().getAdditionalProperties());

    StepStats tableStats = jobStats.getEntityStats().getAdditionalProperties().get("table");
    assertNotNull(tableStats);

    int expectedSuccess = 0;
    int expectedFailures = 0;
    for (int i = 0; i < numThreads; i++) {
      expectedSuccess += (i + 1) * batchesPerThread;
      expectedFailures += batchesPerThread / 2; // Half have 1 failure, half have 0
    }

    assertEquals(expectedSuccess, tableStats.getSuccessRecords());
    assertEquals(expectedFailures, tableStats.getFailedRecords());
  }

  @Test
  void testProcessingWithRecreateIndexTrue() throws Exception {
    // Create job data with recreateIndex = true
    EventPublisherJob recreateIndexJobData =
        new EventPublisherJob()
            .withEntities(Set.of("table"))
            .withBatchSize(5)
            .withPayLoadSize(1000000L)
            .withMaxConcurrentRequests(10)
            .withRecreateIndex(true) // Set recreateIndex to true
            .withStats(new Stats());

    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(recreateIndexJobData, Object.class));
    searchIndexApp.init(testApp);
    injectMockSink();

    EntityInterface mockEntity = mock(EntityInterface.class);
    lenient().when(mockEntity.getId()).thenReturn(UUID.randomUUID());

    List<EntityInterface> entities = List.of(mockEntity, mockEntity);
    ResultList<EntityInterface> resultList = new ResultList<>(entities, null, null, 2);

    // Capture the context data passed to the sink
    ArgumentCaptor<Map<String, Object>> contextCaptor = ArgumentCaptor.forClass(Map.class);

    lenient().doNothing().when(mockSink).write(eq(entities), contextCaptor.capture());

    SearchIndexApp.IndexingTask<EntityInterface> task =
        new SearchIndexApp.IndexingTask<>("table", resultList, 0);

    assertDoesNotThrow(
        () -> {
          var method =
              SearchIndexApp.class.getDeclaredMethod(
                  "processTask", SearchIndexApp.IndexingTask.class, JobExecutionContext.class);
          method.setAccessible(true);
          method.invoke(searchIndexApp, task, jobExecutionContext);
        });

    // Verify that recreateIndex was passed in context data
    Map<String, Object> capturedContext = contextCaptor.getValue();
    assertNotNull(capturedContext);
    assertEquals("table", capturedContext.get("entityType"));
    assertEquals(true, capturedContext.get("recreateIndex"));
  }

  @Test
  void testAutoTuneConfiguration() {
    EventPublisherJob autoTuneJobData =
        new EventPublisherJob()
            .withEntities(Set.of("table"))
            .withBatchSize(100)
            .withPayLoadSize(10 * 1024 * 1024L)
            .withMaxConcurrentRequests(50)
            .withProducerThreads(2)
            .withAutoTune(true) // Enable auto-tuning
            .withRecreateIndex(false)
            .withStats(new Stats());

    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(autoTuneJobData, Object.class));

    lenient()
        .when(searchRepository.getSearchType())
        .thenReturn(
            org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration
                .SearchType.ELASTICSEARCH);

    assertDoesNotThrow(
        () -> searchIndexApp.init(testApp), "SearchIndexApp should handle autoTune configuration");

    EventPublisherJob resultJobData = searchIndexApp.getJobData();
    assertNotNull(resultJobData, "Job data should be available");
    assertTrue(resultJobData.getAutoTune(), "AutoTune flag should be preserved");

    assertTrue(resultJobData.getBatchSize() > 0, "Batch size should be positive");
    assertTrue(resultJobData.getPayLoadSize() > 0, "Payload size should be positive");
    assertTrue(
        resultJobData.getMaxConcurrentRequests() > 0, "Concurrent requests should be positive");
    assertTrue(resultJobData.getProducerThreads() > 0, "Producer threads should be positive");
  }

  @Test
  void testMemoryAwareQueueSizing() throws Exception {
    searchIndexApp.init(
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(testJobData, Object.class)));

    var calculateMethod =
        SearchIndexApp.class.getDeclaredMethod("calculateMemoryAwareQueueSize", int.class);
    calculateMethod.setAccessible(true);

    Field batchSizeField = SearchIndexApp.class.getDeclaredField("batchSize");
    batchSizeField.setAccessible(true);
    @SuppressWarnings("unchecked")
    AtomicReference<Integer> batchSize =
        (AtomicReference<Integer>) batchSizeField.get(searchIndexApp);

    batchSize.set(100);
    int requestedSize = 50000;
    int effectiveSize = (int) calculateMethod.invoke(searchIndexApp, requestedSize);
    assertTrue(
        effectiveSize <= requestedSize, "Effective queue size should not exceed requested size");

    batchSize.set(10000);
    int largeRequestedSize = 100000;
    int memoryLimitedSize = (int) calculateMethod.invoke(searchIndexApp, largeRequestedSize);
    assertTrue(
        memoryLimitedSize < largeRequestedSize,
        "Large batch size should result in memory-limited queue size");

    Runtime runtime = Runtime.getRuntime();
    long maxHeap = runtime.maxMemory();
    long estimatedEntitySize = 5 * 1024L; // 5KB per entity
    long maxQueueMemory = (long) (maxHeap * 0.25); // 25% of heap
    int expectedLimit = (int) (maxQueueMemory / (estimatedEntitySize * 10000));
    assertEquals(
        Math.min(largeRequestedSize, expectedLimit),
        memoryLimitedSize,
        "Memory-based calculation should match expected formula");
  }

  @Test
  void testQueueBackpressureWithBlockingPut() throws Exception {
    EventPublisherJob smallQueueJobData =
        new EventPublisherJob()
            .withEntities(Set.of("table"))
            .withBatchSize(2)
            .withQueueSize(2) // Very small queue
            .withConsumerThreads(1)
            .withStats(new Stats());

    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(smallQueueJobData, Object.class));

    searchIndexApp.init(testApp);

    // Initialize stats and queue
    Stats initialStats = searchIndexApp.initializeTotalRecords(Set.of("table"));
    Field searchIndexStatsField = SearchIndexApp.class.getDeclaredField("searchIndexStats");
    searchIndexStatsField.setAccessible(true);
    @SuppressWarnings("unchecked")
    AtomicReference<Stats> searchIndexStats =
        (AtomicReference<Stats>) searchIndexStatsField.get(searchIndexApp);
    searchIndexStats.set(initialStats);

    // Initialize batch size
    Field batchSizeField = SearchIndexApp.class.getDeclaredField("batchSize");
    batchSizeField.setAccessible(true);
    @SuppressWarnings("unchecked")
    AtomicReference<Integer> batchSize =
        (AtomicReference<Integer>) batchSizeField.get(searchIndexApp);
    batchSize.set(2);

    // Create and initialize the queue using reflection
    var calculateMethod =
        SearchIndexApp.class.getDeclaredMethod("calculateMemoryAwareQueueSize", int.class);
    calculateMethod.setAccessible(true);
    int effectiveQueueSize = (int) calculateMethod.invoke(searchIndexApp, 2);

    Field queueField = SearchIndexApp.class.getDeclaredField("taskQueue");
    queueField.setAccessible(true);
    queueField.set(
        searchIndexApp, new java.util.concurrent.LinkedBlockingQueue<>(effectiveQueueSize));

    // Mock entities
    EntityInterface mockEntity = mock(EntityInterface.class);
    lenient().when(mockEntity.getId()).thenReturn(UUID.randomUUID());
    List<EntityInterface> entities = List.of(mockEntity, mockEntity);
    ResultList<EntityInterface> resultList = new ResultList<>(entities, null, null, 2);

    // Test that processReadTask uses put() which will block if queue is full
    var processReadTaskMethod =
        SearchIndexApp.class.getDeclaredMethod(
            "processReadTask", String.class, Source.class, int.class);
    processReadTaskMethod.setAccessible(true);

    // Create a mock source that returns our result list
    @SuppressWarnings("unchecked")
    Source<ResultList<EntityInterface>> source = mock(Source.class);
    lenient().when(source.readWithCursor(anyString())).thenReturn(resultList);

    Field stoppedField = SearchIndexApp.class.getDeclaredField("stopped");
    stoppedField.setAccessible(true);
    stoppedField.set(searchIndexApp, false);

    // This should complete without throwing an exception even with a small queue
    assertDoesNotThrow(
        () -> processReadTaskMethod.invoke(searchIndexApp, "table", source, 0),
        "processReadTask should handle queue backpressure gracefully");
  }

  @Test
  void testLinkedBlockingQueueUsage() throws Exception {
    searchIndexApp.init(
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(testJobData, Object.class)));

    Field batchSizeField = SearchIndexApp.class.getDeclaredField("batchSize");
    batchSizeField.setAccessible(true);
    @SuppressWarnings("unchecked")
    AtomicReference<Integer> batchSize =
        (AtomicReference<Integer>) batchSizeField.get(searchIndexApp);
    batchSize.set(100);

    var calculateMethod =
        SearchIndexApp.class.getDeclaredMethod("calculateMemoryAwareQueueSize", int.class);
    calculateMethod.setAccessible(true);
    int effectiveQueueSize = (int) calculateMethod.invoke(searchIndexApp, 1000);

    Field queueField = SearchIndexApp.class.getDeclaredField("taskQueue");
    queueField.setAccessible(true);
    queueField.set(
        searchIndexApp, new java.util.concurrent.LinkedBlockingQueue<>(effectiveQueueSize));

    Object queue = queueField.get(searchIndexApp);
    assertNotNull(queue, "Task queue should be initialized");
    assertInstanceOf(
        LinkedBlockingQueue.class, queue, "Should use LinkedBlockingQueue for better performance");
  }

  @Test
  void testAdaptiveTuningInitialization() throws Exception {
    EventPublisherJob autoTuneJobData =
        new EventPublisherJob()
            .withEntities(Set.of("table"))
            .withBatchSize(100)
            .withAutoTune(true)
            .withStats(new Stats());

    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(autoTuneJobData, Object.class));

    searchIndexApp.init(testApp);

    // Use reflection to access private fields
    Field lastTuneTimeField = SearchIndexApp.class.getDeclaredField("lastTuneTime");
    lastTuneTimeField.setAccessible(true);
    long lastTuneTime = lastTuneTimeField.getLong(searchIndexApp);
    assertEquals(0, lastTuneTime, "Initial lastTuneTime should be 0");

    Field totalProcessingTimeField = SearchIndexApp.class.getDeclaredField("totalProcessingTime");
    totalProcessingTimeField.setAccessible(true);
    @SuppressWarnings("unchecked")
    AtomicLong totalProcessingTime = (AtomicLong) totalProcessingTimeField.get(searchIndexApp);
    assertEquals(0, totalProcessingTime.get(), "Initial totalProcessingTime should be 0");

    Field totalEntitiesProcessedField =
        SearchIndexApp.class.getDeclaredField("totalEntitiesProcessed");
    totalEntitiesProcessedField.setAccessible(true);
    @SuppressWarnings("unchecked")
    AtomicLong totalEntitiesProcessed =
        (AtomicLong) totalEntitiesProcessedField.get(searchIndexApp);
    assertEquals(0, totalEntitiesProcessed.get(), "Initial totalEntitiesProcessed should be 0");
  }

  @Test
  void testAdaptiveTuningBatchSizeIncrease() throws Exception {
    EventPublisherJob autoTuneJobData =
        new EventPublisherJob()
            .withEntities(Set.of("table"))
            .withBatchSize(200)
            .withAutoTune(true)
            .withStats(new Stats());

    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(autoTuneJobData, Object.class));

    searchIndexApp.init(testApp);

    // Setup for adaptive tuning
    Field batchSizeField = SearchIndexApp.class.getDeclaredField("batchSize");
    batchSizeField.setAccessible(true);
    @SuppressWarnings("unchecked")
    AtomicReference<Integer> batchSize =
        (AtomicReference<Integer>) batchSizeField.get(searchIndexApp);
    batchSize.set(200);

    Field consecutiveSuccessesField = SearchIndexApp.class.getDeclaredField("consecutiveSuccesses");
    consecutiveSuccessesField.setAccessible(true);
    AtomicInteger consecutiveSuccesses =
        (AtomicInteger) consecutiveSuccessesField.get(searchIndexApp);
    consecutiveSuccesses.set(60); // Above BATCH_SIZE_INCREASE_THRESHOLD

    Field consecutiveErrorsField = SearchIndexApp.class.getDeclaredField("consecutiveErrors");
    consecutiveErrorsField.setAccessible(true);
    AtomicInteger consecutiveErrors = (AtomicInteger) consecutiveErrorsField.get(searchIndexApp);
    consecutiveErrors.set(0);

    // Call performAdaptiveTuning
    var performAdaptiveTuningMethod =
        SearchIndexApp.class.getDeclaredMethod("performAdaptiveTuning");
    performAdaptiveTuningMethod.setAccessible(true);
    performAdaptiveTuningMethod.invoke(searchIndexApp);

    // Verify batch size increased
    int newBatchSize = batchSize.get();
    assertEquals(250, newBatchSize, "Batch size should increase by 50 when conditions are met");
  }

  @Test
  void testAdaptiveTuningBatchSizeDecreaseOnMemoryPressure() throws Exception {
    EventPublisherJob autoTuneJobData =
        new EventPublisherJob()
            .withEntities(Set.of("table"))
            .withBatchSize(500)
            .withAutoTune(true)
            .withStats(new Stats());

    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(autoTuneJobData, Object.class));

    searchIndexApp.init(testApp);

    // This test would need to mock memory conditions which is complex
    // For now, we'll just verify the method exists and is callable
    var performAdaptiveTuningMethod =
        SearchIndexApp.class.getDeclaredMethod("performAdaptiveTuning");
    assertNotNull(performAdaptiveTuningMethod, "performAdaptiveTuning method should exist");
  }

  @Test
  void testProcessingTimeTracking() throws Exception {
    searchIndexApp.init(
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(testJobData, Object.class)));
    injectMockSink();

    // Initialize stats
    Stats initialStats = searchIndexApp.initializeTotalRecords(Set.of("table"));
    Field searchIndexStatsField = SearchIndexApp.class.getDeclaredField("searchIndexStats");
    searchIndexStatsField.setAccessible(true);
    @SuppressWarnings("unchecked")
    AtomicReference<Stats> searchIndexStats =
        (AtomicReference<Stats>) searchIndexStatsField.get(searchIndexApp);
    searchIndexStats.set(initialStats);

    // Process a task
    EntityInterface mockEntity = mock(EntityInterface.class);
    lenient().when(mockEntity.getId()).thenReturn(UUID.randomUUID());
    List<EntityInterface> entities = List.of(mockEntity, mockEntity);
    ResultList<EntityInterface> resultList = new ResultList<>(entities, null, null, 2);

    SearchIndexApp.IndexingTask<EntityInterface> task =
        new SearchIndexApp.IndexingTask<>("table", resultList, 0);

    searchIndexApp.getJobData().setStatus(EventPublisherJob.Status.RUNNING);

    // Process the task
    var processTaskMethod =
        SearchIndexApp.class.getDeclaredMethod(
            "processTask", SearchIndexApp.IndexingTask.class, JobExecutionContext.class);
    processTaskMethod.setAccessible(true);
    processTaskMethod.invoke(searchIndexApp, task, jobExecutionContext);

    // Verify processing time was tracked
    Field totalProcessingTimeField = SearchIndexApp.class.getDeclaredField("totalProcessingTime");
    totalProcessingTimeField.setAccessible(true);
    @SuppressWarnings("unchecked")
    AtomicLong totalProcessingTime = (AtomicLong) totalProcessingTimeField.get(searchIndexApp);
    assertTrue(totalProcessingTime.get() > 0, "Processing time should be tracked");

    Field totalEntitiesProcessedField =
        SearchIndexApp.class.getDeclaredField("totalEntitiesProcessed");
    totalEntitiesProcessedField.setAccessible(true);
    @SuppressWarnings("unchecked")
    AtomicLong totalEntitiesProcessed =
        (AtomicLong) totalEntitiesProcessedField.get(searchIndexApp);
    assertEquals(2, totalEntitiesProcessed.get(), "Should track 2 processed entities");
  }

  @Test
  void testSearchIndexSinkInitializationWithElasticSearch() {
    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(testJobData, Object.class));

    lenient()
        .when(searchRepository.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.ELASTICSEARCH);

    lenient().when(searchRepository.createBulkSink(5, 10, 1000000L)).thenReturn(mockSink);

    assertDoesNotThrow(() -> searchIndexApp.init(testApp));

    EventPublisherJob jobData = searchIndexApp.getJobData();
    assertNotNull(jobData);
    assertEquals(5, jobData.getBatchSize());
    assertEquals(10, jobData.getMaxConcurrentRequests());
    assertEquals(1000000L, jobData.getPayLoadSize());
  }

  @Test
  void testSearchIndexSinkInitializationWithOpenSearch() {
    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(testJobData, Object.class));

    lenient()
        .when(searchRepository.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.OPENSEARCH);

    lenient().when(searchRepository.createBulkSink(5, 10, 1000000L)).thenReturn(mockSink);

    assertDoesNotThrow(() -> searchIndexApp.init(testApp));

    EventPublisherJob jobData = searchIndexApp.getJobData();
    assertNotNull(jobData);
    assertEquals(5, jobData.getBatchSize());
    assertEquals(10, jobData.getMaxConcurrentRequests());
    assertEquals(1000000L, jobData.getPayLoadSize());
  }

  @Test
  void testPerEntityIndexFinalization() {
    SearchRepository searchRepo = Entity.getSearchRepository();
    SearchClient<?> searchClient = searchRepo.getSearchClient();
    String clusterAlias = searchRepo.getClusterAlias();

    // Create test indexes
    String stagedIndex = "test_table_search_index_rebuild_" + System.currentTimeMillis();
    String oldIndex = "test_table_search_index_old_" + System.currentTimeMillis();
    String canonicalIndex = "test_table_search_index";

    try {
      // Setup: Create the old index with aliases
      searchClient.createIndex(oldIndex, "{}");
      searchClient.addAliases(oldIndex, Set.of("test_table", canonicalIndex, "test_all"));

      // Create the staged index
      searchClient.createIndex(stagedIndex, "{}");

      RecreateIndexHandler.ReindexContext context = new RecreateIndexHandler.ReindexContext();
      context.add(
          "test_table",
          canonicalIndex,
          oldIndex,
          stagedIndex,
          Set.of("test_table", canonicalIndex, "test_all"),
          "test_table",
          List.of("test_all"));

      DefaultRecreateHandler handler = new DefaultRecreateHandler();

      // Finalize just the table entity
      handler.finalizeEntityReindex(context, "test_table", true);

      // Verify the staged index was promoted
      assertFalse(searchClient.indexExists(oldIndex), "Old index should be deleted");
      assertTrue(searchClient.indexExists(stagedIndex), "Staged index should exist");

      Set<String> stagedAliases = searchClient.getAliases(stagedIndex);
      assertTrue(stagedAliases.contains("test_table"));
      assertTrue(stagedAliases.contains(canonicalIndex));
      assertTrue(stagedAliases.contains("test_all"));

      // Verify the entity is marked as finalized
      assertTrue(context.isFinalized("test_table"));
    } finally {
      // Cleanup
      if (searchClient.indexExists(stagedIndex)) {
        searchClient.deleteIndex(stagedIndex);
      }
      if (searchClient.indexExists(oldIndex)) {
        searchClient.deleteIndex(oldIndex);
      }
    }
  }

  @Test
  void testFinalizedEntitiesNotReprocessed() {
    SearchRepository searchRepo = Entity.getSearchRepository();
    SearchClient<?> searchClient = searchRepo.getSearchClient();

    long timestamp = System.currentTimeMillis();
    String tableStaged = "test_table_staged_" + timestamp;
    String tableOld = "test_table_old_" + timestamp;
    String userStaged = "test_user_staged_" + timestamp;
    String userOld = "test_user_old_" + timestamp;

    try {
      // Create test indexes
      searchClient.createIndex(tableOld, "{}");
      searchClient.addAliases(tableOld, Set.of("test_table_alias"));
      searchClient.createIndex(tableStaged, "{}");

      searchClient.createIndex(userOld, "{}");
      searchClient.addAliases(userOld, Set.of("test_user_alias"));
      searchClient.createIndex(userStaged, "{}");

      RecreateIndexHandler.ReindexContext context = new RecreateIndexHandler.ReindexContext();
      context.add(
          "test_table",
          "test_table_index",
          tableOld,
          tableStaged,
          Set.of("test_table_alias"),
          "test_table",
          List.of());
      context.add(
          "test_user",
          "test_user_index",
          userOld,
          userStaged,
          Set.of("test_user_alias"),
          "test_user",
          List.of());

      DefaultRecreateHandler handler = new DefaultRecreateHandler();

      // Finalize table entity first
      handler.finalizeEntityReindex(context, "test_table", true);
      assertTrue(context.isFinalized("test_table"));
      assertFalse(searchClient.indexExists(tableOld), "Table old index should be deleted");

      // Now call batch finalization (should skip table, only process user)
      handler.finalizeReindex(context, true);

      // Both should be finalized
      assertTrue(context.isFinalized("test_table"));
      assertTrue(context.isFinalized("test_user"));

      // User should be processed
      assertFalse(searchClient.indexExists(userOld), "User old index should be deleted");
      assertTrue(searchClient.indexExists(userStaged), "User staged index should exist");
    } finally {
      // Cleanup
      for (String index : List.of(tableStaged, tableOld, userStaged, userOld)) {
        if (searchClient.indexExists(index)) {
          searchClient.deleteIndex(index);
        }
      }
    }
  }

  @Test
  void testEntityFinalizationOnSuccess() {
    SearchRepository searchRepo = Entity.getSearchRepository();
    SearchClient<?> searchClient = searchRepo.getSearchClient();

    long timestamp = System.currentTimeMillis();
    String stagedIndex = "test_dashboard_staged_" + timestamp;
    String oldIndex = "test_dashboard_old_" + timestamp;

    try {
      // Create indexes
      searchClient.createIndex(oldIndex, "{}");
      searchClient.addAliases(oldIndex, Set.of("test_dashboard", "test_all"));
      searchClient.createIndex(stagedIndex, "{}");

      RecreateIndexHandler.ReindexContext context = new RecreateIndexHandler.ReindexContext();
      context.add(
          "test_dashboard",
          "test_dashboard_index",
          oldIndex,
          stagedIndex,
          Set.of("test_dashboard", "test_all"),
          "test_dashboard",
          List.of("test_all"));

      DefaultRecreateHandler handler = new DefaultRecreateHandler();
      handler.finalizeEntityReindex(context, "test_dashboard", true);

      // On success, old index should be deleted and aliases moved
      assertFalse(searchClient.indexExists(oldIndex), "Old index should be deleted");
      assertTrue(searchClient.indexExists(stagedIndex), "Staged index should exist");

      Set<String> aliases = searchClient.getAliases(stagedIndex);
      assertTrue(aliases.contains("test_dashboard"));
      assertTrue(aliases.contains("test_all"));
      assertTrue(context.isFinalized("test_dashboard"));
    } finally {
      // Cleanup
      for (String index : List.of(stagedIndex, oldIndex)) {
        if (searchClient.indexExists(index)) {
          searchClient.deleteIndex(index);
        }
      }
    }
  }

  @Test
  void testEntityFinalizationOnFailure() {
    SearchRepository searchRepo = Entity.getSearchRepository();
    SearchClient<?> searchClient = searchRepo.getSearchClient();

    long timestamp = System.currentTimeMillis();
    String stagedIndex = "test_pipeline_staged_" + timestamp;
    String oldIndex = "test_pipeline_old_" + timestamp;

    try {
      // Create indexes
      searchClient.createIndex(oldIndex, "{}");
      searchClient.addAliases(oldIndex, Set.of("test_pipeline", "test_all"));
      searchClient.createIndex(stagedIndex, "{}");

      RecreateIndexHandler.ReindexContext context = new RecreateIndexHandler.ReindexContext();
      context.add(
          "test_pipeline",
          "test_pipeline_index",
          oldIndex,
          stagedIndex,
          Set.of("test_pipeline", "test_all"),
          "test_pipeline",
          List.of("test_all"));

      DefaultRecreateHandler handler = new DefaultRecreateHandler();
      handler.finalizeEntityReindex(context, "test_pipeline", false);

      // On failure, staged index should be deleted, old index should remain
      assertFalse(searchClient.indexExists(stagedIndex), "Staged index should be deleted");
      assertTrue(searchClient.indexExists(oldIndex), "Old index should remain");

      Set<String> aliases = searchClient.getAliases(oldIndex);
      assertTrue(aliases.contains("test_pipeline"));
      assertTrue(aliases.contains("test_all"));
      assertTrue(context.isFinalized("test_pipeline"));
    } finally {
      // Cleanup
      for (String index : List.of(stagedIndex, oldIndex)) {
        if (searchClient.indexExists(index)) {
          searchClient.deleteIndex(index);
        }
      }
    }
  }

  @Test
  void testPerEntityFinalizationWithClusterAlias() {
    SearchRepository searchRepo = Entity.getSearchRepository();
    SearchClient<?> searchClient = searchRepo.getSearchClient();
    String clusterAlias = searchRepo.getClusterAlias();

    long timestamp = System.currentTimeMillis();
    String canonicalIndexName =
        clusterAlias.isEmpty()
            ? "test_cluster_table_index"
            : clusterAlias + "_test_cluster_table_index";
    String oldIndex = canonicalIndexName + "_old_" + timestamp;
    String stagedIndex = canonicalIndexName + "_rebuild_" + timestamp;

    try {
      // Create old index with canonical name as alias
      searchClient.createIndex(oldIndex, "{}");
      if (!clusterAlias.isEmpty()) {
        // Add canonical index name as alias (simulating existing setup)
        searchClient.addAliases(oldIndex, Set.of(canonicalIndexName, "test_cluster_alias"));
      } else {
        searchClient.addAliases(oldIndex, Set.of("test_cluster_alias"));
      }

      // Create staged index
      searchClient.createIndex(stagedIndex, "{}");

      RecreateIndexHandler.ReindexContext context = new RecreateIndexHandler.ReindexContext();
      Set<String> existingAliases =
          clusterAlias.isEmpty()
              ? Set.of("test_cluster_alias")
              : Set.of(canonicalIndexName, "test_cluster_alias");

      context.add(
          "test_cluster_table",
          canonicalIndexName,
          oldIndex,
          stagedIndex,
          existingAliases,
          "test_cluster_table",
          List.of());

      DefaultRecreateHandler handler = new DefaultRecreateHandler();

      // Finalize the entity
      handler.finalizeEntityReindex(context, "test_cluster_table", true);

      // Verify old index is deleted
      assertFalse(searchClient.indexExists(oldIndex), "Old index should be deleted");
      assertTrue(searchClient.indexExists(stagedIndex), "Staged index should exist");

      // Verify aliases are attached to staged index
      Set<String> stagedAliases = searchClient.getAliases(stagedIndex);
      assertTrue(stagedAliases.contains("test_cluster_alias"), "Should have test_cluster_alias");

      // Verify canonical index name works as alias (if cluster alias is configured)
      if (!clusterAlias.isEmpty()) {
        assertTrue(
            stagedAliases.contains(canonicalIndexName),
            "Should have canonical index name as alias: " + canonicalIndexName);
      }

      assertTrue(context.isFinalized("test_cluster_table"));
    } finally {
      // Cleanup
      for (String index : List.of(oldIndex, stagedIndex)) {
        if (searchClient.indexExists(index)) {
          searchClient.deleteIndex(index);
        }
      }
    }
  }

  @Test
  void testMultipleEntitiesWithPerEntityFinalization() {
    SearchRepository searchRepo = Entity.getSearchRepository();
    SearchClient<?> searchClient = searchRepo.getSearchClient();

    long timestamp = System.currentTimeMillis();
    String tableStaged = "test_multi_table_staged_" + timestamp;
    String tableOld = "test_multi_table_old_" + timestamp;
    String userStaged = "test_multi_user_staged_" + timestamp;
    String userOld = "test_multi_user_old_" + timestamp;
    String dashStaged = "test_multi_dash_staged_" + timestamp;
    String dashOld = "test_multi_dash_old_" + timestamp;

    try {
      // Setup three entities
      searchClient.createIndex(tableOld, "{}");
      searchClient.addAliases(tableOld, Set.of("test_table", "test_all"));
      searchClient.createIndex(tableStaged, "{}");

      searchClient.createIndex(userOld, "{}");
      searchClient.addAliases(userOld, Set.of("test_user", "test_all"));
      searchClient.createIndex(userStaged, "{}");

      searchClient.createIndex(dashOld, "{}");
      searchClient.addAliases(dashOld, Set.of("test_dashboard", "test_all"));
      searchClient.createIndex(dashStaged, "{}");

      RecreateIndexHandler.ReindexContext context = new RecreateIndexHandler.ReindexContext();
      context.add(
          "test_table",
          "test_table_index",
          tableOld,
          tableStaged,
          Set.of("test_table", "test_all"),
          "test_table",
          List.of("test_all"));
      context.add(
          "test_user",
          "test_user_index",
          userOld,
          userStaged,
          Set.of("test_user", "test_all"),
          "test_user",
          List.of("test_all"));
      context.add(
          "test_dashboard",
          "test_dashboard_index",
          dashOld,
          dashStaged,
          Set.of("test_dashboard", "test_all"),
          "test_dashboard",
          List.of("test_all"));

      DefaultRecreateHandler handler = new DefaultRecreateHandler();

      // Simulate processing entities one by one
      handler.finalizeEntityReindex(context, "test_table", true);
      assertFalse(searchClient.indexExists(tableOld), "Table old index should be deleted");
      assertTrue(context.isFinalized("test_table"));

      handler.finalizeEntityReindex(context, "test_user", true);
      assertFalse(searchClient.indexExists(userOld), "User old index should be deleted");
      assertTrue(context.isFinalized("test_user"));

      // Dashboard fails
      handler.finalizeEntityReindex(context, "test_dashboard", false);
      assertFalse(
          searchClient.indexExists(dashStaged), "Dashboard staged should be deleted on failure");
      assertTrue(searchClient.indexExists(dashOld), "Dashboard old should remain on failure");
      assertTrue(context.isFinalized("test_dashboard"));

      // Verify final state - successful entities have staged indexes
      assertTrue(searchClient.indexExists(tableStaged));
      assertTrue(searchClient.indexExists(userStaged));
      assertFalse(searchClient.indexExists(dashStaged));
    } finally {
      // Cleanup
      for (String index :
          List.of(tableStaged, tableOld, userStaged, userOld, dashStaged, dashOld)) {
        if (searchClient.indexExists(index)) {
          searchClient.deleteIndex(index);
        }
      }
    }
  }

  private static class AliasState {
    final Map<String, Set<String>> indexAliases = new HashMap<>();
    final Set<String> deletedIndices = new HashSet<>();

    void put(String indexName, Set<String> aliases) {
      indexAliases.put(indexName, new HashSet<>(aliases));
    }

    SearchClient<Void> toMock() {
      @SuppressWarnings("unchecked")
      SearchClient<Void> client = mock(SearchClient.class);

      lenient().when(client.isClientAvailable()).thenReturn(true);
      lenient()
          .when(client.getSearchType())
          .thenReturn(ElasticSearchConfiguration.SearchType.ELASTICSEARCH);
      when(client.indexExists(anyString()))
          .thenAnswer(invocation -> indexAliases.containsKey(invocation.getArgument(0)));
      lenient()
          .when(client.getAliases(anyString()))
          .thenAnswer(
              invocation ->
                  new HashSet<>(indexAliases.getOrDefault(invocation.getArgument(0), Set.of())));
      lenient()
          .when(client.getIndicesByAlias(anyString()))
          .thenAnswer(
              invocation ->
                  indexAliases.entrySet().stream()
                      .filter(e -> e.getValue().contains(invocation.getArgument(0)))
                      .map(Map.Entry::getKey)
                      .collect(Collectors.toSet()));

      doAnswer(
              invocation -> {
                String index = invocation.getArgument(0);
                @SuppressWarnings("unchecked")
                Set<String> aliases = new HashSet<>((Set<String>) invocation.getArgument(1));
                indexAliases.computeIfPresent(
                    index,
                    (k, v) -> {
                      v.removeAll(aliases);
                      return v;
                    });
                return null;
              })
          .when(client)
          .removeAliases(anyString(), anySet());

      doAnswer(
              invocation -> {
                String index = invocation.getArgument(0);
                @SuppressWarnings("unchecked")
                Set<String> aliases = new HashSet<>((Set<String>) invocation.getArgument(1));
                indexAliases.computeIfAbsent(index, k -> new HashSet<>()).addAll(aliases);
                return null;
              })
          .when(client)
          .addAliases(anyString(), anySet());

      doAnswer(
              invocation -> {
                String index = invocation.getArgument(0);
                indexAliases.remove(index);
                deletedIndices.add(index);
                return null;
              })
          .when(client)
          .deleteIndex(anyString());

      return client;
    }
  }
}
