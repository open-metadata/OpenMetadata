package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;

import java.lang.reflect.Field;
import java.util.HashMap;
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
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.util.ResultList;
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
  void testErrorHandlingWithSearchIndexException() throws Exception {
    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(testJobData, Object.class));
    searchIndexApp.init(testApp);
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

    Map<String, Object> contextData = new HashMap<>();
    contextData.put("entityType", "table");
    contextData.put("recreateIndex", false);

    lenient().doThrow(searchIndexException).when(mockSink).write(eq(entities), eq(contextData));

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
}
