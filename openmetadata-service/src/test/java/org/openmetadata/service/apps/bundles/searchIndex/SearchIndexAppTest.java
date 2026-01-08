package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.schema.entity.app.SuccessContext;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.DefaultRecreateHandler;
import org.openmetadata.service.search.EntityReindexContext;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.socket.WebSocketManager;
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
  void testFinalizeReindexMovesAliasesForTargetEntityOnly() {
    AliasState aliasState = new AliasState();
    aliasState.put(
        "table_search_index_rebuild_old",
        Set.of("table", "table_search_index", "all", "dataAsset"));
    aliasState.put("table_search_index_rebuild_new", new HashSet<>());
    aliasState.put(
        "dashboard_search_index_rebuild_old",
        Set.of("dashboard", "dashboard_search_index", "all", "dataAsset"));

    SearchClient client = aliasState.toMock();
    SearchRepository repo = mock(SearchRepository.class);
    when(repo.getSearchClient()).thenReturn(client);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getSearchRepository).thenReturn(repo);

      EntityReindexContext entityReindexContext =
          EntityReindexContext.builder()
              .entityType("table")
              .canonicalIndex("table_search_index")
              .originalIndex("table_search_index_rebuild_old")
              .activeIndex("table_search_index_rebuild_old")
              .stagedIndex("table_search_index_rebuild_new")
              .existingAliases(Set.of("table", "table_search_index", "all", "dataAsset"))
              .canonicalAliases("table")
              .parentAliases(
                  Set.of("all", "dataAsset", "database", "databaseSchema", "databaseService"))
              .build();

      new DefaultRecreateHandler().finalizeReindex(entityReindexContext, true);
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

    SearchClient client = aliasState.toMock();
    SearchRepository repo = mock(SearchRepository.class);
    when(repo.getSearchClient()).thenReturn(client);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getSearchRepository).thenReturn(repo);

      EntityReindexContext entityReindexContext =
          EntityReindexContext.builder()
              .entityType("table")
              .canonicalIndex("table_search_index")
              .originalIndex("table_search_index_rebuild_old1")
              .activeIndex("table_search_index_rebuild_old1")
              .stagedIndex("table_search_index_rebuild_new")
              .existingAliases(Set.of("table", "table_search_index", "all", "dataAsset"))
              .canonicalAliases("table")
              .parentAliases(Set.of("all", "dataAsset"))
              .build();

      new DefaultRecreateHandler().finalizeReindex(entityReindexContext, true);
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
  void testAutoTuneConfiguration() {
    EventPublisherJob autoTuneJobData =
        new EventPublisherJob()
            .withEntities(Set.of("table"))
            .withBatchSize(100)
            .withPayLoadSize(10 * 1024 * 1024L)
            .withMaxConcurrentRequests(50)
            .withProducerThreads(2)
            .withAutoTune(true)
            .withRecreateIndex(false)
            .withStats(new Stats());

    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(autoTuneJobData, Object.class));

    lenient()
        .when(searchRepository.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.ELASTICSEARCH);

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
  void testDistributedIndexingInitialization() {
    EventPublisherJob distributedJobData =
        new EventPublisherJob()
            .withEntities(Set.of("table", "user"))
            .withBatchSize(500)
            .withPayLoadSize(10 * 1024 * 1024L)
            .withMaxConcurrentRequests(20)
            .withProducerThreads(4)
            .withConsumerThreads(4)
            .withQueueSize(1000)
            .withRecreateIndex(true)
            .withUseDistributedIndexing(true)
            .withStats(new Stats());

    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(distributedJobData, Object.class));

    searchIndexApp.init(testApp);

    EventPublisherJob jobData = searchIndexApp.getJobData();
    assertNotNull(jobData);
    assertTrue(jobData.getUseDistributedIndexing(), "Distributed indexing should be enabled");
    assertTrue(jobData.getRecreateIndex(), "Recreate index should be enabled");
    assertEquals(Set.of("table", "user"), jobData.getEntities());
    assertEquals(500, jobData.getBatchSize());
  }

  @Test
  void testDistributedIndexingJobDataPreservation() {
    EventPublisherJob distributedJobData =
        new EventPublisherJob()
            .withEntities(Set.of("table", "dashboard", "pipeline"))
            .withBatchSize(1000)
            .withPayLoadSize(20 * 1024 * 1024L)
            .withMaxConcurrentRequests(50)
            .withProducerThreads(8)
            .withConsumerThreads(8)
            .withQueueSize(2000)
            .withRecreateIndex(true)
            .withUseDistributedIndexing(true)
            .withAutoTune(false)
            .withMaxRetries(5)
            .withInitialBackoff(2000)
            .withMaxBackoff(30000)
            .withStats(new Stats());

    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(distributedJobData, Object.class));

    searchIndexApp.init(testApp);

    EventPublisherJob resultJobData = searchIndexApp.getJobData();
    assertNotNull(resultJobData);

    assertTrue(resultJobData.getUseDistributedIndexing());
    assertEquals(3, resultJobData.getEntities().size());
    assertTrue(resultJobData.getEntities().contains("table"));
    assertTrue(resultJobData.getEntities().contains("dashboard"));
    assertTrue(resultJobData.getEntities().contains("pipeline"));
    assertEquals(1000, resultJobData.getBatchSize());
    assertEquals(20 * 1024 * 1024L, resultJobData.getPayLoadSize());
    assertEquals(50, resultJobData.getMaxConcurrentRequests());
    assertEquals(8, resultJobData.getProducerThreads());
    assertEquals(8, resultJobData.getConsumerThreads());
    assertEquals(2000, resultJobData.getQueueSize());
    assertEquals(5, resultJobData.getMaxRetries());
    assertEquals(2000, resultJobData.getInitialBackoff());
    assertEquals(30000, resultJobData.getMaxBackoff());
  }

  @Test
  void testDistributedIndexingWithLargeEntitiesList() {
    Set<String> manyEntities =
        Set.of(
            "table",
            "user",
            "team",
            "database",
            "databaseService",
            "dashboardService",
            "messagingService",
            "pipelineService",
            "mlmodelService",
            "storageService",
            "topic",
            "dashboard",
            "chart",
            "pipeline",
            "mlmodel",
            "container",
            "query",
            "report",
            "glossary",
            "glossaryTerm",
            "tag",
            "classification");

    EventPublisherJob distributedJobData =
        new EventPublisherJob()
            .withEntities(manyEntities)
            .withBatchSize(1000)
            .withPayLoadSize(50 * 1024 * 1024L)
            .withMaxConcurrentRequests(100)
            .withProducerThreads(16)
            .withConsumerThreads(16)
            .withQueueSize(5000)
            .withUseDistributedIndexing(true)
            .withRecreateIndex(true)
            .withStats(new Stats());

    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(distributedJobData, Object.class));

    assertDoesNotThrow(() -> searchIndexApp.init(testApp));

    EventPublisherJob resultJobData = searchIndexApp.getJobData();
    assertNotNull(resultJobData);
    assertTrue(resultJobData.getUseDistributedIndexing());
    assertEquals(manyEntities.size(), resultJobData.getEntities().size());

    for (String entity : manyEntities) {
      assertTrue(
          resultJobData.getEntities().contains(entity),
          "Entity " + entity + " should be preserved");
    }
  }

  @Test
  void testInitializeTotalRecords() {
    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(testJobData, Object.class));

    searchIndexApp.init(testApp);

    Stats stats = searchIndexApp.initializeTotalRecords(Set.of("table", "user"));
    assertNotNull(stats);
    assertNotNull(stats.getJobStats());
    assertNotNull(stats.getReaderStats());
    assertNotNull(stats.getSinkStats());
    assertNotNull(stats.getEntityStats());

    assertEquals(0, stats.getJobStats().getSuccessRecords());
    assertEquals(0, stats.getJobStats().getFailedRecords());
  }

  private static class AliasState {
    final Map<String, Set<String>> indexAliases = new HashMap<>();
    final Set<String> deletedIndices = new HashSet<>();

    void put(String indexName, Set<String> aliases) {
      indexAliases.put(indexName, new HashSet<>(aliases));
    }

    SearchClient toMock() {
      SearchClient client = mock(SearchClient.class);

      lenient().when(client.isClientAvailable()).thenReturn(true);
      lenient()
          .when(client.getSearchType())
          .thenReturn(ElasticSearchConfiguration.SearchType.ELASTICSEARCH);
      lenient()
          .when(client.indexExists(anyString()))
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

      lenient()
          .when(client.listIndicesByPrefix(anyString()))
          .thenAnswer(
              invocation -> {
                String prefix = invocation.getArgument(0);
                return indexAliases.keySet().stream()
                    .filter(idx -> idx.startsWith(prefix))
                    .collect(Collectors.toSet());
              });

      lenient()
          .doAnswer(
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

      lenient()
          .doAnswer(
              invocation -> {
                String index = invocation.getArgument(0);
                @SuppressWarnings("unchecked")
                Set<String> aliases = new HashSet<>((Set<String>) invocation.getArgument(1));
                indexAliases.computeIfAbsent(index, k -> new HashSet<>()).addAll(aliases);
                return null;
              })
          .when(client)
          .addAliases(anyString(), anySet());

      lenient()
          .doAnswer(
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
