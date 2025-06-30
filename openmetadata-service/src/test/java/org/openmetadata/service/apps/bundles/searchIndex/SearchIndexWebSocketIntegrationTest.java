package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
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
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.util.ResultList;
import org.quartz.JobDataMap;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;

@ExtendWith(MockitoExtension.class)
@Slf4j
public class SearchIndexWebSocketIntegrationTest {

  @Mock private CollectionDAO collectionDAO;
  @Mock private SearchRepository searchRepository;
  @Mock private BulkSink mockSink;
  @Mock private JobExecutionContext jobExecutionContext;
  @Mock private JobDetail jobDetail;
  @Mock private JobDataMap jobDataMap;
  @Mock private WebSocketManager webSocketManager;

  private SearchIndexApp searchIndexApp;
  private EventPublisherJob testJobData;
  private final ObjectMapper objectMapper = new ObjectMapper();
  private final List<String> webSocketMessages = Collections.synchronizedList(new ArrayList<>());
  private MockedStatic<WebSocketManager> webSocketManagerMock;

  @BeforeEach
  void setUp() {
    searchIndexApp = new SearchIndexApp(collectionDAO, searchRepository);

    // Setup test job data
    testJobData =
        new EventPublisherJob()
            .withEntities(Set.of("table", "user"))
            .withBatchSize(10)
            .withPayLoadSize(1000000L)
            .withMaxConcurrentRequests(5)
            .withMaxRetries(3)
            .withInitialBackoff(1000)
            .withMaxBackoff(10000)
            .withProducerThreads(2)
            .withConsumerThreads(2)
            .withQueueSize(100)
            .withRecreateIndex(false)
            .withStats(new Stats());

    // Setup job execution context mocks
    when(jobExecutionContext.getJobDetail()).thenReturn(jobDetail);
    when(jobDetail.getJobDataMap()).thenReturn(jobDataMap);
    when(jobDataMap.get("triggerType")).thenReturn("MANUAL");

    // Mock WebSocketManager singleton
    webSocketManagerMock = mockStatic(WebSocketManager.class);
    webSocketManagerMock.when(WebSocketManager::getInstance).thenReturn(webSocketManager);

    // Capture WebSocket messages
    doAnswer(
            invocation -> {
              String channel = invocation.getArgument(0);
              String message = invocation.getArgument(1);
              webSocketMessages.add(message);
              LOG.debug("WebSocket message sent on channel {}: {}", channel, message);
              return null;
            })
        .when(webSocketManager)
        .broadCastMessageToAll(anyString(), anyString());
  }

  @AfterEach
  void tearDown() {
    if (webSocketManagerMock != null) {
      webSocketManagerMock.close();
    }
  }

  @Test
  void testCompleteSuccessfulJobWebSocketFlow() throws Exception {
    // Test the complete flow of a successful job with WebSocket updates

    // Initialize the app
    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(testJobData, Object.class));

    searchIndexApp.init(testApp);

    // Clear initial messages
    webSocketMessages.clear();

    // Simulate successful entity processing
    EntityInterface mockEntity = mock(EntityInterface.class);
    when(mockEntity.getId()).thenReturn(UUID.randomUUID());

    List<EntityInterface> entities = Arrays.asList(mockEntity, mockEntity, mockEntity);
    ResultList<EntityInterface> resultList = new ResultList<>(entities, null, null, 3);

    Map<String, Object> contextData = new HashMap<>();
    contextData.put("entityType", "table");

    // Mock successful sink processing
    doNothing().when(mockSink).write(eq(entities), eq(contextData));

    // Process a batch
    SearchIndexApp.IndexingTask<EntityInterface> task =
        new SearchIndexApp.IndexingTask<>("table", resultList, 0);

    var processTaskMethod =
        SearchIndexApp.class.getDeclaredMethod(
            "processTask", SearchIndexApp.IndexingTask.class, JobExecutionContext.class);
    processTaskMethod.setAccessible(true);

    // Clear messages before processing
    webSocketMessages.clear();

    // Process the task
    processTaskMethod.invoke(searchIndexApp, task, jobExecutionContext);

