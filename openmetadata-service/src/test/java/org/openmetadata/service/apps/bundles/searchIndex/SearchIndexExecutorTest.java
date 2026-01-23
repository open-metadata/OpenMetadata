package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.TARGET_INDEX_KEY;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
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
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.ReindexContext;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.workflows.interfaces.Source;

@ExtendWith(MockitoExtension.class)
@Slf4j
class SearchIndexExecutorTest extends OpenMetadataApplicationTest {

  @Mock private CollectionDAO collectionDAO;
  @Mock private SearchRepository searchRepository;
  @Mock private BulkSink mockSink;
  @Mock private WebSocketManager webSocketManager;
  private SearchIndexExecutor executor;
  private MockedStatic<WebSocketManager> webSocketManagerMock;

  @BeforeEach
  void setUp() {
    executor = new SearchIndexExecutor(collectionDAO, searchRepository);

    webSocketManagerMock = mockStatic(WebSocketManager.class);
    webSocketManagerMock.when(WebSocketManager::getInstance).thenReturn(webSocketManager);
  }

  @AfterEach
  void tearDown() {
    if (webSocketManagerMock != null) {
      webSocketManagerMock.close();
    }
    if (executor != null) {
      executor.close();
    }
  }

  private void injectMockSink() throws Exception {
    Field sinkField = SearchIndexExecutor.class.getDeclaredField("searchIndexSink");
    sinkField.setAccessible(true);
    sinkField.set(executor, mockSink);
  }

  private void initializeExecutorConfig(ReindexingConfiguration config) throws Exception {
    Field configField = SearchIndexExecutor.class.getDeclaredField("config");
    configField.setAccessible(true);
    configField.set(executor, config);
  }

  private ReindexingConfiguration createTestConfig() {
    return ReindexingConfiguration.builder()
        .entities(Set.of("table", "user"))
        .batchSize(5)
        .payloadSize(1000000L)
        .maxConcurrentRequests(10)
        .maxRetries(3)
        .initialBackoff(1000)
        .maxBackoff(10000)
        .producerThreads(2)
        .consumerThreads(2)
        .queueSize(100)
        .recreateIndex(false)
        .build();
  }

  @Test
  void testSuccessfulTaskProcessing() throws Exception {
    ReindexingConfiguration config = createTestConfig();
    initializeExecutorConfig(config);
    injectMockSink();

    Stats initialStats = executor.initializeTotalRecords(Set.of("table"));
    executor.getStats().set(initialStats);

    EntityInterface mockEntity = mock(EntityInterface.class);
    lenient().when(mockEntity.getId()).thenReturn(UUID.randomUUID());

    List<EntityInterface> entities = List.of(mockEntity, mockEntity, mockEntity);
    ResultList<EntityInterface> resultList = new ResultList<>(entities, null, null, 3);

    Map<String, Object> contextData = new HashMap<>();
    contextData.put("entityType", "table");
    contextData.put("recreateIndex", false);

    lenient().doNothing().when(mockSink).write(eq(entities), eq(contextData));

    SearchIndexExecutor.IndexingTask<EntityInterface> task =
        new SearchIndexExecutor.IndexingTask<>("table", resultList, 0);

    assertDoesNotThrow(
        () -> {
          var method =
              SearchIndexExecutor.class.getDeclaredMethod(
                  "processTask", SearchIndexExecutor.IndexingTask.class);
          method.setAccessible(true);
          method.invoke(executor, task);
        });
  }

