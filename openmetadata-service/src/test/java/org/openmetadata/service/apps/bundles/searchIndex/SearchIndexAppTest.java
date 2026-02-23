package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flipkart.zjsonpatch.JsonDiff;
import io.dropwizard.testing.ResourceHelpers;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer.OrderAnnotation;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.api.services.CreateMessagingService;
import org.openmetadata.schema.api.services.CreateMessagingService.MessagingServiceType;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.schema.entity.app.SuccessContext;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.type.AccessDetails;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.LifeCycle;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.DistributedSearchIndexCoordinator;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.IndexJobStatus;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.PartitionCalculator;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.PartitionStatus;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.DefaultRecreateHandler;
import org.openmetadata.service.search.EntityReindexContext;
import org.openmetadata.service.search.ReindexContext;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.util.OpenMetadataOperations;
import org.openmetadata.service.util.TestUtils;
import org.quartz.JobDataMap;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;
import picocli.CommandLine;

@ExtendWith(MockitoExtension.class)
@TestMethodOrder(OrderAnnotation.class)
@Slf4j
class SearchIndexAppTest extends OpenMetadataApplicationTest {

  static {
    runWithOpensearch = true;
    runWithVectorEmbeddings = true;
  }

  // --- Mock fields for unit tests ---
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

  // --- Vector embedding test fields ---
  private DatabaseService vectorTestService;
  private Database vectorTestDb;
  private DatabaseSchema vectorTestSchema;
  private Table vectorTable1;
  private Table vectorTable2;
  private Table reembedTable;

