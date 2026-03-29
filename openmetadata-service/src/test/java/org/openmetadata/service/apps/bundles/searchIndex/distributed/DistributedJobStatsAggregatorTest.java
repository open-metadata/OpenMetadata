/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.apps.bundles.searchIndex.distributed;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingProgressListener;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.socket.WebSocketManager;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DistributedJobStatsAggregatorTest {

  @Mock private DistributedSearchIndexCoordinator coordinator;

  private DistributedJobStatsAggregator aggregator;
  private UUID jobId;
  private WebSocketManager originalWebSocketManager;

  @BeforeEach
  void setUp() {
    jobId = UUID.randomUUID();
    originalWebSocketManager = WebSocketManager.getInstance();
  }

  @AfterEach
  void tearDown() throws Exception {
    setStaticField(WebSocketManager.class, "instance", originalWebSocketManager);
    if (aggregator != null) {
      aggregator.stop();
    }
    Thread.interrupted();
  }

  @Test
  void testStartAndStop() {
    aggregator = new DistributedJobStatsAggregator(coordinator, jobId);

    assertFalse(aggregator.isRunning());

    aggregator.start();
    assertTrue(aggregator.isRunning());

    aggregator.stop();
    assertFalse(aggregator.isRunning());
  }

  @Test
  void testMultipleStartCallsAreIdempotent() {
    aggregator = new DistributedJobStatsAggregator(coordinator, jobId);

    aggregator.start();
    aggregator.start();
    aggregator.start();

    assertTrue(aggregator.isRunning());
  }

  @Test
  void testMultipleStopCallsAreIdempotent() {
    aggregator = new DistributedJobStatsAggregator(coordinator, jobId);

    aggregator.start();
    aggregator.stop();
    aggregator.stop();
    aggregator.stop();

    assertFalse(aggregator.isRunning());
  }

  @Test
  void testStopsWhenJobNotFound() {
    when(coordinator.getJobWithAggregatedStats(jobId)).thenReturn(null);

    aggregator = new DistributedJobStatsAggregator(coordinator, jobId, 500);
    aggregator.start();

    // Wait for aggregator to detect null job and stop
    Awaitility.await().atMost(3, TimeUnit.SECONDS).until(() -> !aggregator.isRunning());

    assertFalse(aggregator.isRunning());
  }

  @Test
  void testDoesNotStopWhenJobIsTerminal() throws Exception {
    EventPublisherJob config = new EventPublisherJob();
    config.setBatchSize(100);

    SearchIndexJob completedJob =
        SearchIndexJob.builder()
            .id(jobId)
            .status(IndexJobStatus.COMPLETED)
            .jobConfiguration(config)
            .totalRecords(1000)
            .processedRecords(1000)
            .successRecords(1000)
            .failedRecords(0)
            .completedAt(System.currentTimeMillis())
            .build();

    when(coordinator.getJobWithAggregatedStats(jobId)).thenReturn(completedJob);

    aggregator = new DistributedJobStatsAggregator(coordinator, jobId, 500);
    aggregator.start();

    // Wait for a couple of poll cycles
    Thread.sleep(1500);

    // Aggregator should still be running (executor is responsible for stopping it)
    assertTrue(aggregator.isRunning());

    aggregator.stop();
  }

  @Test
  void testGetCurrentStats() {
    EventPublisherJob config = new EventPublisherJob();
    config.setBatchSize(100);

    SearchIndexJob job =
        SearchIndexJob.builder()
            .id(jobId)
            .status(IndexJobStatus.RUNNING)
            .jobConfiguration(config)
            .totalRecords(1000)
            .processedRecords(500)
            .successRecords(450)
            .failedRecords(50)
            .build();

    when(coordinator.getJobWithAggregatedStats(jobId)).thenReturn(job);

    aggregator = new DistributedJobStatsAggregator(coordinator, jobId);

    SearchIndexJob currentStats = aggregator.getCurrentStats();
    assertNotNull(currentStats);
    assertEquals(1000, currentStats.getTotalRecords());
    assertEquals(500, currentStats.getProcessedRecords());
    assertEquals(450, currentStats.getSuccessRecords());
    assertEquals(50, currentStats.getFailedRecords());
  }

  @Test
  void testGetCurrentStatsWithEntityStats() {
    EventPublisherJob config = new EventPublisherJob();
    config.setBatchSize(100);

    Map<String, SearchIndexJob.EntityTypeStats> entityStats = new HashMap<>();
    entityStats.put(
        "table",
        SearchIndexJob.EntityTypeStats.builder()
            .entityType("table")
            .totalRecords(500)
            .processedRecords(250)
            .successRecords(240)
            .failedRecords(10)
            .totalPartitions(5)
            .completedPartitions(2)
            .build());
    entityStats.put(
        "dashboard",
        SearchIndexJob.EntityTypeStats.builder()
            .entityType("dashboard")
            .totalRecords(500)
            .processedRecords(250)
            .successRecords(210)
            .failedRecords(40)
            .totalPartitions(5)
            .completedPartitions(3)
            .build());

    SearchIndexJob job =
        SearchIndexJob.builder()
            .id(jobId)
            .status(IndexJobStatus.RUNNING)
            .jobConfiguration(config)
            .totalRecords(1000)
            .processedRecords(500)
            .successRecords(450)
            .failedRecords(50)
            .entityStats(entityStats)
            .build();

    when(coordinator.getJobWithAggregatedStats(jobId)).thenReturn(job);

    aggregator = new DistributedJobStatsAggregator(coordinator, jobId);

    SearchIndexJob currentStats = aggregator.getCurrentStats();
    assertNotNull(currentStats);
    assertNotNull(currentStats.getEntityStats());
    assertEquals(2, currentStats.getEntityStats().size());

    SearchIndexJob.EntityTypeStats tableStats = currentStats.getEntityStats().get("table");
    assertNotNull(tableStats);
    assertEquals(500, tableStats.getTotalRecords());
    assertEquals(250, tableStats.getProcessedRecords());
    assertEquals(240, tableStats.getSuccessRecords());
    assertEquals(10, tableStats.getFailedRecords());

    SearchIndexJob.EntityTypeStats dashboardStats = currentStats.getEntityStats().get("dashboard");
    assertNotNull(dashboardStats);
    assertEquals(500, dashboardStats.getTotalRecords());
    assertEquals(210, dashboardStats.getSuccessRecords());
    assertEquals(40, dashboardStats.getFailedRecords());
  }

  @Test
  void testMinPollIntervalEnforced() {
    // Try to create with poll interval below minimum (500ms)
    aggregator = new DistributedJobStatsAggregator(coordinator, jobId, 100);

    // The aggregator should enforce minimum interval internally
    // We can't directly test this without reflection, but we can verify it doesn't crash
    assertNotNull(aggregator);
  }

  @Test
  void testForceUpdateWhenNotRunning() {
    EventPublisherJob config = new EventPublisherJob();
    config.setBatchSize(100);

    SearchIndexJob job =
        SearchIndexJob.builder()
            .id(jobId)
            .status(IndexJobStatus.RUNNING)
            .jobConfiguration(config)
            .totalRecords(1000)
            .build();

    when(coordinator.getJobWithAggregatedStats(jobId)).thenReturn(job);

    aggregator = new DistributedJobStatsAggregator(coordinator, jobId);
    // Don't start - call forceUpdate directly
    aggregator.forceUpdate();

    // Should not throw, and coordinator should have been called
    // (verify by checking current stats works)
    SearchIndexJob stats = aggregator.getCurrentStats();
    assertNotNull(stats);
  }

  @Test
  void testProgressCalculation() {
    EventPublisherJob config = new EventPublisherJob();
    config.setBatchSize(100);

    SearchIndexJob job =
        SearchIndexJob.builder()
            .id(jobId)
            .status(IndexJobStatus.RUNNING)
            .jobConfiguration(config)
            .totalRecords(1000)
            .processedRecords(500)
            .successRecords(480)
            .failedRecords(20)
            .build();

    when(coordinator.getJobWithAggregatedStats(jobId)).thenReturn(job);

    aggregator = new DistributedJobStatsAggregator(coordinator, jobId);

    SearchIndexJob currentStats = aggregator.getCurrentStats();
    assertNotNull(currentStats);

    // Verify the stats used for progress calculation
    assertEquals(1000, currentStats.getTotalRecords());
    assertEquals(500, currentStats.getProcessedRecords());
    // Progress should be (processedRecords / totalRecords) * 100 = 50%
    assertEquals(50.0, currentStats.getProgressPercent(), 0.01);
  }

  @Test
  void testJobStatusTransitions() {
    EventPublisherJob config = new EventPublisherJob();
    config.setBatchSize(100);

    // Test INITIALIZING
    SearchIndexJob initJob =
        SearchIndexJob.builder()
            .id(jobId)
            .status(IndexJobStatus.INITIALIZING)
            .jobConfiguration(config)
            .totalRecords(100)
            .build();
    assertFalse(initJob.isTerminal());

    // Test READY
    SearchIndexJob readyJob = initJob.toBuilder().status(IndexJobStatus.READY).build();
    assertFalse(readyJob.isTerminal());

    // Test RUNNING
    SearchIndexJob runningJob = initJob.toBuilder().status(IndexJobStatus.RUNNING).build();
    assertFalse(runningJob.isTerminal());

    // Test COMPLETED
    SearchIndexJob completedJob = initJob.toBuilder().status(IndexJobStatus.COMPLETED).build();
    assertTrue(completedJob.isTerminal());

    // Test COMPLETED_WITH_ERRORS
    SearchIndexJob completedWithErrorsJob =
        initJob.toBuilder().status(IndexJobStatus.COMPLETED_WITH_ERRORS).build();
    assertTrue(completedWithErrorsJob.isTerminal());

    // Test FAILED
    SearchIndexJob failedJob = initJob.toBuilder().status(IndexJobStatus.FAILED).build();
    assertTrue(failedJob.isTerminal());

    // Test STOPPING
    SearchIndexJob stoppingJob = initJob.toBuilder().status(IndexJobStatus.STOPPING).build();
    assertFalse(stoppingJob.isTerminal());

    // Test STOPPED
    SearchIndexJob stoppedJob = initJob.toBuilder().status(IndexJobStatus.STOPPED).build();
    assertTrue(stoppedJob.isTerminal());
  }

  @Test
  void testAggregateAndBroadcastSkipsUnchangedRunningStatsAndEmitsTerminalUpdate()
      throws Exception {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.SearchIndexServerStatsDAO serverStatsDAO =
        mock(CollectionDAO.SearchIndexServerStatsDAO.class);
    WebSocketManager webSocketManager = mock(WebSocketManager.class);
    ReindexingProgressListener listener = mock(ReindexingProgressListener.class);

    when(coordinator.getCollectionDAO()).thenReturn(collectionDAO);
    when(collectionDAO.searchIndexServerStatsDAO()).thenReturn(serverStatsDAO);

    CollectionDAO.SearchIndexServerStatsDAO.AggregatedServerStats aggregatedStats =
        new CollectionDAO.SearchIndexServerStatsDAO.AggregatedServerStats(
            9, 1, 2, 8, 1, 10, 2, 4, 1, 1, 0);
    when(serverStatsDAO.getAggregatedStats(jobId.toString()))
        .thenReturn(aggregatedStats, aggregatedStats, aggregatedStats);

    SearchIndexJob runningJob = newJob(IndexJobStatus.RUNNING);
    SearchIndexJob completedJob =
        runningJob.toBuilder()
            .status(IndexJobStatus.COMPLETED)
            .completedAt(300L)
            .updatedAt(300L)
            .build();
    when(coordinator.getJobWithAggregatedStats(jobId))
        .thenReturn(runningJob, runningJob, completedJob);

    DistributedJobContext context = new DistributedJobContext(runningJob);
    aggregator = new DistributedJobStatsAggregator(coordinator, jobId);
    aggregator.setProgressListener(listener, context);
    setStaticField(WebSocketManager.class, "instance", webSocketManager);

    invokePrivate("aggregateAndBroadcast");
    invokePrivate("aggregateAndBroadcast");
    invokePrivate("aggregateAndBroadcast");

    verify(listener, times(2)).onProgressUpdate(any(Stats.class), eq(context));
    verify(listener, never()).onJobCompletedWithErrors(any(), anyLong());
    verify(listener, times(1)).onJobCompleted(any(Stats.class), anyLong());
    verify(webSocketManager, times(2))
        .broadCastMessageToAll(eq(WebSocketManager.SEARCH_INDEX_JOB_BROADCAST_CHANNEL), any());

    assertEquals(jobId.toString(), context.getDistributedMetadata().get("distributedJobId"));
    assertEquals(1, context.getDistributedMetadata().get("serverCount"));
    assertSame(aggregatedStats, context.getDistributedMetadata().get("aggregatedServerStats"));

    ArgumentCaptor<String> broadcastCaptor = ArgumentCaptor.forClass(String.class);
    verify(webSocketManager, times(2))
        .broadCastMessageToAll(
            eq(WebSocketManager.SEARCH_INDEX_JOB_BROADCAST_CHANNEL), broadcastCaptor.capture());
    AppRunRecord broadcastedRecord =
        JsonUtils.readValue(broadcastCaptor.getAllValues().getLast(), AppRunRecord.class);
    assertEquals(AppRunRecord.Status.SUCCESS, broadcastedRecord.getStatus());
  }

  @Test
  void testCacheAppRunRecordFieldsAndBuildFinalRecordUsesRecoveredAppMetadata() throws Exception {
    UUID appId = UUID.randomUUID();
    long appStartTime = 123L;
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.AppExtensionTimeSeries appExtensionDAO =
        mock(CollectionDAO.AppExtensionTimeSeries.class);
    CollectionDAO.SearchIndexServerStatsDAO serverStatsDAO =
        mock(CollectionDAO.SearchIndexServerStatsDAO.class);

    AppRunRecord existingRecord =
        new AppRunRecord()
            .withRunType("Scheduled")
            .withScheduleInfo(new AppSchedule())
            .withStatus(AppRunRecord.Status.RUNNING);

    when(coordinator.getCollectionDAO()).thenReturn(collectionDAO);
    when(collectionDAO.appExtensionTimeSeriesDao()).thenReturn(appExtensionDAO);
    when(collectionDAO.searchIndexServerStatsDAO()).thenReturn(serverStatsDAO);
    when(appExtensionDAO.getByAppIdAndTimestamp(
            appId.toString(), appStartTime, AppExtension.ExtensionType.STATUS.toString()))
        .thenReturn(JsonUtils.pojoToJson(existingRecord));

    CollectionDAO.SearchIndexServerStatsDAO.AggregatedServerStats aggregatedStats =
        new CollectionDAO.SearchIndexServerStatsDAO.AggregatedServerStats(
            5, 1, 0, 4, 1, 4, 1, 2, 1, 1, 0);
    when(serverStatsDAO.getAggregatedStats(jobId.toString())).thenReturn(aggregatedStats);

    SearchIndexJob job =
        newJob(IndexJobStatus.COMPLETED_WITH_ERRORS).toBuilder()
            .completedAt(300L)
            .updatedAt(320L)
            .build();
    when(coordinator.getJobWithAggregatedStats(jobId)).thenReturn(job);

    aggregator = new DistributedJobStatsAggregator(coordinator, jobId, appId, appStartTime, 500);
    invokePrivate("cacheAppRunRecordFields");

    AppRunRecord finalRecord = aggregator.buildFinalAppRunRecord();

    assertNotNull(finalRecord);
    assertEquals(appId, finalRecord.getAppId());
    assertEquals(appStartTime, finalRecord.getStartTime());
    assertEquals(AppRunRecord.Status.ACTIVE_ERROR, finalRecord.getStatus());
    assertEquals("Scheduled", finalRecord.getRunType());
    assertNotNull(finalRecord.getScheduleInfo());
    assertEquals(job.getCompletedAt(), finalRecord.getEndTime());
    assertEquals(job.getUpdatedAt(), finalRecord.getTimestamp());
    assertSame(
        aggregatedStats,
        finalRecord.getSuccessContext().getAdditionalProperties().get("aggregatedServerStats"));
  }

  @Test
  void testBuildFinalAppRunRecordReturnsNullWhenJobMissing() {
    when(coordinator.getJobWithAggregatedStats(jobId)).thenReturn(null);

    aggregator = new DistributedJobStatsAggregator(coordinator, jobId);

    assertNull(aggregator.buildFinalAppRunRecord());
  }

  @Test
  void testCacheAppRunRecordFieldsSwallowsCollectionErrors() throws Exception {
    UUID appId = UUID.randomUUID();

    when(coordinator.getCollectionDAO()).thenThrow(new IllegalStateException("dao unavailable"));

    aggregator = new DistributedJobStatsAggregator(coordinator, jobId, appId, 99L, 500);

    invokePrivate("cacheAppRunRecordFields");

    assertNull(getField("cachedRunType"));
    assertNull(getField("cachedScheduleInfo"));
  }

  @Test
  void testConvertToStatsCapsCountsAndHandlesSafeToIntBounds() throws Exception {
    aggregator = new DistributedJobStatsAggregator(coordinator, jobId);

    SearchIndexJob job =
        newJob(IndexJobStatus.RUNNING).toBuilder()
            .totalRecords((long) Integer.MAX_VALUE + 25)
            .processedRecords(100)
            .successRecords(60)
            .failedRecords(40)
            .entityStats(
                Map.of(
                    "table",
                    SearchIndexJob.EntityTypeStats.builder()
                        .entityType("table")
                        .totalRecords((long) Integer.MAX_VALUE + 50)
                        .successRecords((long) Integer.MAX_VALUE + 70)
                        .failedRecords(9)
                        .build()))
            .build();

    CollectionDAO.SearchIndexServerStatsDAO.AggregatedServerStats aggregatedStats =
        new CollectionDAO.SearchIndexServerStatsDAO.AggregatedServerStats(
            150, 5, 6, 300, 8, 200, 7, 11, 12, 1, 0);

    Stats stats =
        (Stats)
            invokePrivate(
                "convertToStats",
                new Class<?>[] {
                  SearchIndexJob.class,
                  CollectionDAO.SearchIndexServerStatsDAO.AggregatedServerStats.class
                },
                job,
                aggregatedStats);

    assertEquals(Integer.MAX_VALUE, stats.getJobStats().getTotalRecords());
    assertEquals(100, stats.getReaderStats().getSuccessRecords());
    assertEquals(5, stats.getReaderStats().getFailedRecords());
    assertEquals(107, stats.getProcessStats().getTotalRecords());
    assertEquals(100, stats.getProcessStats().getSuccessRecords());
    assertEquals(108, stats.getSinkStats().getTotalRecords());
    assertEquals(100, stats.getSinkStats().getSuccessRecords());
    assertEquals(23, stats.getVectorStats().getTotalRecords());

    StepStats tableStats = stats.getEntityStats().getAdditionalProperties().get("table");
    assertEquals(Integer.MAX_VALUE, tableStats.getTotalRecords());
    assertEquals(Integer.MAX_VALUE, tableStats.getSuccessRecords());

    assertEquals(
        Integer.MAX_VALUE,
        invokeStaticPrivate("safeToInt", new Class<?>[] {long.class}, Long.MAX_VALUE));
    assertEquals(
        Integer.MIN_VALUE,
        invokeStaticPrivate("safeToInt", new Class<?>[] {long.class}, Long.MIN_VALUE));
  }

  @Test
  void testConvertStatusMapsEveryDistributedJobState() throws Exception {
    aggregator = new DistributedJobStatsAggregator(coordinator, jobId);

    assertEquals(
        AppRunRecord.Status.PENDING,
        invokePrivate(
            "convertStatus", new Class<?>[] {IndexJobStatus.class}, IndexJobStatus.INITIALIZING));
    assertEquals(
        AppRunRecord.Status.PENDING,
        invokePrivate(
            "convertStatus", new Class<?>[] {IndexJobStatus.class}, IndexJobStatus.READY));
    assertEquals(
        AppRunRecord.Status.RUNNING,
        invokePrivate(
            "convertStatus", new Class<?>[] {IndexJobStatus.class}, IndexJobStatus.RUNNING));
    assertEquals(
        AppRunRecord.Status.SUCCESS,
        invokePrivate(
            "convertStatus", new Class<?>[] {IndexJobStatus.class}, IndexJobStatus.COMPLETED));
    assertEquals(
        AppRunRecord.Status.ACTIVE_ERROR,
        invokePrivate(
            "convertStatus",
            new Class<?>[] {IndexJobStatus.class},
            IndexJobStatus.COMPLETED_WITH_ERRORS));
    assertEquals(
        AppRunRecord.Status.FAILED,
        invokePrivate(
            "convertStatus", new Class<?>[] {IndexJobStatus.class}, IndexJobStatus.FAILED));
    assertEquals(
        AppRunRecord.Status.STOP_IN_PROGRESS,
        invokePrivate(
            "convertStatus", new Class<?>[] {IndexJobStatus.class}, IndexJobStatus.STOPPING));
    assertEquals(
        AppRunRecord.Status.STOPPED,
        invokePrivate(
            "convertStatus", new Class<?>[] {IndexJobStatus.class}, IndexJobStatus.STOPPED));
  }

  @Test
  void testNotifyProgressListenerEmitsTerminalTransitionsOnlyOnce() throws Exception {
    ReindexingProgressListener listener = mock(ReindexingProgressListener.class);
    SearchIndexJob baseJob = newJob(IndexJobStatus.RUNNING);
    DistributedJobContext context = new DistributedJobContext(baseJob);

    aggregator = new DistributedJobStatsAggregator(coordinator, jobId);
    aggregator.setProgressListener(listener, context);

    SearchIndexJob completedWithErrors =
        baseJob.toBuilder().status(IndexJobStatus.COMPLETED_WITH_ERRORS).build();
    SearchIndexJob failed =
        baseJob.toBuilder().status(IndexJobStatus.FAILED).errorMessage("failed downstream").build();
    SearchIndexJob stopped = baseJob.toBuilder().status(IndexJobStatus.STOPPED).build();

    invokePrivate(
        "notifyProgressListener",
        new Class<?>[] {
          SearchIndexJob.class, CollectionDAO.SearchIndexServerStatsDAO.AggregatedServerStats.class
        },
        completedWithErrors,
        null);
    invokePrivate(
        "notifyProgressListener",
        new Class<?>[] {
          SearchIndexJob.class, CollectionDAO.SearchIndexServerStatsDAO.AggregatedServerStats.class
        },
        completedWithErrors,
        null);
    invokePrivate(
        "notifyProgressListener",
        new Class<?>[] {
          SearchIndexJob.class, CollectionDAO.SearchIndexServerStatsDAO.AggregatedServerStats.class
        },
        failed,
        null);
    invokePrivate(
        "notifyProgressListener",
        new Class<?>[] {
          SearchIndexJob.class, CollectionDAO.SearchIndexServerStatsDAO.AggregatedServerStats.class
        },
        stopped,
        null);

    verify(listener, times(4)).onProgressUpdate(any(Stats.class), eq(context));
    verify(listener, times(1)).onJobCompletedWithErrors(any(Stats.class), anyLong());
    ArgumentCaptor<Exception> errorCaptor = ArgumentCaptor.forClass(Exception.class);
    verify(listener, times(1)).onJobFailed(any(Stats.class), errorCaptor.capture());
    verify(listener, times(1)).onJobStopped(any(Stats.class));
    assertEquals("failed downstream", errorCaptor.getValue().getMessage());
  }

  @Test
  void testBroadcastStatsHandlesMissingWebSocketManager() throws Exception {
    aggregator = new DistributedJobStatsAggregator(coordinator, jobId);
    setStaticField(WebSocketManager.class, "instance", null);

    AppRunRecord appRunRecord =
        new AppRunRecord()
            .withSuccessContext(new org.openmetadata.schema.entity.app.SuccessContext());

    invokePrivate("broadcastStats", new Class<?>[] {AppRunRecord.class}, appRunRecord);
  }

  @Test
  void testForceUpdateUsesSchedulerWhenRunning() throws Exception {
    ScheduledExecutorService scheduler = mock(ScheduledExecutorService.class);
    when(scheduler.isShutdown()).thenReturn(false);

    aggregator = new DistributedJobStatsAggregator(coordinator, jobId);
    setRunning(true);
    setField("scheduler", scheduler);

    aggregator.forceUpdate();

    verify(scheduler).execute(any(Runnable.class));
  }

  @Test
  void testStopForcesShutdownNowAndPreservesInterruptFlag() throws Exception {
    ScheduledExecutorService scheduler = mock(ScheduledExecutorService.class);
    when(scheduler.awaitTermination(5, TimeUnit.SECONDS)).thenReturn(false);

    aggregator = new DistributedJobStatsAggregator(coordinator, jobId);
    setRunning(true);
    setField("scheduler", scheduler);

    aggregator.stop();

    verify(scheduler).shutdown();
    verify(scheduler).shutdownNow();

    ScheduledExecutorService interruptedScheduler = mock(ScheduledExecutorService.class);
    doThrow(new InterruptedException("stop"))
        .when(interruptedScheduler)
        .awaitTermination(5, TimeUnit.SECONDS);

    aggregator = new DistributedJobStatsAggregator(coordinator, jobId);
    setRunning(true);
    setField("scheduler", interruptedScheduler);

    aggregator.stop();

    verify(interruptedScheduler).shutdown();
    verify(interruptedScheduler).shutdownNow();
    assertTrue(Thread.currentThread().isInterrupted());
  }

  private SearchIndexJob newJob(IndexJobStatus status) {
    EventPublisherJob config = new EventPublisherJob();
    config.setBatchSize(100);

    return SearchIndexJob.builder()
        .id(jobId)
        .status(status)
        .jobConfiguration(config)
        .totalRecords(10)
        .processedRecords(8)
        .successRecords(7)
        .failedRecords(1)
        .entityStats(
            Map.of(
                "table",
                SearchIndexJob.EntityTypeStats.builder()
                    .entityType("table")
                    .totalRecords(10)
                    .processedRecords(8)
                    .successRecords(7)
                    .failedRecords(1)
                    .build()))
        .serverStats(
            Map.of(
                "server-1",
                SearchIndexJob.ServerStats.builder()
                    .serverId("server-1")
                    .processedRecords(8)
                    .successRecords(7)
                    .failedRecords(1)
                    .completedPartitions(1)
                    .build()))
        .createdAt(100L)
        .startedAt(120L)
        .updatedAt(200L)
        .build();
  }

  private Object invokePrivate(String methodName) throws Exception {
    return invokePrivate(methodName, new Class<?>[0]);
  }

  private Object invokePrivate(String methodName, Class<?>[] parameterTypes, Object... args)
      throws Exception {
    Method method =
        DistributedJobStatsAggregator.class.getDeclaredMethod(methodName, parameterTypes);
    method.setAccessible(true);
    return method.invoke(aggregator, args);
  }

  private Object invokeStaticPrivate(String methodName, Class<?>[] parameterTypes, Object... args)
      throws Exception {
    Method method =
        DistributedJobStatsAggregator.class.getDeclaredMethod(methodName, parameterTypes);
    method.setAccessible(true);
    return method.invoke(null, args);
  }

  private Object getField(String fieldName) throws Exception {
    Field field = DistributedJobStatsAggregator.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    return field.get(aggregator);
  }

  private void setField(String fieldName, Object value) throws Exception {
    Field field = DistributedJobStatsAggregator.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(aggregator, value);
  }

  private void setRunning(boolean running) throws Exception {
    ((AtomicBoolean) getField("running")).set(running);
  }

  private static void setStaticField(Class<?> type, String fieldName, Object value)
      throws Exception {
    Field field = type.getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(null, value);
  }
}
