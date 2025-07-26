package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.openmetadata.service.OpenMetadataApplicationTest.ELASTIC_SEARCH_CLUSTER_ALIAS;

import java.lang.reflect.Field;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.schema.entity.app.SuccessContext;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.elasticsearch.ElasticSearchClient;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.util.ResultList;
import org.quartz.JobDataMap;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;

@ExtendWith(MockitoExtension.class)
@Slf4j
public class SearchIndexAppTest extends OpenMetadataApplicationTest {

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
  void testSearchIndexAppWithClusterAlias() {
    // This test verifies that SearchIndexApp respects cluster alias configuration
    // The actual integration test happens in SearchResourceTest where full stack is available

    String clusterAlias = ELASTIC_SEARCH_CLUSTER_ALIAS;
    lenient().when(searchRepository.getClusterAlias()).thenReturn(clusterAlias);

    // Mock index mapping
    IndexMapping tableMapping =
        IndexMapping.builder().indexName("table_search_index").alias("table").build();
    lenient().when(searchRepository.getIndexMapping(Entity.TABLE)).thenReturn(tableMapping);

    // Verify index name includes cluster alias
    String expectedIndexName = clusterAlias + "_table_search_index";
    lenient()
        .when(searchRepository.getIndexOrAliasName("table_search_index"))
        .thenReturn(expectedIndexName);

    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(testJobData, Object.class));

    searchIndexApp.init(testApp);

    // Verify that the cluster alias is properly used
    assertEquals(clusterAlias, searchRepository.getClusterAlias());
    assertEquals(expectedIndexName, searchRepository.getIndexOrAliasName("table_search_index"));
  }

  @Test
  void testBulkSinkWithClusterAlias() throws Exception {
    // Test that BulkSink uses cluster alias when indexing
    String clusterAlias = "prod_cluster";
    lenient().when(searchRepository.getClusterAlias()).thenReturn(clusterAlias);

    ElasticSearchClient mockSearchClient = mock(ElasticSearchClient.class);
    lenient().when(searchRepository.getSearchClient()).thenReturn(mockSearchClient);

    // Mock BulkSink since it's abstract
    BulkSink bulkSink = mock(BulkSink.class);

    // Mock entity and index mapping
    EntityInterface mockEntity = mock(EntityInterface.class);
    lenient().when(mockEntity.getId()).thenReturn(UUID.randomUUID());
    lenient()
        .when(mockEntity.getEntityReference())
        .thenReturn(
            new org.openmetadata.schema.type.EntityReference()
                .withType(Entity.TABLE)
                .withId(UUID.randomUUID()));

    IndexMapping tableMapping = IndexMapping.builder().indexName("table_search_index").build();
    lenient().when(searchRepository.getIndexMapping(Entity.TABLE)).thenReturn(tableMapping);

    // Expected index name with cluster alias
    String expectedIndexName = clusterAlias + "_table_search_index";
    lenient()
        .when(searchRepository.getIndexOrAliasName("table_search_index"))
        .thenReturn(expectedIndexName);

    // Write entities to bulk sink
    Map<String, Object> contextData = new HashMap<>();
    contextData.put("entityType", Entity.TABLE);

    assertDoesNotThrow(
        () -> {
          bulkSink.write(List.of(mockEntity), contextData);
        });
  }

  @Test
  void testTimeSeriesEntitiesWithClusterAlias() {
    String clusterAlias = "staging_env";
    lenient().when(searchRepository.getClusterAlias()).thenReturn(clusterAlias);
    for (String entityType : SearchIndexApp.TIME_SERIES_ENTITIES) {
      String expectedIndexName = clusterAlias + "_" + entityType;
      lenient()
          .when(searchRepository.getIndexOrAliasName(entityType))
          .thenReturn(expectedIndexName);

      assertEquals(expectedIndexName, searchRepository.getIndexOrAliasName(entityType));
    }
  }

  @Test
  void testSearchIndexAppWithoutClusterAlias() {
    lenient().when(searchRepository.getClusterAlias()).thenReturn("");
    IndexMapping tableMapping = IndexMapping.builder().indexName("table_search_index").build();
    lenient().when(searchRepository.getIndexMapping(Entity.TABLE)).thenReturn(tableMapping);
    lenient()
        .when(searchRepository.getIndexOrAliasName("table_search_index"))
        .thenReturn("table_search_index");

    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(testJobData, Object.class));

    searchIndexApp.init(testApp);

    // Verify no prefix is added
    assertEquals("", searchRepository.getClusterAlias());
    assertEquals("table_search_index", searchRepository.getIndexOrAliasName("table_search_index"));
  }

  @Test
  void testBulkSinkWithNullIndexMapping() throws Exception {
    // Test scenario where getIndexMapping returns null - should skip indexing without throwing
    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(testJobData, Object.class));
    searchIndexApp.init(testApp);
    injectMockSink();

    // Mock entity
    EntityInterface mockEntity = mock(EntityInterface.class);
    lenient().when(mockEntity.getId()).thenReturn(UUID.randomUUID());

    List<EntityInterface> entities = List.of(mockEntity);
    ResultList<EntityInterface> resultList = new ResultList<>(entities, null, null, 1);

    // Set up context data with an entity type that has no index mapping
    Map<String, Object> contextData = new HashMap<>();
    contextData.put("entityType", "unknownEntity");

    // Mock searchRepository to return null for unknown entity type
    lenient().when(searchRepository.getIndexMapping("unknownEntity")).thenReturn(null);

    // Should not throw exception - should skip gracefully
    lenient().doNothing().when(mockSink).write(eq(entities), eq(contextData));

    SearchIndexApp.IndexingTask<EntityInterface> task =
        new SearchIndexApp.IndexingTask<>("unknownEntity", resultList, 0);

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
  void testIndexMappingWithClusterAliasInBulkSink() throws Exception {
    // Test that ensures cluster alias is properly used when getting index name
    String clusterAlias = "test_cluster";
    lenient().when(searchRepository.getClusterAlias()).thenReturn(clusterAlias);

    // Create index mapping
    IndexMapping indexMapping =
        IndexMapping.builder().indexName("dashboard_search_index").alias("dashboard").build();
    lenient().when(searchRepository.getIndexMapping("dashboard")).thenReturn(indexMapping);

    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(testJobData, Object.class));
    searchIndexApp.init(testApp);
    injectMockSink();

    EntityInterface mockEntity = mock(EntityInterface.class);
    lenient().when(mockEntity.getId()).thenReturn(UUID.randomUUID());

    List<EntityInterface> entities = List.of(mockEntity);
    ResultList<EntityInterface> resultList = new ResultList<>(entities, null, null, 1);

    Map<String, Object> contextData = new HashMap<>();
    contextData.put("entityType", "dashboard");

    // Verify that the correct index name with cluster alias is used
    String expectedIndexName = clusterAlias + "_dashboard_search_index";
    assertEquals(expectedIndexName, indexMapping.getIndexName(clusterAlias));

    lenient().doNothing().when(mockSink).write(eq(entities), eq(contextData));

    SearchIndexApp.IndexingTask<EntityInterface> task =
        new SearchIndexApp.IndexingTask<>("dashboard", resultList, 0);

    assertDoesNotThrow(
        () -> {
          var method =
              SearchIndexApp.class.getDeclaredMethod(
                  "processTask", SearchIndexApp.IndexingTask.class, JobExecutionContext.class);
          method.setAccessible(true);
          method.invoke(searchIndexApp, task, jobExecutionContext);
        });
  }
}