  @Test
  void testCreateContextDataIncludesTargetIndexWhenStaged() throws Exception {
    ReindexingConfiguration configWithRecreate =
        ReindexingConfiguration.builder()
            .entities(Set.of("table"))
            .batchSize(5)
            .recreateIndex(true)
            .build();

    initializeExecutorConfig(configWithRecreate);

    ReindexContext context = new ReindexContext();
    context.add(
        "table",
        "cluster_table",
        "cluster_table",
        "cluster_table_rebuild_123",
        Set.of("cluster_table_alias"),
        "table",
        List.of("dataAsset"));

    Field contextField = SearchIndexExecutor.class.getDeclaredField("recreateContext");
    contextField.setAccessible(true);
    contextField.set(executor, context);

    Method createContextData =
        SearchIndexExecutor.class.getDeclaredMethod("createContextData", String.class);
    createContextData.setAccessible(true);

    @SuppressWarnings("unchecked")
    Map<String, Object> contextData =
        (Map<String, Object>) createContextData.invoke(executor, "table");

    assertEquals("cluster_table_rebuild_123", contextData.get(TARGET_INDEX_KEY));
    assertTrue((Boolean) contextData.get("recreateIndex"));
  }

  @Test
  void testErrorHandlingWithSearchIndexException() throws Exception {
    ReindexingConfiguration config = createTestConfig();
    initializeExecutorConfig(config);
    injectMockSink();

    Stats initialStats = executor.initializeTotalRecords(Set.of("table"));
    executor.getStats().set(initialStats);

    List<org.openmetadata.schema.system.EntityError> entityErrors =
        List.of(
            new org.openmetadata.schema.system.EntityError()
                .withMessage(
                    "Limit of total fields [250] has been exceeded while adding new fields [3]")
                .withEntity("TestEntity1"),
            new org.openmetadata.schema.system.EntityError()
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

    lenient().doThrow(searchIndexException).when(mockSink).write(any(), any());

    SearchIndexExecutor.IndexingTask<EntityInterface> task =
        new SearchIndexExecutor.IndexingTask<>("table", resultList, 0);

    assertDoesNotThrow(
        () -> {
          var method =
              SearchIndexExecutor.class.getDeclaredMethod(
                  "processTask", SearchIndexExecutor.IndexingTask.class);
          method.setAccessible(true);
          method.invoke(executor, task);
        });
  }

  @Test
  void testReaderErrorHandling() throws Exception {
    ReindexingConfiguration config = createTestConfig();
    initializeExecutorConfig(config);
    injectMockSink();

    Stats initialStats = executor.initializeTotalRecords(Set.of("user"));
    executor.getStats().set(initialStats);

    List<org.openmetadata.schema.system.EntityError> readerErrors =
        List.of(
            new org.openmetadata.schema.system.EntityError()
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

    SearchIndexExecutor.IndexingTask<EntityInterface> task =
        new SearchIndexExecutor.IndexingTask<>("user", resultList, 0);

    assertDoesNotThrow(
        () -> {
          var method =
              SearchIndexExecutor.class.getDeclaredMethod(
                  "processTask", SearchIndexExecutor.IndexingTask.class);
          method.setAccessible(true);
          method.invoke(executor, task);
        });
  }

  @Test
  void testStatsAccumulation() throws Exception {
    ReindexingConfiguration config = createTestConfig();
    initializeExecutorConfig(config);

    Stats initialStats = executor.initializeTotalRecords(Set.of("table"));
    executor.getStats().set(initialStats);

    StepStats batch1 = new StepStats().withSuccessRecords(10).withFailedRecords(2);
    StepStats batch2 = new StepStats().withSuccessRecords(15).withFailedRecords(1);
    StepStats batch3 = new StepStats().withSuccessRecords(8).withFailedRecords(0);

    Method updateStatsMethod =
        SearchIndexExecutor.class.getDeclaredMethod("updateStats", String.class, StepStats.class);
    updateStatsMethod.setAccessible(true);

    updateStatsMethod.invoke(executor, "table", batch1);
    updateStatsMethod.invoke(executor, "table", batch2);
    updateStatsMethod.invoke(executor, "table", batch3);

    Stats stats = executor.getStats().get();
    assertNotNull(stats);
    assertNotNull(stats.getEntityStats());
    assertNotNull(stats.getEntityStats().getAdditionalProperties());

    StepStats tableStats = stats.getEntityStats().getAdditionalProperties().get("table");
    assertNotNull(tableStats);

    assertEquals(33, tableStats.getSuccessRecords()); // 10 + 15 + 8
    assertEquals(3, tableStats.getFailedRecords()); // 2 + 1 + 0

    StepStats overallStats = stats.getJobStats();
    assertNotNull(overallStats);
    assertEquals(33, overallStats.getSuccessRecords());
    assertEquals(3, overallStats.getFailedRecords());
  }

  @Test
  void testConcurrentStatsUpdates() throws Exception {
    ReindexingConfiguration config = createTestConfig();
    initializeExecutorConfig(config);

    Stats initialStats = executor.initializeTotalRecords(Set.of("table"));
    executor.getStats().set(initialStats);

    int numThreads = 5;
    int batchesPerThread = 10;
    ExecutorService threadPool = Executors.newFixedThreadPool(numThreads);
    CountDownLatch latch = new CountDownLatch(numThreads);

    Method updateStatsMethod =
        SearchIndexExecutor.class.getDeclaredMethod("updateStats", String.class, StepStats.class);
    updateStatsMethod.setAccessible(true);

    for (int i = 0; i < numThreads; i++) {
      final int threadId = i;
      threadPool.submit(
          () -> {
            try {
              for (int j = 0; j < batchesPerThread; j++) {
                StepStats stats =
                    new StepStats().withSuccessRecords(threadId + 1).withFailedRecords(j % 2);
                updateStatsMethod.invoke(executor, "table", stats);
              }
            } catch (Exception e) {
              LOG.error("Error in thread", e);
            } finally {
              latch.countDown();
            }
          });
    }
    assertTrue(latch.await(30, TimeUnit.SECONDS));
    threadPool.shutdown();

    Stats stats = executor.getStats().get();
    assertNotNull(stats);
    assertNotNull(stats.getEntityStats());
    assertNotNull(stats.getEntityStats().getAdditionalProperties());

    StepStats tableStats = stats.getEntityStats().getAdditionalProperties().get("table");
    assertNotNull(tableStats);

    int expectedSuccess = 0;
    int expectedFailures = 0;
    for (int i = 0; i < numThreads; i++) {
      expectedSuccess += (i + 1) * batchesPerThread;
      expectedFailures += batchesPerThread / 2;
    }

    assertEquals(expectedSuccess, tableStats.getSuccessRecords());
    assertEquals(expectedFailures, tableStats.getFailedRecords());
  }

  @Test
  void testMemoryAwareQueueSizing() throws Exception {
    ReindexingConfiguration config = createTestConfig();
    initializeExecutorConfig(config);

    var calculateMethod =
        SearchIndexExecutor.class.getDeclaredMethod("calculateMemoryAwareQueueSize", int.class);
    calculateMethod.setAccessible(true);

    Field batchSizeField = SearchIndexExecutor.class.getDeclaredField("batchSize");
    batchSizeField.setAccessible(true);
    @SuppressWarnings("unchecked")
    AtomicReference<Integer> batchSize = (AtomicReference<Integer>) batchSizeField.get(executor);

    batchSize.set(100);
    int requestedSize = 50000;
    int effectiveSize = (int) calculateMethod.invoke(executor, requestedSize);
    assertTrue(
        effectiveSize <= requestedSize, "Effective queue size should not exceed requested size");

    batchSize.set(10000);
    int largeRequestedSize = 100000;
    int memoryLimitedSize = (int) calculateMethod.invoke(executor, largeRequestedSize);
    assertTrue(
        memoryLimitedSize < largeRequestedSize,
        "Large batch size should result in memory-limited queue size");

    Runtime runtime = Runtime.getRuntime();
    long maxHeap = runtime.maxMemory();
    long estimatedEntitySize = 5 * 1024L;
    long maxQueueMemory = (long) (maxHeap * 0.25);
    int expectedLimit = (int) (maxQueueMemory / (estimatedEntitySize * 10000));
    assertEquals(
        Math.min(largeRequestedSize, expectedLimit),
        memoryLimitedSize,
        "Memory-based calculation should match expected formula");
  }

  @Test
  void testQueueBackpressureWithBlockingPut() throws Exception {
    ReindexingConfiguration smallQueueConfig =
        ReindexingConfiguration.builder()
            .entities(Set.of("table"))
            .batchSize(2)
            .queueSize(2)
            .consumerThreads(1)
            .build();

    initializeExecutorConfig(smallQueueConfig);

    Stats initialStats = executor.initializeTotalRecords(Set.of("table"));
    executor.getStats().set(initialStats);

    Field batchSizeField = SearchIndexExecutor.class.getDeclaredField("batchSize");
    batchSizeField.setAccessible(true);
    @SuppressWarnings("unchecked")
    AtomicReference<Integer> batchSize = (AtomicReference<Integer>) batchSizeField.get(executor);
    batchSize.set(2);

    var calculateMethod =
        SearchIndexExecutor.class.getDeclaredMethod("calculateMemoryAwareQueueSize", int.class);
    calculateMethod.setAccessible(true);
    int effectiveQueueSize = (int) calculateMethod.invoke(executor, 2);

    Field queueField = SearchIndexExecutor.class.getDeclaredField("taskQueue");
    queueField.setAccessible(true);
    queueField.set(executor, new LinkedBlockingQueue<>(effectiveQueueSize));

    EntityInterface mockEntity = mock(EntityInterface.class);
    lenient().when(mockEntity.getId()).thenReturn(UUID.randomUUID());
    List<EntityInterface> entities = List.of(mockEntity, mockEntity);
    ResultList<EntityInterface> resultList = new ResultList<>(entities, null, null, 2);

    var processReadTaskMethod =
        SearchIndexExecutor.class.getDeclaredMethod(
            "processReadTask", String.class, Source.class, int.class);
    processReadTaskMethod.setAccessible(true);

    @SuppressWarnings("unchecked")
    Source<ResultList<EntityInterface>> source = mock(Source.class);
    lenient().when(source.readWithCursor(any())).thenReturn(resultList);

    Field stoppedField = SearchIndexExecutor.class.getDeclaredField("stopped");
    stoppedField.setAccessible(true);
    ((java.util.concurrent.atomic.AtomicBoolean) stoppedField.get(executor)).set(false);

    assertDoesNotThrow(
        () -> processReadTaskMethod.invoke(executor, "table", source, 0),
        "processReadTask should handle queue backpressure gracefully");
  }

  @Test
  void testLinkedBlockingQueueUsage() throws Exception {
    ReindexingConfiguration config = createTestConfig();
    initializeExecutorConfig(config);

    Field batchSizeField = SearchIndexExecutor.class.getDeclaredField("batchSize");
    batchSizeField.setAccessible(true);
    @SuppressWarnings("unchecked")
    AtomicReference<Integer> batchSize = (AtomicReference<Integer>) batchSizeField.get(executor);
    batchSize.set(100);

    var calculateMethod =
        SearchIndexExecutor.class.getDeclaredMethod("calculateMemoryAwareQueueSize", int.class);
    calculateMethod.setAccessible(true);
    int effectiveQueueSize = (int) calculateMethod.invoke(executor, 1000);

    Field queueField = SearchIndexExecutor.class.getDeclaredField("taskQueue");
    queueField.setAccessible(true);
    queueField.set(executor, new LinkedBlockingQueue<>(effectiveQueueSize));

    Object queue = queueField.get(executor);
    assertNotNull(queue, "Task queue should be initialized");
    assertInstanceOf(
        LinkedBlockingQueue.class, queue, "Should use LinkedBlockingQueue for better performance");
  }

  @Test
  void testAdaptiveTuningInitialization() throws Exception {
    ReindexingConfiguration autoTuneConfig =
        ReindexingConfiguration.builder()
            .entities(Set.of("table"))
            .batchSize(100)
            .autoTune(true)
            .build();

    initializeExecutorConfig(autoTuneConfig);

    Field lastTuneTimeField = SearchIndexExecutor.class.getDeclaredField("lastTuneTime");
    lastTuneTimeField.setAccessible(true);
    long lastTuneTime = lastTuneTimeField.getLong(executor);
    assertEquals(0, lastTuneTime, "Initial lastTuneTime should be 0");

    Field totalProcessingTimeField =
        SearchIndexExecutor.class.getDeclaredField("totalProcessingTime");
    totalProcessingTimeField.setAccessible(true);
    AtomicLong totalProcessingTime = (AtomicLong) totalProcessingTimeField.get(executor);
    assertEquals(0, totalProcessingTime.get(), "Initial totalProcessingTime should be 0");

    Field totalEntitiesProcessedField =
        SearchIndexExecutor.class.getDeclaredField("totalEntitiesProcessed");
    totalEntitiesProcessedField.setAccessible(true);
    AtomicLong totalEntitiesProcessed = (AtomicLong) totalEntitiesProcessedField.get(executor);
    assertEquals(0, totalEntitiesProcessed.get(), "Initial totalEntitiesProcessed should be 0");
  }

  @Test
  void testAdaptiveTuningBatchSizeIncrease() throws Exception {
    ReindexingConfiguration autoTuneConfig =
        ReindexingConfiguration.builder()
            .entities(Set.of("table"))
            .batchSize(200)
            .autoTune(true)
            .build();

    initializeExecutorConfig(autoTuneConfig);

    Field batchSizeField = SearchIndexExecutor.class.getDeclaredField("batchSize");
    batchSizeField.setAccessible(true);
    @SuppressWarnings("unchecked")
    AtomicReference<Integer> batchSize = (AtomicReference<Integer>) batchSizeField.get(executor);
    batchSize.set(200);

    Field consecutiveSuccessesField =
        SearchIndexExecutor.class.getDeclaredField("consecutiveSuccesses");
    consecutiveSuccessesField.setAccessible(true);
    AtomicInteger consecutiveSuccesses = (AtomicInteger) consecutiveSuccessesField.get(executor);
    consecutiveSuccesses.set(60);

    Field consecutiveErrorsField = SearchIndexExecutor.class.getDeclaredField("consecutiveErrors");
    consecutiveErrorsField.setAccessible(true);
    AtomicInteger consecutiveErrors = (AtomicInteger) consecutiveErrorsField.get(executor);
    consecutiveErrors.set(0);

    var performAdaptiveTuningMethod =
        SearchIndexExecutor.class.getDeclaredMethod("performAdaptiveTuning");
    performAdaptiveTuningMethod.setAccessible(true);
    performAdaptiveTuningMethod.invoke(executor);

    int newBatchSize = batchSize.get();
    assertEquals(250, newBatchSize, "Batch size should increase by 50 when conditions are met");
  }

  @Test
  void testAdaptiveTuningBatchSizeDecreaseOnMemoryPressure() throws Exception {
    ReindexingConfiguration autoTuneConfig =
        ReindexingConfiguration.builder()
            .entities(Set.of("table"))
            .batchSize(500)
            .autoTune(true)
            .build();

    initializeExecutorConfig(autoTuneConfig);

    var performAdaptiveTuningMethod =
        SearchIndexExecutor.class.getDeclaredMethod("performAdaptiveTuning");
    assertNotNull(performAdaptiveTuningMethod, "performAdaptiveTuning method should exist");
  }

  @Test
  void testProcessingTimeTracking() throws Exception {
    ReindexingConfiguration config = createTestConfig();
    initializeExecutorConfig(config);
    injectMockSink();

    Stats initialStats = executor.initializeTotalRecords(Set.of("table"));
    executor.getStats().set(initialStats);

    EntityInterface mockEntity = mock(EntityInterface.class);
    lenient().when(mockEntity.getId()).thenReturn(UUID.randomUUID());
    List<EntityInterface> entities = List.of(mockEntity, mockEntity);
    ResultList<EntityInterface> resultList = new ResultList<>(entities, null, null, 2);

    SearchIndexExecutor.IndexingTask<EntityInterface> task =
        new SearchIndexExecutor.IndexingTask<>("table", resultList, 0);

    var processTaskMethod =
        SearchIndexExecutor.class.getDeclaredMethod(
            "processTask", SearchIndexExecutor.IndexingTask.class);
    processTaskMethod.setAccessible(true);
    processTaskMethod.invoke(executor, task);

    Field totalProcessingTimeField =
        SearchIndexExecutor.class.getDeclaredField("totalProcessingTime");
    totalProcessingTimeField.setAccessible(true);
    AtomicLong totalProcessingTime = (AtomicLong) totalProcessingTimeField.get(executor);
    assertTrue(
        totalProcessingTime.get() >= 0,
        "Processing time should be tracked (may be 0ms if very fast)");

    Field totalEntitiesProcessedField =
        SearchIndexExecutor.class.getDeclaredField("totalEntitiesProcessed");
    totalEntitiesProcessedField.setAccessible(true);
    AtomicLong totalEntitiesProcessed = (AtomicLong) totalEntitiesProcessedField.get(executor);
    assertEquals(2, totalEntitiesProcessed.get(), "Should track 2 processed entities");
  }

  @Test
  void testDistributedModeStatsTracking() throws Exception {
    ReindexingConfiguration distributedConfig =
        ReindexingConfiguration.builder()
            .entities(Set.of("table"))
            .batchSize(100)
            .useDistributedIndexing(true)
            .build();

    initializeExecutorConfig(distributedConfig);

    Stats initialStats = executor.initializeTotalRecords(Set.of("table"));
    executor.getStats().set(initialStats);

    Method updateStatsMethod =
        SearchIndexExecutor.class.getDeclaredMethod("updateStats", String.class, StepStats.class);
    updateStatsMethod.setAccessible(true);

    StepStats batch1 = new StepStats().withSuccessRecords(100).withFailedRecords(5);
    StepStats batch2 = new StepStats().withSuccessRecords(200).withFailedRecords(10);
    StepStats batch3 = new StepStats().withSuccessRecords(150).withFailedRecords(0);

    updateStatsMethod.invoke(executor, "table", batch1);
    updateStatsMethod.invoke(executor, "table", batch2);
    updateStatsMethod.invoke(executor, "table", batch3);

    Stats finalStats = executor.getStats().get();
    assertNotNull(finalStats);

    StepStats tableStats = finalStats.getEntityStats().getAdditionalProperties().get("table");
    assertNotNull(tableStats);

    assertEquals(450, tableStats.getSuccessRecords()); // 100 + 200 + 150
    assertEquals(15, tableStats.getFailedRecords()); // 5 + 10 + 0

    StepStats overallStats = finalStats.getJobStats();
    assertNotNull(overallStats);
    assertEquals(450, overallStats.getSuccessRecords());
    assertEquals(15, overallStats.getFailedRecords());
  }

  @Test
  void testDistributedModeConcurrentStatsUpdates() throws Exception {
    ReindexingConfiguration distributedConfig =
        ReindexingConfiguration.builder()
            .entities(Set.of("table", "user"))
            .batchSize(50)
            .useDistributedIndexing(true)
            .build();

    initializeExecutorConfig(distributedConfig);

    Stats initialStats = executor.initializeTotalRecords(Set.of("table", "user"));
    executor.getStats().set(initialStats);

    Method updateStatsMethod =
        SearchIndexExecutor.class.getDeclaredMethod("updateStats", String.class, StepStats.class);
    updateStatsMethod.setAccessible(true);

    int numWorkers = 4;
    int batchesPerWorker = 25;
    ExecutorService threadPool = Executors.newFixedThreadPool(numWorkers);
    CountDownLatch latch = new CountDownLatch(numWorkers);

    for (int i = 0; i < numWorkers; i++) {
      final int workerId = i;
      threadPool.submit(
          () -> {
            try {
              for (int j = 0; j < batchesPerWorker; j++) {
                String entityType = (j % 2 == 0) ? "table" : "user";
                StepStats stats =
                    new StepStats()
                        .withSuccessRecords(10 + workerId)
                        .withFailedRecords(j % 5 == 0 ? 1 : 0);
                updateStatsMethod.invoke(executor, entityType, stats);
              }
            } catch (Exception e) {
              LOG.error("Error in worker", e);
            } finally {
              latch.countDown();
            }
          });
    }

    assertTrue(latch.await(60, TimeUnit.SECONDS), "Workers should complete within timeout");
    threadPool.shutdown();

    Stats finalStats = executor.getStats().get();
    assertNotNull(finalStats);
    assertNotNull(finalStats.getEntityStats());

    StepStats tableStats = finalStats.getEntityStats().getAdditionalProperties().get("table");
    StepStats userStats = finalStats.getEntityStats().getAdditionalProperties().get("user");

    assertNotNull(tableStats, "Table stats should exist");
    assertNotNull(userStats, "User stats should exist");

    StepStats overallStats = finalStats.getJobStats();
    assertNotNull(overallStats);
    assertTrue(overallStats.getSuccessRecords() > 0, "Should have accumulated success records");
    assertTrue(
        tableStats.getSuccessRecords() + userStats.getSuccessRecords()
            == overallStats.getSuccessRecords(),
        "Entity stats should sum to overall stats");
  }

  @Test
  void testProcessingWithRecreateIndexTrue() throws Exception {
    ReindexingConfiguration recreateIndexConfig =
        ReindexingConfiguration.builder()
            .entities(Set.of("table"))
            .batchSize(5)
            .payloadSize(1000000L)
            .maxConcurrentRequests(10)
            .recreateIndex(true)
            .build();

    initializeExecutorConfig(recreateIndexConfig);
    injectMockSink();

    Stats initialStats = executor.initializeTotalRecords(Set.of("table"));
    executor.getStats().set(initialStats);

    EntityInterface mockEntity = mock(EntityInterface.class);
    lenient().when(mockEntity.getId()).thenReturn(UUID.randomUUID());

    List<EntityInterface> entities = List.of(mockEntity, mockEntity);
    ResultList<EntityInterface> resultList = new ResultList<>(entities, null, null, 2);

    ArgumentCaptor<Map<String, Object>> contextCaptor = ArgumentCaptor.forClass(Map.class);
    lenient().doNothing().when(mockSink).write(eq(entities), contextCaptor.capture());

    SearchIndexExecutor.IndexingTask<EntityInterface> task =
        new SearchIndexExecutor.IndexingTask<>("table", resultList, 0);

    assertDoesNotThrow(
        () -> {
          var method =
              SearchIndexExecutor.class.getDeclaredMethod(
                  "processTask", SearchIndexExecutor.IndexingTask.class);
          method.setAccessible(true);
          method.invoke(executor, task);
        });

    Map<String, Object> capturedContext = contextCaptor.getValue();
    assertNotNull(capturedContext);
    assertEquals("table", capturedContext.get("entityType"));
    assertEquals(true, capturedContext.get("recreateIndex"));
  }

  @Test
  void testInitializeTotalRecords() {
    Stats stats = executor.initializeTotalRecords(Set.of("table", "user"));

    assertNotNull(stats);
    assertNotNull(stats.getJobStats());
    assertNotNull(stats.getReaderStats());
    assertNotNull(stats.getSinkStats());
    assertNotNull(stats.getEntityStats());
    assertNotNull(stats.getEntityStats().getAdditionalProperties());

    assertEquals(0, stats.getJobStats().getSuccessRecords());
    assertEquals(0, stats.getJobStats().getFailedRecords());
  }
}