  private static final String REEMBED_CONFIG_PATH =
      ResourceHelpers.resourceFilePath("openmetadata-secure-test.yaml");

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
  }

  // =========================================================================
  // Vector embedding integration tests (ordered, run first)
  // =========================================================================

  @Test
  @Order(1)
  void testCreateVectorEmbeddingSampleData() throws Exception {
    assertTrue(
        waitForVectorSearchAvailability(),
        "Vector search service must be available for embedding tests");

    vectorTestService =
        TestUtils.post(
            getResource("services/databaseServices"),
            createVectorTestDatabaseService("vec_test_svc_" + System.currentTimeMillis()),
            DatabaseService.class,
            ADMIN_AUTH_HEADERS);
    assertNotNull(vectorTestService);

    vectorTestDb =
        TestUtils.post(
            getResource("databases"),
            new CreateDatabase()
                .withName("vector_test_db")
                .withDescription("Database for testing vector embeddings")
                .withService(vectorTestService.getFullyQualifiedName()),
            Database.class,
            ADMIN_AUTH_HEADERS);
    assertNotNull(vectorTestDb);

    vectorTestSchema =
        TestUtils.post(
            getResource("databaseSchemas"),
            new CreateDatabaseSchema()
                .withName("vector_test_schema")
                .withDescription("Schema for testing embeddings")
                .withDatabase(vectorTestDb.getFullyQualifiedName()),
            DatabaseSchema.class,
            ADMIN_AUTH_HEADERS);
    assertNotNull(vectorTestSchema);

    vectorTable1 =
        createVectorTestTable("customers", "Customer data with demographics and purchase history");
    vectorTable2 =
        createVectorTestTable(
            "products", "Product catalog with detailed descriptions and categories");
    reembedTable =
        createVectorTestTable(
            "reembed_table",
            "Customer telemetry and demographics used to validate vector embeddings");

    assertNotNull(vectorTable1);
    assertNotNull(vectorTable2);
    assertNotNull(reembedTable);
  }

  @Test
  @Order(2)
  void testTriggerInitialSearchIndexing() throws Exception {
    triggerSearchIndexApplication(true);
    waitForIndexingCompletion();

    // Verify vector stats are populated after indexing with embeddings enabled
    Map<String, Object> appRunRecord = getAppRunRecord();
    assertNotNull(appRunRecord, "App run record should exist after indexing");

    @SuppressWarnings("unchecked")
    Map<String, Object> successCtx = (Map<String, Object>) appRunRecord.get("successContext");
    assertNotNull(successCtx, "successContext should exist for completed job");

    @SuppressWarnings("unchecked")
    Map<String, Object> statsMap = (Map<String, Object>) successCtx.get("stats");
    assertNotNull(statsMap, "stats should exist in successContext");

    @SuppressWarnings("unchecked")
    Map<String, Object> vectorStats = (Map<String, Object>) statsMap.get("vectorStats");
    assertNotNull(vectorStats, "vectorStats should be present when semantic search is enabled");

    int vectorTotal =
        vectorStats.get("totalRecords") != null
            ? ((Number) vectorStats.get("totalRecords")).intValue()
            : 0;
    assertTrue(
        vectorTotal > 0, "vectorStats.totalRecords should be > 0 after indexing with embeddings");
  }

  @Test
  @Order(3)
  void testValidateVectorEmbeddings() throws Exception {
    Map<String, Object> response = vectorSearch("customer data demographics");
    assertNotNull(response, "Vector search response should not be null");

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> hits = (List<Map<String, Object>>) response.get("hits");
    assertNotNull(hits, "Vector search hits should not be null");
    assertFalse(hits.isEmpty(), "Should find embedding results for sample tables");

    boolean foundCustomerTable =
        hits.stream()
            .map(hit -> (String) hit.get("fullyQualifiedName"))
            .filter(fqn -> fqn != null)
            .anyMatch(fqn -> fqn.contains("customers"));

    assertTrue(foundCustomerTable, "Should find customer table in embedding search results");
  }

  @Test
  @Order(4)
  void testValidateVectorEmbeddingFingerprints() throws Exception {
    Map<String, Object> fp = getFingerprint(vectorTable1.getId().toString());
    assertNotNull(fp, "Fingerprint response should not be null");
    String fingerprint = (String) fp.get("fingerprint");
    assertNotNull(fingerprint, "Should have fingerprint for embedded table");
    assertFalse(fingerprint.isEmpty(), "Fingerprint should not be empty");
  }

  @Test
  @Order(5)
  void testMigrationVsRecomputationDuringReindex() throws Exception {
    String table2Id = vectorTable2.getId().toString();
    Map<String, Object> fp2 = getFingerprint(table2Id);
    String originalFingerprint = fp2 != null ? (String) fp2.get("fingerprint") : null;

    Table currentTable =
        TestUtils.get(getResource("tables/" + table2Id), Table.class, ADMIN_AUTH_HEADERS);

    CreateTable updateRequest =
        new CreateTable()
            .withName(currentTable.getName())
            .withDisplayName(currentTable.getDisplayName())
            .withDescription(currentTable.getDescription() + " - MODIFIED FOR RECOMPUTATION TEST")
            .withDatabaseSchema(currentTable.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(currentTable.getColumns());

    TestUtils.put(getResource("tables"), updateRequest, Response.Status.OK, ADMIN_AUTH_HEADERS);

    Thread.sleep(5000);

    triggerSearchIndexApplication(true);
    waitForIndexingCompletion();

    Map<String, Object> newFp = getFingerprint(table2Id);
    String newFingerprint = newFp != null ? (String) newFp.get("fingerprint") : null;

    assertNotNull(newFingerprint, "Fingerprint should exist after recomputation");
    if (originalFingerprint != null) {
      assertNotEquals(
          originalFingerprint, newFingerprint, "Fingerprint should change for modified entity");
    }
  }

  @Test
  @Order(6)
  void testNormalReindexPreservesEmbeddings() throws Exception {
    String table1Id = vectorTable1.getId().toString();
    Map<String, Object> fp1 = getFingerprint(table1Id);
    String beforeFingerprint = fp1 != null ? (String) fp1.get("fingerprint") : null;
    assertNotNull(beforeFingerprint, "Should have fingerprint before reindex");

    triggerSearchIndexApplication(false);
    waitForIndexingCompletion();

    Map<String, Object> afterFp = getFingerprint(table1Id);
    String afterFingerprint = afterFp != null ? (String) afterFp.get("fingerprint") : null;
    assertNotNull(afterFingerprint, "Fingerprint should exist after normal reindex");

    Map<String, Object> searchResponse = vectorSearch("customer data demographics");
    assertNotNull(searchResponse, "Vector search should still work after normal reindex");

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> hits = (List<Map<String, Object>>) searchResponse.get("hits");
    assertNotNull(hits);
    assertFalse(hits.isEmpty(), "Should find existing embeddings after normal reindex");
  }

  @Test
  @Order(7)
  void testReindexWithUpdatedDescriptions() throws Exception {
    CreateTable updateCustomer =
        new CreateTable()
            .withName(vectorTable1.getName())
            .withDisplayName(vectorTable1.getDisplayName())
            .withDescription(
                "Advanced customer analytics platform with machine learning insights, "
                    + "predictive modeling for churn analysis, lifetime value calculations")
            .withDatabaseSchema(vectorTable1.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(vectorTable1.getColumns());

    TestUtils.put(getResource("tables"), updateCustomer, Response.Status.OK, ADMIN_AUTH_HEADERS);

    CreateTable updateProduct =
        new CreateTable()
            .withName(vectorTable2.getName())
            .withDisplayName(vectorTable2.getDisplayName())
            .withDescription(
                "Intelligent product recommendation engine with real-time inventory tracking, "
                    + "dynamic pricing algorithms, and automated category optimization")
            .withDatabaseSchema(vectorTable2.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(vectorTable2.getColumns());

    TestUtils.put(getResource("tables"), updateProduct, Response.Status.OK, ADMIN_AUTH_HEADERS);

    Thread.sleep(5000);

    triggerSearchIndexApplication(true);
    waitForIndexingCompletion();
  }

  @Test
  @Order(8)
  void testValidateReindexedEmbeddings() throws Exception {
    Map<String, Object> mlResults =
        vectorSearch("machine learning predictive modeling churn analysis");
    assertNotNull(mlResults, "ML search results should not be null");

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> mlHits = (List<Map<String, Object>>) mlResults.get("hits");
    assertNotNull(mlHits);
    assertFalse(mlHits.isEmpty(), "Should find results for ML terms");

    assertTrue(
        mlHits.stream()
            .anyMatch(
                hit -> {
                  String fqn = (String) hit.get("fullyQualifiedName");
                  return fqn != null && fqn.contains("customers");
                }),
        "Should find customer table with ML terms after reindexing");

    Map<String, Object> recResults =
        vectorSearch("recommendation engine dynamic pricing optimization");
    assertNotNull(recResults);

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> recHits = (List<Map<String, Object>>) recResults.get("hits");
    assertNotNull(recHits);
    assertFalse(recHits.isEmpty(), "Should find results for recommendation terms");

    assertTrue(
        recHits.stream()
            .anyMatch(
                hit -> {
                  String fqn = (String) hit.get("fullyQualifiedName");
                  return fqn != null && fqn.contains("products");
                }),
        "Should find product table with recommendation terms after reindexing");
  }

  @Test
  @Order(9)
  void testValidateEmbeddingFingerprintOptimization() throws Exception {
    Map<String, Object> customerFp = getFingerprint(vectorTable1.getId().toString());
    assertNotNull(customerFp, "Should have fingerprint for customer table");
    assertNotNull(customerFp.get("fingerprint"));

    Map<String, Object> productFp = getFingerprint(vectorTable2.getId().toString());
    assertNotNull(productFp, "Should have fingerprint for product table");
    assertNotNull(productFp.get("fingerprint"));
  }

  @Test
  @Order(10)
  void testRunReembedCli() throws Exception {
    waitForExistingJobToComplete();

    int exitCode =
        new CommandLine(new OpenMetadataOperations())
            .execute(
                "-c",
                REEMBED_CONFIG_PATH,
                "reembed",
                "--batch-size",
                "5",
                "--producer-threads",
                "2",
                "--consumer-threads",
                "2",
                "--queue-size",
                "10");

    assertEquals(0, exitCode, "OpenMetadataOperations reembed should complete successfully");
  }

  @Test
  @Order(11)
  void testValidateVectorSearchAfterReembed() throws Exception {
    int maxRetries = 10;
    long backoffMs = 5000;
    List<Map<String, Object>> hits = List.of();

    for (int attempt = 1; attempt <= maxRetries; attempt++) {
      Map<String, Object> response = vectorSearch("customer telemetry demographics");

      if (response == null) {
        if (attempt < maxRetries) {
          Thread.sleep(backoffMs * attempt);
        }
        continue;
      }

      @SuppressWarnings("unchecked")
      List<Map<String, Object>> responseHits = (List<Map<String, Object>>) response.get("hits");

      if (responseHits != null && !responseHits.isEmpty()) {
        hits = responseHits;
        break;
      }

      if (attempt < maxRetries) {
        Thread.sleep(backoffMs * attempt);
      }
    }

    assertFalse(hits.isEmpty(), "Vector search should return hits after reembed");

    assertTrue(
        hits.stream()
            .map(hit -> (String) hit.get("fullyQualifiedName"))
            .filter(fqn -> fqn != null)
            .anyMatch(fqn -> fqn.contains("reembed_table")),
        "Re-embedded table should be discoverable via vector search");
  }

  @Test
  @Order(12)
  void testCleanupVectorEmbeddingTestData() {
    safeDelete("tables", vectorTable1);
    safeDelete("tables", vectorTable2);
    safeDelete("tables", reembedTable);
    safeDelete("databaseSchemas", vectorTestSchema);
    safeDelete("databases", vectorTestDb);
    safeDelete("services/databaseServices", vectorTestService);
  }

  // =========================================================================
  // LifeCycle indexing regression test
  // =========================================================================

  @Test
  @Order(13)
  void testTopicWithLifeCycleCanBeIndexed() throws Exception {
    ObjectMapper mapper = new ObjectMapper();

    MessagingService messagingService =
        TestUtils.post(
            getResource("services/messagingServices"),
            new CreateMessagingService()
                .withName("lifecycle_test_kafka_" + System.currentTimeMillis())
                .withServiceType(MessagingServiceType.Kafka)
                .withConnection(TestUtils.KAFKA_CONNECTION),
            MessagingService.class,
            ADMIN_AUTH_HEADERS);

    Topic topic =
        TestUtils.post(
            getResource("topics"),
            new CreateTopic()
                .withName("lifecycle_test_topic")
                .withService(messagingService.getFullyQualifiedName())
                .withPartitions(1),
            Topic.class,
            ADMIN_AUTH_HEADERS);

    // PATCH the topic to add lifeCycle with an object value (accessed with timestamp)
    Topic topicForPatch =
        TestUtils.get(
            getResource("topics/" + topic.getId()).queryParam("fields", "lifeCycle"),
            Topic.class,
            ADMIN_AUTH_HEADERS);
    String originalJson = JsonUtils.pojoToJson(topicForPatch);

    LifeCycle lifeCycle =
        new LifeCycle()
            .withAccessed(
                new AccessDetails()
                    .withTimestamp(System.currentTimeMillis() / 1000)
                    .withAccessedByAProcess("lifecycle_indexing_test"));
    topicForPatch.setLifeCycle(lifeCycle);
    String updatedJson = JsonUtils.pojoToJson(topicForPatch);

    JsonNode patch = JsonDiff.asJson(mapper.readTree(originalJson), mapper.readTree(updatedJson));
    TestUtils.patch(getResource("topics/" + topic.getId()), patch, Topic.class, ADMIN_AUTH_HEADERS);

    // Trigger search indexing for topics and wait for completion
    triggerSearchIndexApplicationForEntities(Set.of("topic"), true);
    waitForIndexingCompletion();

    // Search for the topic — with the broken keyword mapping, ES rejects the lifeCycle
    // object and the document never gets indexed, so this search will return 0 hits
    boolean found = false;
    int maxRetries = 10;
    for (int attempt = 1; attempt <= maxRetries; attempt++) {
      WebTarget searchTarget =
          getResource("search/query")
              .queryParam("q", "lifecycle_test_topic")
              .queryParam("index", "topic_search_index")
              .queryParam("from", "0")
              .queryParam("size", "10");
      Response searchResponse = SecurityUtil.addHeaders(searchTarget, ADMIN_AUTH_HEADERS).get();

      if (searchResponse.getStatus() == 200) {
        String body = searchResponse.readEntity(String.class);
        JsonNode searchJson = mapper.readTree(body);
        JsonNode hits = searchJson.path("hits").path("hits");
        for (JsonNode hit : hits) {
          String fqn = hit.path("_source").path("fullyQualifiedName").asText("");
          if (fqn.contains("lifecycle_test_topic")) {
            found = true;
            break;
          }
        }
      }

      if (found) break;
      Thread.sleep(3000);
    }

    assertTrue(
        found,
        "Topic with lifeCycle should be indexed successfully and found via search. "
            + "If this fails, the topic_index_mapping.json likely has lifeCycle mapped as "
            + "'keyword' instead of 'object'.");

    // Cleanup
    safeDelete("topics", topic);
    safeDelete("services/messagingServices", messagingService);
  }

  // =========================================================================
  // Existing unit tests (mock-based, unordered - run after ordered tests)
  // =========================================================================

  @Test
  void testExecuteWithEmptyEntitiesCompletesImmediately() {
    EventPublisherJob emptyEntitiesJob =
        new EventPublisherJob().withEntities(Set.of()).withBatchSize(100).withRecreateIndex(false);

    App app =
        new App()
            .withId(java.util.UUID.randomUUID())
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(emptyEntitiesJob, Object.class));

    searchIndexApp.init(app);

    org.quartz.JobKey jobKey = org.quartz.JobKey.jobKey("TestJob");
    when(jobDetail.getKey()).thenReturn(jobKey);

    searchIndexApp.execute(jobExecutionContext);

    EventPublisherJob result = searchIndexApp.getJobData();
    assertEquals(EventPublisherJob.Status.COMPLETED, result.getStatus());
    assertNotNull(result.getStats());
  }

  @Test
  void testCheckAndUpdateJobCompletionWithZeroPartitions() {
    CollectionDAO.SearchIndexJobDAO mockJobDAO = mock(CollectionDAO.SearchIndexJobDAO.class);
    CollectionDAO.SearchIndexPartitionDAO mockPartitionDAO =
        mock(CollectionDAO.SearchIndexPartitionDAO.class);

    CollectionDAO mockDAO = mock(CollectionDAO.class);
    when(mockDAO.searchIndexJobDAO()).thenReturn(mockJobDAO);
    when(mockDAO.searchIndexPartitionDAO()).thenReturn(mockPartitionDAO);

    UUID jobId = UUID.randomUUID();
    String jobIdStr = jobId.toString();

    EventPublisherJob jobConfig =
        new EventPublisherJob()
            .withEntities(Set.of("topic"))
            .withBatchSize(100)
            .withRecreateIndex(false);

    CollectionDAO.SearchIndexJobDAO.SearchIndexJobRecord jobRecord =
        new CollectionDAO.SearchIndexJobDAO.SearchIndexJobRecord(
            jobIdStr,
            IndexJobStatus.RUNNING.name(),
            JsonUtils.pojoToJson(jobConfig),
            null,
            null,
            0,
            0,
            0,
            0,
            null,
            "test",
            System.currentTimeMillis(),
            System.currentTimeMillis(),
            null,
            System.currentTimeMillis(),
            null,
            null,
            null);

    when(mockJobDAO.findById(jobIdStr)).thenReturn(jobRecord);
    when(mockPartitionDAO.findByJobIdAndStatus(jobIdStr, PartitionStatus.PENDING.name()))
        .thenReturn(List.of());
    when(mockPartitionDAO.findByJobIdAndStatus(jobIdStr, PartitionStatus.PROCESSING.name()))
        .thenReturn(List.of());
    when(mockPartitionDAO.findByJobIdAndStatus(jobIdStr, PartitionStatus.FAILED.name()))
        .thenReturn(List.of());
    when(mockPartitionDAO.getAggregatedStats(jobIdStr)).thenReturn(null);

    DistributedSearchIndexCoordinator coordinator =
        new DistributedSearchIndexCoordinator(mockDAO, new PartitionCalculator());

    coordinator.checkAndUpdateJobCompletion(jobId);

    org.mockito.ArgumentCaptor<String> statusCaptor =
        org.mockito.ArgumentCaptor.forClass(String.class);
    org.mockito.Mockito.verify(mockJobDAO)
        .update(
            org.mockito.ArgumentMatchers.eq(jobIdStr),
            statusCaptor.capture(),
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.any());

    assertEquals(IndexJobStatus.COMPLETED.name(), statusCaptor.getValue());
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
    try (MockedStatic<WebSocketManager> wsMock = mockStatic(WebSocketManager.class)) {
      wsMock.when(WebSocketManager::getInstance).thenReturn(webSocketManager);

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
  }

  @Test
  void testWebSocketThrottling() throws Exception {
    try (MockedStatic<WebSocketManager> wsMock = mockStatic(WebSocketManager.class)) {
      wsMock.when(WebSocketManager::getInstance).thenReturn(webSocketManager);

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
  }

  @Test
  void testAppRunRecordCreation() {
    try (MockedStatic<WebSocketManager> wsMock = mockStatic(WebSocketManager.class)) {
      wsMock.when(WebSocketManager::getInstance).thenReturn(webSocketManager);

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
  void testFinalizeAllEntityReindexPromotesVectorIndexOnCompleted() throws Exception {
    AliasState aliasState = new AliasState();
    aliasState.put(
        "vector_search_index_rebuild_old", Set.of("vectorEmbedding", "vector_search_index"));
    aliasState.put("vector_search_index_rebuild_123", new HashSet<>());

    SearchClient client = aliasState.toMock();
    SearchRepository repo = mock(SearchRepository.class);
    when(repo.getSearchClient()).thenReturn(client);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getSearchRepository).thenReturn(repo);

      SearchIndexApp app = new SearchIndexApp(collectionDAO, searchRepository);

      ReindexContext context = new ReindexContext();
      context.add(
          "vectorEmbedding",
          "vector_search_index",
          "vector_search_index_rebuild_old",
          "vector_search_index_rebuild_123",
          Set.of("vectorEmbedding", "vector_search_index"),
          "vectorEmbedding",
          List.of());

      setPrivateField(app, "recreateContext", context);
      setPrivateField(app, "recreateIndexHandler", new DefaultRecreateHandler());
      setPrivateField(
          app, "jobData", new EventPublisherJob().withStatus(EventPublisherJob.Status.COMPLETED));

      var method =
          SearchIndexApp.class.getDeclaredMethod("finalizeAllEntityReindex", boolean.class);
      method.setAccessible(true);
      method.invoke(app, true);
    }

    assertTrue(
        aliasState.deletedIndices.contains("vector_search_index_rebuild_old"),
        "Old vector index should be deleted after successful promotion");
    assertTrue(
        aliasState.indexAliases.containsKey("vector_search_index_rebuild_123"),
        "Staged vector index should exist after promotion");
    assertTrue(
        aliasState.indexAliases.get("vector_search_index_rebuild_123").contains("vectorEmbedding"),
        "Staged vector index should have the vectorEmbedding alias");
  }

  @Test
  void testFinalizeAllEntityReindexPromotesVectorIndexOnActiveError() throws Exception {
    AliasState aliasState = new AliasState();
    aliasState.put(
        "vector_search_index_rebuild_old", Set.of("vectorEmbedding", "vector_search_index"));
    aliasState.put("vector_search_index_rebuild_123", new HashSet<>());

    SearchClient client = aliasState.toMock();
    SearchRepository repo = mock(SearchRepository.class);
    when(repo.getSearchClient()).thenReturn(client);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getSearchRepository).thenReturn(repo);

      SearchIndexApp app = new SearchIndexApp(collectionDAO, searchRepository);

      ReindexContext context = new ReindexContext();
      context.add(
          "vectorEmbedding",
          "vector_search_index",
          "vector_search_index_rebuild_old",
          "vector_search_index_rebuild_123",
          Set.of("vectorEmbedding", "vector_search_index"),
          "vectorEmbedding",
          List.of());

      setPrivateField(app, "recreateContext", context);
      setPrivateField(app, "recreateIndexHandler", new DefaultRecreateHandler());
      setPrivateField(
          app,
          "jobData",
          new EventPublisherJob().withStatus(EventPublisherJob.Status.ACTIVE_ERROR));

      var method =
          SearchIndexApp.class.getDeclaredMethod("finalizeAllEntityReindex", boolean.class);
      method.setAccessible(true);
      method.invoke(app, false);
    }

    assertTrue(
        aliasState.deletedIndices.contains("vector_search_index_rebuild_old"),
        "Old vector index should be deleted — ACTIVE_ERROR still promotes");
    assertTrue(
        aliasState
            .indexAliases
            .getOrDefault("vector_search_index_rebuild_123", Set.of())
            .contains("vectorEmbedding"),
        "Staged vector index should have the vectorEmbedding alias on ACTIVE_ERROR");
  }

  @Test
  void testFinalizeAllEntityReindexDeletesVectorIndexOnFailed() throws Exception {
    AliasState aliasState = new AliasState();
    aliasState.put(
        "vector_search_index_rebuild_old", Set.of("vectorEmbedding", "vector_search_index"));
    aliasState.put("vector_search_index_rebuild_123", new HashSet<>());

    SearchClient client = aliasState.toMock();
    SearchRepository repo = mock(SearchRepository.class);
    when(repo.getSearchClient()).thenReturn(client);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getSearchRepository).thenReturn(repo);

      SearchIndexApp app = new SearchIndexApp(collectionDAO, searchRepository);

      ReindexContext context = new ReindexContext();
      context.add(
          "vectorEmbedding",
          "vector_search_index",
          "vector_search_index_rebuild_old",
          "vector_search_index_rebuild_123",
          Set.of("vectorEmbedding", "vector_search_index"),
          "vectorEmbedding",
          List.of());

      setPrivateField(app, "recreateContext", context);
      setPrivateField(app, "recreateIndexHandler", new DefaultRecreateHandler());
      setPrivateField(
          app, "jobData", new EventPublisherJob().withStatus(EventPublisherJob.Status.FAILED));

      var method =
          SearchIndexApp.class.getDeclaredMethod("finalizeAllEntityReindex", boolean.class);
      method.setAccessible(true);
      method.invoke(app, false);
    }

    assertTrue(
        aliasState.deletedIndices.contains("vector_search_index_rebuild_123"),
        "Staged vector index should be deleted on FAILED status");
    assertFalse(
        aliasState.deletedIndices.contains("vector_search_index_rebuild_old"),
        "Old vector index should NOT be deleted when reindex failed");
  }

  @Test
  void testFinalizeAllEntityReindexSkipsAlreadyPromotedEntities() throws Exception {
    AliasState aliasState = new AliasState();
    aliasState.put(
        "table_search_index_rebuild_old",
        Set.of("table", "table_search_index", "all", "dataAsset"));
    aliasState.put("table_search_index_rebuild_new", new HashSet<>());
    aliasState.put(
        "vector_search_index_rebuild_old", Set.of("vectorEmbedding", "vector_search_index"));
    aliasState.put("vector_search_index_rebuild_new", new HashSet<>());

    SearchClient client = aliasState.toMock();
    SearchRepository repo = mock(SearchRepository.class);
    when(repo.getSearchClient()).thenReturn(client);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getSearchRepository).thenReturn(repo);

      SearchIndexApp app = new SearchIndexApp(collectionDAO, searchRepository);

      ReindexContext context = new ReindexContext();
      context.add(
          "table",
          "table_search_index",
          "table_search_index_rebuild_old",
          "table_search_index_rebuild_new",
          Set.of("table", "table_search_index", "all", "dataAsset"),
          "table",
          List.of("all", "dataAsset"));
      context.add(
          "vectorEmbedding",
          "vector_search_index",
          "vector_search_index_rebuild_old",
          "vector_search_index_rebuild_new",
          Set.of("vectorEmbedding", "vector_search_index"),
          "vectorEmbedding",
          List.of());

      setPrivateField(app, "recreateContext", context);
      setPrivateField(app, "recreateIndexHandler", new DefaultRecreateHandler());
      setPrivateField(
          app, "jobData", new EventPublisherJob().withStatus(EventPublisherJob.Status.COMPLETED));

      var method =
          SearchIndexApp.class.getDeclaredMethod("finalizeAllEntityReindex", boolean.class);
      method.setAccessible(true);
      method.invoke(app, true);
    }

    assertTrue(
        aliasState.deletedIndices.contains("table_search_index_rebuild_old"),
        "Old table index should be promoted and cleaned up");
    assertTrue(
        aliasState
            .indexAliases
            .get("table_search_index_rebuild_new")
            .contains("table_search_index"),
        "Staged table index should gain the table_search_index alias");
    assertTrue(
        aliasState.deletedIndices.contains("vector_search_index_rebuild_old"),
        "Old vector index should be promoted and cleaned up");
    assertTrue(
        aliasState.indexAliases.get("vector_search_index_rebuild_new").contains("vectorEmbedding"),
        "Staged vector index should gain the vectorEmbedding alias");
  }

  private static void setPrivateField(Object target, String fieldName, Object value)
      throws Exception {
    java.lang.reflect.Field field = target.getClass().getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
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

  // =========================================================================
  // Vector embedding helper methods
  // =========================================================================

  private Object createVectorTestDatabaseService(String name) {
    return Map.of(
        "name",
        name,
        "serviceType",
        "Postgres",
        "description",
        "Test service for vector embeddings",
        "connection",
        Map.of(
            "config",
            Map.of(
                "type", "Postgres",
                "hostPort", "localhost:5432",
                "username", "test",
                "authType", Map.of("password", "test"))));
  }

  private Table createVectorTestTable(String name, String description) throws Exception {
    List<Column> columns =
        List.of(
            new Column()
                .withName("id")
                .withDataType(ColumnDataType.BIGINT)
                .withDescription("Primary key"),
            new Column()
                .withName("name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(8)
                .withDescription("Name field"),
            new Column()
                .withName("description")
                .withDataType(ColumnDataType.TEXT)
                .withDescription("Description field"));

    CreateTable createTable =
        new CreateTable()
            .withName(name)
            .withDescription(description)
            .withDatabaseSchema(vectorTestSchema.getFullyQualifiedName())
            .withColumns(columns);

    return TestUtils.post(getResource("tables"), createTable, Table.class, ADMIN_AUTH_HEADERS);
  }

  private void triggerSearchIndexApplicationForEntities(Set<String> entities, boolean recreateIndex)
      throws Exception {
    waitForExistingJobToComplete();

    EventPublisherJob jobConfig =
        new EventPublisherJob()
            .withEntities(entities)
            .withBatchSize(10)
            .withRecreateIndex(recreateIndex)
            .withAutoTune(false);

    WebTarget target = getResource("apps/trigger/SearchIndexingApplication");

    int maxRetries = 5;
    long retryBackoffMs = 5000;

    for (int attempt = 1; attempt <= maxRetries; attempt++) {
      Response response =
          SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS)
              .post(jakarta.ws.rs.client.Entity.entity(jobConfig, MediaType.APPLICATION_JSON));

      if (response.getStatus() >= 200 && response.getStatus() < 300) {
        return;
      }

      String body = response.readEntity(String.class);
      if (body != null && body.contains("Job is already running") && attempt < maxRetries) {
        LOG.info(
            "Job is still running, waiting {}ms before retry {}/{}",
            retryBackoffMs,
            attempt,
            maxRetries);
        Thread.sleep(retryBackoffMs);
        waitForExistingJobToComplete();
        continue;
      }

      assertTrue(
          response.getStatus() >= 200 && response.getStatus() < 300,
          "Failed to trigger SearchIndexingApplication: " + body);
    }
  }

  private void triggerSearchIndexApplication(boolean recreateIndex) throws Exception {
    waitForExistingJobToComplete();

    EventPublisherJob jobConfig =
        new EventPublisherJob()
            .withEntities(Set.of("table"))
            .withBatchSize(10)
            .withRecreateIndex(recreateIndex)
            .withAutoTune(false);

    WebTarget target = getResource("apps/trigger/SearchIndexingApplication");

    int maxRetries = 5;
    long retryBackoffMs = 5000;

    for (int attempt = 1; attempt <= maxRetries; attempt++) {
      Response response =
          SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS)
              .post(jakarta.ws.rs.client.Entity.entity(jobConfig, MediaType.APPLICATION_JSON));

      if (response.getStatus() >= 200 && response.getStatus() < 300) {
        return;
      }

      String body = response.readEntity(String.class);
      if (body != null && body.contains("Job is already running") && attempt < maxRetries) {
        LOG.info(
            "Job is still running, waiting {}ms before retry {}/{}",
            retryBackoffMs,
            attempt,
            maxRetries);
        Thread.sleep(retryBackoffMs);
        waitForExistingJobToComplete();
        continue;
      }

      assertTrue(
          response.getStatus() >= 200 && response.getStatus() < 300,
          "Failed to trigger SearchIndexingApplication: " + body);
    }
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> getAppRunRecord() {
    try {
      WebTarget target = getResource("apps/name/SearchIndexingApplication/logs");
      Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).get();
      if (response.getStatus() == 200) {
        String body = response.readEntity(String.class);
        if (body != null) {
          return JsonUtils.readValue(body, Map.class);
        }
      }
    } catch (Exception e) {
      LOG.warn("Failed to fetch app run record: {}", e.getMessage());
    }
    return null;
  }

  @SuppressWarnings("unchecked")
  private void waitForIndexingCompletion() throws Exception {
    int waitIntervalMs = 3000;
    int totalWaited = 0;
    int maxWaitMs = 120_000;

    while (totalWaited < maxWaitMs) {
      Thread.sleep(waitIntervalMs);
      totalWaited += waitIntervalMs;

      try {
        WebTarget target = getResource("apps/name/SearchIndexingApplication/logs");
        Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).get();

        if (response.getStatus() == 200) {
          String body = response.readEntity(String.class);
          if (body != null) {
            Map<String, Object> logJson = JsonUtils.readValue(body, Map.class);
            String status = (String) logJson.get("status");
            if ("success".equalsIgnoreCase(status) || "completed".equalsIgnoreCase(status)) {
              LOG.info("Indexing completed successfully after {}ms", totalWaited);
              return;
            }
            if ("failed".equalsIgnoreCase(status)
                || "stopped".equalsIgnoreCase(status)
                || "activeError".equalsIgnoreCase(status)) {
              LOG.warn("Indexing ended with status: {}", status);
              return;
            }
          }
        }
      } catch (Exception e) {
        LOG.debug("Could not retrieve logs: {}", e.getMessage());
      }
    }

    LOG.warn("Indexing wait timeout reached after {}ms", totalWaited);
  }

  private boolean waitForVectorSearchAvailability() {
    int maxRetries = 10;
    long backoffMs = 3000;

    for (int attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        WebTarget target = getResource("search/vector/query");
        Map<String, Object> requestBody =
            Map.of("query", "test", "size", 1, "k", 1, "threshold", 0.0);

        Response response =
            SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS)
                .post(jakarta.ws.rs.client.Entity.entity(requestBody, MediaType.APPLICATION_JSON));

        if (response.getStatus() >= 200 && response.getStatus() < 300) {
          LOG.info("Vector search service is available (attempt {})", attempt);
          return true;
        }

        LOG.info(
            "Vector search not yet available (attempt {}/{}): {}",
            attempt,
            maxRetries,
            response.getStatus());
      } catch (Exception e) {
        LOG.info(
            "Vector search check failed (attempt {}/{}): {}", attempt, maxRetries, e.getMessage());
      }

      try {
        Thread.sleep(backoffMs);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        return false;
      }
    }

    LOG.warn("Vector search service not available after {} attempts", maxRetries);
    return false;
  }

  @SuppressWarnings("unchecked")
  private void waitForExistingJobToComplete() throws Exception {
    int maxWaitMs = 120_000;
    int pollIntervalMs = 3000;
    int totalWaited = 0;

    while (totalWaited < maxWaitMs) {
      try {
        WebTarget target = getResource("apps/name/SearchIndexingApplication/logs");
        Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).get();

        if (response.getStatus() == 200) {
          String body = response.readEntity(String.class);
          if (body != null) {
            Map<String, Object> logJson = JsonUtils.readValue(body, Map.class);
            String status = (String) logJson.get("status");
            if (status == null
                || (!"running".equalsIgnoreCase(status)
                    && !"started".equalsIgnoreCase(status)
                    && !"active".equalsIgnoreCase(status))) {
              LOG.info("SearchIndexingApplication is idle (status={}), proceeding", status);
              return;
            }
            LOG.info("SearchIndexingApplication is {} - waiting...", status);
          }
        } else {
          return;
        }
      } catch (Exception e) {
        LOG.debug("Could not check job status: {}", e.getMessage());
        return;
      }

      Thread.sleep(pollIntervalMs);
      totalWaited += pollIntervalMs;
    }

    LOG.warn("Timeout waiting for existing job to complete after {}ms", maxWaitMs);
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> vectorSearch(String query) throws Exception {
    WebTarget target = getResource("search/vector/query");
    Map<String, Object> requestBody =
        Map.of("query", query, "size", 10, "k", 10000, "threshold", 0.0);

    int maxRetries = 10;
    long backoffMs = 5000;

    for (int attempt = 1; attempt <= maxRetries; attempt++) {
      Response response =
          SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS)
              .post(jakarta.ws.rs.client.Entity.entity(requestBody, MediaType.APPLICATION_JSON));

      if (response.getStatus() >= 200 && response.getStatus() < 300) {
        return JsonUtils.readValue(response.readEntity(String.class), Map.class);
      }

      if (attempt < maxRetries) {
        LOG.info(
            "Vector search returned status {} (attempt {}/{}), retrying in {}ms",
            response.getStatus(),
            attempt,
            maxRetries,
            backoffMs * attempt);
        Thread.sleep(backoffMs * attempt);
        continue;
      }

      LOG.warn(
          "Vector search returned status {}: {}",
          response.getStatus(),
          response.readEntity(String.class));
    }
    return null;
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> getFingerprint(String parentId) throws Exception {
    WebTarget target = getResource("search/vector/fingerprint").queryParam("parentId", parentId);

    int maxRetries = 10;
    long backoffMs = 5000;

    for (int attempt = 1; attempt <= maxRetries; attempt++) {
      Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).get();

      if (response.getStatus() >= 200 && response.getStatus() < 300) {
        return JsonUtils.readValue(response.readEntity(String.class), Map.class);
      }

      if (attempt < maxRetries) {
        LOG.info(
            "Fingerprint request returned status {} (attempt {}/{}), retrying",
            response.getStatus(),
            attempt,
            maxRetries);
        Thread.sleep(backoffMs * attempt);
        continue;
      }

      LOG.debug(
          "Fingerprint request returned status {}: {}",
          response.getStatus(),
          response.readEntity(String.class));
    }
    return null;
  }

  private void safeDelete(String resource, org.openmetadata.schema.EntityInterface entity) {
    if (entity == null) {
      return;
    }
    try {
      WebTarget target =
          getResource(resource + "/" + entity.getId())
              .queryParam("hardDelete", true)
              .queryParam("recursive", true);
      SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).delete();
    } catch (Exception e) {
      LOG.warn("Failed to delete {}: {}", resource, e.getMessage());
    }
  }

  // =========================================================================
  // Inner class for alias state testing
  // =========================================================================

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

      lenient()
          .doAnswer(
              invocation -> {
                String index = invocation.getArgument(0);
                indexAliases.remove(index);
                deletedIndices.add(index);
                return null;
              })
          .when(client)
          .deleteIndexWithBackoff(anyString());

      lenient()
          .when(client.swapAliases(anySet(), anyString(), anySet()))
          .thenAnswer(
              invocation -> {
                @SuppressWarnings("unchecked")
                Set<String> oldIndices = (Set<String>) invocation.getArgument(0);
                String newIndex = invocation.getArgument(1);
                @SuppressWarnings("unchecked")
                Set<String> aliases = new HashSet<>((Set<String>) invocation.getArgument(2));

                for (String oldIndex : oldIndices) {
                  indexAliases.computeIfPresent(
                      oldIndex,
                      (k, v) -> {
                        v.removeAll(aliases);
                        return v;
                      });
                }
                indexAliases.computeIfAbsent(newIndex, k -> new HashSet<>()).addAll(aliases);
                return true;
              });

      return client;
    }
  }
}
