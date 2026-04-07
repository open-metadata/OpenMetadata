package org.openmetadata.service.apps.bundles.searchIndex.listeners;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.SuccessContext;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.apps.bundles.searchIndex.QuartzOrchestratorContext;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingConfiguration;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingJobContext;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.DistributedJobContext;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.SearchIndexJob;
import org.openmetadata.service.apps.scheduler.OmAppJobListener;
import org.openmetadata.service.socket.WebSocketManager;
import org.quartz.Job;
import org.quartz.JobBuilder;
import org.quartz.JobDataMap;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;

class QuartzProgressListenerTest {

  private WebSocketManager originalWebSocketManager;

  @BeforeEach
  void rememberWebSocketManager() {
    originalWebSocketManager = WebSocketManager.getInstance();
  }

  @AfterEach
  void restoreWebSocketManager() throws Exception {
    setStaticField(WebSocketManager.class, "instance", originalWebSocketManager);
  }

  @Test
  void progressUpdateStoresTypedStatsAndDistributedMetadataOnExistingRecord() throws Exception {
    JobDetail jobDetail = newJobDetail();
    JobExecutionContext quartzContext = mock(JobExecutionContext.class);
    when(quartzContext.getJobDetail()).thenReturn(jobDetail);

    EventPublisherJob jobData = new EventPublisherJob();
    App app = mock(App.class);
    UUID appId = UUID.randomUUID();
    when(app.getId()).thenReturn(appId);

    AppRunRecord existingRecord = new AppRunRecord();
    existingRecord.setAppId(appId);
    existingRecord.setStartTime(123L);
    existingRecord.setSuccessContext(
        new SuccessContext().withAdditionalProperty("existing", "yes"));
    Function<JobExecutionContext, AppRunRecord> provider = ctx -> existingRecord;
    QuartzOrchestratorContext.StatusPusher statusPusher =
        mock(QuartzOrchestratorContext.StatusPusher.class);
    WebSocketManager webSocketManager = mock(WebSocketManager.class);
    setStaticField(WebSocketManager.class, "instance", webSocketManager);

    QuartzProgressListener listener =
        new QuartzProgressListener(quartzContext, jobData, app, provider, statusPusher);

    ReindexingJobContext startContext = mock(ReindexingJobContext.class);
    when(startContext.getStartTime()).thenReturn(123L);

    listener.onJobStarted(startContext);
    listener.onJobConfigured(startContext, configuration());

    Stats stats =
        new Stats()
            .withJobStats(
                new StepStats().withTotalRecords(10).withSuccessRecords(7).withFailedRecords(1));
    SearchIndexJob job =
        SearchIndexJob.builder().id(UUID.randomUUID()).createdAt(10L).startedAt(20L).build();
    DistributedJobContext distributedContext = new DistributedJobContext(job);
    distributedContext.setDistributedMetadata("participants", 2);

    listener.onProgressUpdate(stats, distributedContext);

    assertEquals(EventPublisherJob.Status.RUNNING, jobData.getStatus());
    assertSame(stats, jobDetail.getJobDataMap().get(OmAppJobListener.APP_RUN_STATS));
    assertEquals(
        org.openmetadata.service.socket.WebSocketManager.SEARCH_INDEX_JOB_BROADCAST_CHANNEL,
        jobDetail.getJobDataMap().get(OmAppJobListener.WEBSOCKET_STATUS_CHANNEL));

    ArgumentCaptor<AppRunRecord> recordCaptor = ArgumentCaptor.forClass(AppRunRecord.class);
    verify(statusPusher, atLeastOnce()).push(eq(quartzContext), recordCaptor.capture(), eq(true));
    AppRunRecord latest = last(recordCaptor.getAllValues());

    assertEquals(AppRunRecord.Status.RUNNING, latest.getStatus());
    assertEquals(appId, latest.getAppId());
    assertEquals(123L, latest.getStartTime());
    assertSame(stats, latest.getSuccessContext().getStats());
    assertEquals("yes", latest.getSuccessContext().getAdditionalProperties().get("existing"));
    assertEquals(2, latest.getSuccessContext().getAdditionalProperties().get("participants"));
    verify(webSocketManager, atLeastOnce())
        .broadCastMessageToAll(
            eq(org.openmetadata.service.socket.WebSocketManager.SEARCH_INDEX_JOB_BROADCAST_CHANNEL),
            org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void errorThresholdResetsOnProgressAndFailureUsesTypedFailureField() throws Exception {
    JobDetail jobDetail = newJobDetail();
    JobExecutionContext quartzContext = mock(JobExecutionContext.class);
    when(quartzContext.getJobDetail()).thenReturn(jobDetail);

    App app = mock(App.class);
    UUID appId = UUID.randomUUID();
    when(app.getId()).thenReturn(appId);

    QuartzOrchestratorContext.StatusPusher statusPusher =
        mock(QuartzOrchestratorContext.StatusPusher.class);
    QuartzProgressListener listener =
        new QuartzProgressListener(
            quartzContext,
            new EventPublisherJob(),
            app,
            ctx -> {
              throw new IllegalStateException("missing");
            },
            statusPusher);

    ReindexingJobContext startContext = mock(ReindexingJobContext.class);
    when(startContext.getStartTime()).thenReturn(456L);
    listener.onJobStarted(startContext);

    Stats stats =
        new Stats()
            .withJobStats(
                new StepStats().withTotalRecords(5).withSuccessRecords(3).withFailedRecords(2));
    IndexingError error =
        new IndexingError()
            .withMessage("sink failed")
            .withErrorSource(IndexingError.ErrorSource.SINK);

    listener.onError("table", error, stats);
    listener.onError("table", error, stats);
    listener.onError("table", error, stats);

    assertEquals(EventPublisherJob.Status.ACTIVE_ERROR, listener.getJobData().getStatus());
    assertEquals(3, getPendingErrors(listener).get());

    setField(listener, "lastWebSocketUpdate", 0L);
    listener.onProgressUpdate(stats, startContext);

    assertEquals(EventPublisherJob.Status.RUNNING, listener.getJobData().getStatus());
    assertEquals(0, getPendingErrors(listener).get());

    listener.onJobFailed(stats, new IllegalStateException("boom"));
    listener.onJobStopped(stats);

    ArgumentCaptor<AppRunRecord> recordCaptor = ArgumentCaptor.forClass(AppRunRecord.class);
    verify(statusPusher, atLeastOnce()).push(eq(quartzContext), recordCaptor.capture(), eq(true));
    AppRunRecord failureRecord =
        recordWithStatus(recordCaptor.getAllValues(), AppRunRecord.Status.FAILED);

    assertEquals(appId, failureRecord.getAppId());
    assertEquals(456L, failureRecord.getStartTime());
    assertNotNull(failureRecord.getFailureContext());
    assertEquals("boom", failureRecord.getFailureContext().getFailure().getMessage());
    assertEquals(
        IndexingError.ErrorSource.JOB,
        failureRecord.getFailureContext().getFailure().getErrorSource());
    assertEquals(EventPublisherJob.Status.STOPPED, listener.getJobData().getStatus());
  }

  @Test
  void completionPathsAndMiscellaneousCallbacksRemainStable() {
    JobExecutionContext quartzContext = mock(JobExecutionContext.class);
    when(quartzContext.getJobDetail()).thenReturn(newJobDetail());

    QuartzProgressListener listener =
        new QuartzProgressListener(
            quartzContext,
            new EventPublisherJob(),
            null,
            ctx -> null,
            mock(QuartzOrchestratorContext.StatusPusher.class));
    Stats stats =
        new Stats()
            .withJobStats(
                new StepStats().withTotalRecords(8).withSuccessRecords(6).withFailedRecords(2));

    listener.onIndexRecreationStarted(java.util.Set.of("table", "user"));
    listener.onEntityTypeStarted("table", 8);
    listener.onEntityTypeCompleted(
        "table", new StepStats().withSuccessRecords(6).withFailedRecords(2));
    listener.onReaderFailure(
        "table",
        "id-1",
        "missing",
        org.openmetadata
            .service
            .apps
            .bundles
            .searchIndex
            .ReindexingProgressListener
            .FailureType
            .ENTITY_NOT_FOUND);
    listener.onReaderFailure(
        "table",
        "id-2",
        "broken",
        org.openmetadata
            .service
            .apps
            .bundles
            .searchIndex
            .ReindexingProgressListener
            .FailureType
            .DB_ERROR);
    listener.onProcessFailure("table", "id-3", "process");
    listener.onSinkFailure("table", "id-4", "sink");
    listener.onSubIndexingCompleted(
        "table", "columns", new StepStats().withSuccessRecords(2).withFailedRecords(1));
    listener.onJobCompleted(stats, 2_000L);
    listener.onJobCompletedWithErrors(stats, 2_000L);

    assertEquals(10, listener.getPriority());
    assertSame(listener.getJobData(), getField(listener, "jobData"));
  }

  @Test
  void throttledProgressUpdateLeavesCurrentStatsUntouched() throws Exception {
    JobExecutionContext quartzContext = mock(JobExecutionContext.class);
    when(quartzContext.getJobDetail()).thenReturn(newJobDetail());

    EventPublisherJob jobData = new EventPublisherJob();
    QuartzProgressListener listener =
        new QuartzProgressListener(
            quartzContext,
            jobData,
            null,
            ctx -> new AppRunRecord(),
            mock(QuartzOrchestratorContext.StatusPusher.class));
    Stats initialStats =
        new Stats().withJobStats(new StepStats().withTotalRecords(3).withSuccessRecords(1));
    jobData.setStats(initialStats);
    getPendingErrors(listener).set(2);
    setField(listener, "lastWebSocketUpdate", System.currentTimeMillis());

    listener.onProgressUpdate(
        new Stats().withJobStats(new StepStats().withTotalRecords(9).withSuccessRecords(9)),
        mock(ReindexingJobContext.class));

    assertSame(initialStats, jobData.getStats());
    assertEquals(2, getPendingErrors(listener).get());
  }

  private ReindexingConfiguration configuration() {
    return ReindexingConfiguration.builder()
        .entities(java.util.Set.of("table"))
        .batchSize(25)
        .consumerThreads(2)
        .producerThreads(3)
        .queueSize(100)
        .maxConcurrentRequests(5)
        .payloadSize(4_096)
        .recreateIndex(true)
        .useDistributedIndexing(true)
        .build();
  }

  private AtomicInteger getPendingErrors(QuartzProgressListener listener) {
    return (AtomicInteger) getField(listener, "pendingErrors");
  }

  private Object getField(Object target, String name) {
    try {
      Field field = target.getClass().getDeclaredField(name);
      field.setAccessible(true);
      return field.get(target);
    } catch (ReflectiveOperationException e) {
      throw new AssertionError(e);
    }
  }

  private void setField(Object target, String name, long value) throws Exception {
    Field field = target.getClass().getDeclaredField(name);
    field.setAccessible(true);
    field.setLong(target, value);
  }

  private static void setStaticField(Class<?> type, String name, Object value) throws Exception {
    Field field = type.getDeclaredField(name);
    field.setAccessible(true);
    field.set(null, value);
  }

  private AppRunRecord last(List<AppRunRecord> records) {
    return records.get(records.size() - 1);
  }

  private AppRunRecord recordWithStatus(List<AppRunRecord> records, AppRunRecord.Status status) {
    return records.stream()
        .filter(record -> record.getStatus() == status)
        .findFirst()
        .orElseThrow();
  }

  private JobDetail newJobDetail() {
    return JobBuilder.newJob(NoOpQuartzJob.class)
        .withIdentity("reindex-job")
        .usingJobData(new JobDataMap())
        .build();
  }

  public static class NoOpQuartzJob implements Job {
    @Override
    public void execute(JobExecutionContext context) {}
  }
}