    // Verify WebSocket message was sent
    verify(webSocketManager, atLeastOnce())
        .broadCastMessageToAll(eq("searchIndexJobStatus"), anyString());

    assertFalse(webSocketMessages.isEmpty(), "WebSocket messages should have been sent");

    // Parse and verify the WebSocket message content
    String lastMessage = webSocketMessages.get(webSocketMessages.size() - 1);
    assertNotNull(lastMessage);

    // The message should contain statistics
    assertTrue(lastMessage.contains("successRecords") || lastMessage.contains("stats"));

    LOG.info("Successful processing WebSocket message: {}", lastMessage);
  }

  @Test
  void testErrorHandlingWebSocketFlow() throws Exception {
    // Test WebSocket updates when errors occur

    // Initialize the app
    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(testJobData, Object.class));

    searchIndexApp.init(testApp);

    // Create error scenario
    List<EntityError> entityErrors =
        Arrays.asList(
            new EntityError()
                .withMessage(
                    "Limit of total fields [250] has been exceeded while adding new fields [3]")
                .withEntity("TestEntity1"),
            new EntityError().withMessage("Document parsing exception").withEntity("TestEntity2"));

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
    when(mockEntity.getId()).thenReturn(UUID.randomUUID());

    List<EntityInterface> entities = Arrays.asList(mockEntity, mockEntity);
    ResultList<EntityInterface> resultList = new ResultList<>(entities, null, null, 2);

    Map<String, Object> contextData = new HashMap<>();
    contextData.put("entityType", "table");

    // Mock sink to throw SearchIndexException
    doThrow(searchIndexException).when(mockSink).write(eq(entities), eq(contextData));

    SearchIndexApp.IndexingTask<EntityInterface> task =
        new SearchIndexApp.IndexingTask<>("table", resultList, 0);

    var processTaskMethod =
        SearchIndexApp.class.getDeclaredMethod(
            "processTask", SearchIndexApp.IndexingTask.class, JobExecutionContext.class);
    processTaskMethod.setAccessible(true);

    // Clear messages before processing
    webSocketMessages.clear();

    // Process the task (should handle the error)
    processTaskMethod.invoke(searchIndexApp, task, jobExecutionContext);

    // Verify error WebSocket message was sent immediately
    verify(webSocketManager, atLeastOnce())
        .broadCastMessageToAll(eq("searchIndexJobStatus"), anyString());

    assertFalse(webSocketMessages.isEmpty(), "Error WebSocket messages should have been sent");

    // Parse and verify error message content
    String errorMessage = webSocketMessages.get(webSocketMessages.size() - 1);
    assertNotNull(errorMessage);

    // The message should contain error information
    assertTrue(
        errorMessage.contains("failure")
            || errorMessage.contains("ACTIVE_ERROR")
            || errorMessage.contains("failureContext"));

    // Verify job status was set to error
    assertEquals(EventPublisherJob.Status.ACTIVE_ERROR, searchIndexApp.getJobData().getStatus());

    LOG.info("Error handling WebSocket message: {}", errorMessage);
  }

  @Test
  void testJobCompletionWebSocketFlow() throws Exception {
    // Test WebSocket updates when job completes successfully

    // Initialize the app
    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(testJobData, Object.class));

    searchIndexApp.init(testApp);

    // Set job to running state
    EventPublisherJob jobData = searchIndexApp.getJobData();
    jobData.setStatus(EventPublisherJob.Status.RUNNING);

    // Clear messages
    webSocketMessages.clear();

    // Simulate job completion
    synchronized (searchIndexApp.getClass()) {
      if (jobData.getStatus() == EventPublisherJob.Status.RUNNING) {
        jobData.setStatus(EventPublisherJob.Status.COMPLETED);

        var sendUpdatesMethod =
            SearchIndexApp.class.getDeclaredMethod(
                "sendUpdates", JobExecutionContext.class, boolean.class);
        sendUpdatesMethod.setAccessible(true);
        sendUpdatesMethod.invoke(searchIndexApp, jobExecutionContext, true);
      }
    }

    // Verify completion WebSocket message was sent
    verify(webSocketManager, atLeastOnce())
        .broadCastMessageToAll(eq("searchIndexJobStatus"), anyString());

    assertFalse(webSocketMessages.isEmpty(), "Completion WebSocket messages should have been sent");

    // Parse and verify completion message
    String completionMessage = webSocketMessages.get(webSocketMessages.size() - 1);
    assertNotNull(completionMessage);

    // The message should indicate completion
    assertTrue(completionMessage.contains("COMPLETED") || completionMessage.contains("status"));

    // Verify job status was set to completed
    assertEquals(EventPublisherJob.Status.COMPLETED, jobData.getStatus());

    LOG.info("Job completion WebSocket message: {}", completionMessage);
  }

  @Test
  void testThrottledWebSocketUpdates() throws Exception {
    // Test that WebSocket updates are properly throttled

    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(testJobData, Object.class));

    searchIndexApp.init(testApp);

    var sendUpdatesMethod =
        SearchIndexApp.class.getDeclaredMethod(
            "sendUpdates", JobExecutionContext.class, boolean.class);
    sendUpdatesMethod.setAccessible(true);

    // Clear messages
    webSocketMessages.clear();

    // Send multiple rapid non-forced updates (should be throttled)
    sendUpdatesMethod.invoke(searchIndexApp, jobExecutionContext, false);
    sendUpdatesMethod.invoke(searchIndexApp, jobExecutionContext, false);
    sendUpdatesMethod.invoke(searchIndexApp, jobExecutionContext, false);

    // Only one or few messages should have been sent due to throttling
    int throttledMessageCount = webSocketMessages.size();

    // Send a forced update (should always go through)
    sendUpdatesMethod.invoke(searchIndexApp, jobExecutionContext, true);

    // Should have at least one more message now
    assertTrue(
        webSocketMessages.size() > throttledMessageCount, "Forced update should bypass throttling");

    LOG.info(
        "Throttled updates: {}, Total messages: {}",
        throttledMessageCount,
        webSocketMessages.size());
  }

  @Test
  void testWebSocketMessageFormat() throws Exception {
    // Test that WebSocket messages have the correct format and content

    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(testJobData, Object.class));

    searchIndexApp.init(testApp);

    // Set up some statistics
    EventPublisherJob jobData = searchIndexApp.getJobData();
    Stats stats = new Stats();
    stats.setJobStats(
        new StepStats().withSuccessRecords(100).withFailedRecords(5).withTotalRecords(105));
    jobData.setStats(stats);
    jobData.setStatus(EventPublisherJob.Status.RUNNING);

    // Clear messages
    webSocketMessages.clear();

    // Send update
    var sendUpdatesMethod =
        SearchIndexApp.class.getDeclaredMethod(
            "sendUpdates", JobExecutionContext.class, boolean.class);
    sendUpdatesMethod.setAccessible(true);
    sendUpdatesMethod.invoke(searchIndexApp, jobExecutionContext, true);

    // Verify message was sent
    assertFalse(webSocketMessages.isEmpty());

    String message = webSocketMessages.get(webSocketMessages.size() - 1);

    // Try to parse as JSON to verify format
    assertDoesNotThrow(
        () -> {
          objectMapper.readTree(message);
        },
        "WebSocket message should be valid JSON");

    // Verify message contains expected fields
    assertTrue(
        message.contains("status")
            || message.contains("stats")
            || message.contains("successContext")
            || message.contains("failureContext"),
        "Message should contain expected fields");

    LOG.info("WebSocket message format test - Message: {}", message);
  }

  @Test
  void testConcurrentWebSocketUpdates() throws Exception {
    // Test that concurrent WebSocket updates are handled correctly

    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(testJobData, Object.class));

    searchIndexApp.init(testApp);

    int numThreads = 5;
    CountDownLatch startLatch = new CountDownLatch(1);
    CountDownLatch completionLatch = new CountDownLatch(numThreads);

    var sendUpdatesMethod =
        SearchIndexApp.class.getDeclaredMethod(
            "sendUpdates", JobExecutionContext.class, boolean.class);
    sendUpdatesMethod.setAccessible(true);

    // Clear messages
    webSocketMessages.clear();

    // Launch concurrent update threads
    for (int i = 0; i < numThreads; i++) {
      final int threadId = i;
      new Thread(
              () -> {
                try {
                  startLatch.await(); // Wait for all threads to be ready

                  // Each thread sends multiple updates
                  for (int j = 0; j < 5; j++) {
                    StepStats stats =
                        new StepStats()
                            .withSuccessRecords(threadId * 10 + j)
                            .withFailedRecords(j % 2);
                    searchIndexApp.updateStats("table", stats);

                    // Force update to bypass throttling for this test
                    sendUpdatesMethod.invoke(searchIndexApp, jobExecutionContext, true);

                    Thread.sleep(10); // Small delay between updates
                  }
                } catch (Exception e) {
                  LOG.error("Thread {} failed", threadId, e);
                } finally {
                  completionLatch.countDown();
                }
              })
          .start();
    }

    // Start all threads
    startLatch.countDown();

    // Wait for completion
    assertTrue(
        completionLatch.await(30, TimeUnit.SECONDS), "All threads should complete within timeout");

    // Verify messages were sent (some may be throttled)
    assertFalse(webSocketMessages.isEmpty(), "Some WebSocket messages should have been sent");

    // Verify final stats are accumulated correctly
    Stats finalStats = searchIndexApp.getJobData().getStats();
    StepStats tableStats =
        (StepStats) finalStats.getEntityStats().getAdditionalProperties().get("table");

    assertTrue(tableStats.getSuccessRecords() > 0, "Success records should be accumulated");
    assertTrue(tableStats.getFailedRecords() >= 0, "Failed records should be accumulated");

    LOG.info(
        "Concurrent test - Messages sent: {}, Final success: {}, Final failed: {}",
        webSocketMessages.size(),
        tableStats.getSuccessRecords(),
        tableStats.getFailedRecords());
  }

  @Test
  void testWebSocketErrorMessageContent() throws Exception {
    // Test that error messages contain detailed information

    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(testJobData, Object.class));

    searchIndexApp.init(testApp);

    // Create detailed error
    List<EntityError> detailedErrors =
        Arrays.asList(
            new EntityError()
                .withMessage(
                    "Elasticsearch exception [type=document_parsing_exception, reason=[1:6347] failed to parse: Limit of total fields [250] has been exceeded while adding new fields [3]]")
                .withEntity("{\"id\":\"test-entity-1\",\"name\":\"TestEntity1\"}"),
            new EntityError()
                .withMessage(
                    "Elasticsearch exception [type=version_conflict_engine_exception, reason=[test-entity-2]: version conflict, current version [2] is different than the one provided [1]]")
                .withEntity("{\"id\":\"test-entity-2\",\"name\":\"TestEntity2\"}"));

    IndexingError detailedIndexingError =
        new IndexingError()
            .withErrorSource(IndexingError.ErrorSource.SINK)
            .withSubmittedCount(10)
            .withSuccessCount(8)
            .withFailedCount(2)
            .withMessage("Issues in Sink to Elasticsearch: field limit and version conflict errors")
            .withFailedEntities(detailedErrors);

    // Set the error in job data
    EventPublisherJob jobData = searchIndexApp.getJobData();
    jobData.setFailure(detailedIndexingError);
    jobData.setStatus(EventPublisherJob.Status.ACTIVE_ERROR);

    // Clear messages
    webSocketMessages.clear();

    // Send update with error
    var sendUpdatesMethod =
        SearchIndexApp.class.getDeclaredMethod(
            "sendUpdates", JobExecutionContext.class, boolean.class);
    sendUpdatesMethod.setAccessible(true);
    sendUpdatesMethod.invoke(searchIndexApp, jobExecutionContext, true);

    // Verify error message was sent
    assertFalse(webSocketMessages.isEmpty());

    String errorMessage = webSocketMessages.get(webSocketMessages.size() - 1);

    // Verify detailed error information is present
    assertTrue(errorMessage.contains("ACTIVE_ERROR") || errorMessage.contains("failure"));
    assertTrue(
        errorMessage.contains("field limit")
            || errorMessage.contains("250")
            || errorMessage.contains("version conflict"));

    LOG.info("Detailed error WebSocket message: {}", errorMessage);
  }
}
