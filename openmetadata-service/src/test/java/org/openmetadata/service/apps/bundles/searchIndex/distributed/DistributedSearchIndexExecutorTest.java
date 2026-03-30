package org.openmetadata.service.apps.bundles.searchIndex.distributed;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import io.micrometer.core.instrument.Timer;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedConstruction;
import org.mockito.MockedConstruction.Context;
import org.mockito.MockedStatic;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.BulkSink;
import org.openmetadata.service.apps.bundles.searchIndex.ElasticSearchBulkSink;
import org.openmetadata.service.apps.bundles.searchIndex.IndexingFailureRecorder;
import org.openmetadata.service.apps.bundles.searchIndex.OpenSearchBulkSink;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingConfiguration;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingMetrics;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingProgressListener;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexJobDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexPartitionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.search.DefaultRecreateHandler;
import org.openmetadata.service.search.EntityReindexContext;
import org.openmetadata.service.search.RecreateIndexHandler;
import org.openmetadata.service.search.ReindexContext;
import org.openmetadata.service.search.SearchRepository;

class DistributedSearchIndexExecutorTest {

  private static final String SERVER_ID = "server-a";

  private CollectionDAO collectionDAO;
  private SearchIndexJobDAO jobDAO;
  private SearchIndexPartitionDAO partitionDAO;
  private DistributedSearchIndexCoordinator coordinator;
  private JobRecoveryManager recoveryManager;
  private DistributedSearchIndexExecutor executor;
  private MockedStatic<ServerIdentityResolver> serverIdentityMock;

  private static void prepare(IndexingFailureRecorder mock, Context context) {
    when(mock.toString()).thenReturn("failure-recorder");
  }

  @BeforeEach
  void setUp() throws Exception {
    collectionDAO = mock(CollectionDAO.class);
    jobDAO = mock(SearchIndexJobDAO.class);
    partitionDAO = mock(SearchIndexPartitionDAO.class);
    coordinator = mock(DistributedSearchIndexCoordinator.class);
    recoveryManager = mock(JobRecoveryManager.class);

    ServerIdentityResolver resolver = mock(ServerIdentityResolver.class);
    when(resolver.getServerId()).thenReturn(SERVER_ID);
    serverIdentityMock = mockStatic(ServerIdentityResolver.class);
    serverIdentityMock.when(ServerIdentityResolver::getInstance).thenReturn(resolver);

    when(collectionDAO.searchIndexJobDAO()).thenReturn(jobDAO);
    when(collectionDAO.searchIndexPartitionDAO()).thenReturn(partitionDAO);

    executor = new DistributedSearchIndexExecutor(collectionDAO);
    setField("coordinator", coordinator);
    setField("recoveryManager", recoveryManager);
  }

  @AfterEach
  void tearDown() throws Exception {
    clearCoordinatedJobs();
    if (serverIdentityMock != null) {
      serverIdentityMock.close();
    }
  }

  @Test
  void listenerAndStateHelpersExposeConfiguredValues() throws Exception {
    ReindexingProgressListener listener = mock(ReindexingProgressListener.class);
    UUID appId = UUID.randomUUID();
    DistributedJobNotifier notifier = mock(DistributedJobNotifier.class);

    assertEquals(0, executor.getListenerCount());
    assertSame(executor, executor.addListener(listener));
    assertEquals(1, executor.getListenerCount());
    assertSame(executor, executor.removeListener(listener));
    assertEquals(0, executor.getListenerCount());

    executor.setAppContext(appId, 55L);
    executor.setJobNotifier(notifier);
    executor.updateStagedIndexMapping(Map.of("table", "staged-table"));

    assertFalse(executor.isStopped());
    assertNull(executor.getFailureRecorder());
    assertNull(executor.getEntityTracker());
    assertNull(executor.getJobWithFreshStats());
    assertEquals(appId, getField("appId"));
    assertEquals(55L, getField("appStartTime"));
    assertSame(notifier, getField("jobNotifier"));
    verify(coordinator, never()).updateStagedIndexMapping(any(), any());
  }

  @Test
  void createJobReturnsInitializedJobWhenLockTransferSucceeds() {
    SearchIndexJob created =
        SearchIndexJob.builder()
            .id(UUID.randomUUID())
            .status(IndexJobStatus.INITIALIZING)
            .totalRecords(40)
            .build();
    SearchIndexJob initialized = created.withStatus(IndexJobStatus.READY);

    when(recoveryManager.checkForBlockingJob()).thenReturn(Optional.empty());
    when(coordinator.tryAcquireReindexLock(any())).thenReturn(true);
    when(coordinator.createJob(any(), any(), eq("admin"), any())).thenReturn(created);
    when(coordinator.initializePartitions(
            created.getId(), ReindexingConfiguration.builder().build()))
        .thenReturn(initialized);
    when(coordinator.transferReindexLock(any(), eq(created.getId()))).thenReturn(true);

    SearchIndexJob result =
        executor.createJob(
            Set.of("table"),
            new EventPublisherJob().withEntities(Set.of("table")),
            "admin",
            ReindexingConfiguration.builder().build());

    assertSame(initialized, result);
    assertSame(initialized, executor.getCurrentJob());
  }

  @Test
  void createJobRejectsBlockingJobBeforeLockAcquisition() {
    SearchIndexJob blocker =
        SearchIndexJob.builder()
            .id(UUID.randomUUID())
            .status(IndexJobStatus.RUNNING)
            .startedAt(123L)
            .build();
    when(recoveryManager.checkForBlockingJob()).thenReturn(Optional.of(blocker));

    IllegalStateException exception =
        assertThrows(
            IllegalStateException.class,
            () ->
                executor.createJob(
                    Set.of("table"),
                    new EventPublisherJob().withEntities(Set.of("table")),
                    "admin",
                    ReindexingConfiguration.builder().build()));

    assertTrue(exception.getMessage().contains(blocker.getId().toString()));
    verifyNoInteractions(coordinator);
  }

  @Test
  void createJobReportsRunningJobWhenLockCannotBeAcquired() {
    SearchIndexJob running =
        SearchIndexJob.builder().id(UUID.randomUUID()).status(IndexJobStatus.RUNNING).build();

    when(recoveryManager.checkForBlockingJob()).thenReturn(Optional.empty());
    when(coordinator.tryAcquireReindexLock(any())).thenReturn(false);
    when(coordinator.getRecentJobs(List.of(IndexJobStatus.RUNNING, IndexJobStatus.READY), 1))
        .thenReturn(List.of(running));

    IllegalStateException exception =
        assertThrows(
            IllegalStateException.class,
            () ->
                executor.createJob(
                    Set.of("table"),
                    new EventPublisherJob().withEntities(Set.of("table")),
                    "admin",
                    ReindexingConfiguration.builder().build()));

    assertTrue(exception.getMessage().contains(running.getId().toString()));
  }

  @Test
  void createJobReportsGenericLockContentionWhenNoRunningJobIsVisible() {
    when(recoveryManager.checkForBlockingJob()).thenReturn(Optional.empty());
    when(coordinator.tryAcquireReindexLock(any())).thenReturn(false);
    when(coordinator.getRecentJobs(List.of(IndexJobStatus.RUNNING, IndexJobStatus.READY), 1))
        .thenReturn(List.of());

    IllegalStateException exception =
        assertThrows(
            IllegalStateException.class,
            () ->
                executor.createJob(
                    Set.of("table"),
                    new EventPublisherJob().withEntities(Set.of("table")),
                    "admin",
                    ReindexingConfiguration.builder().build()));

    assertTrue(exception.getMessage().contains("another operation may be in progress"));
  }

  @Test
  void createJobMarksJobFailedWhenLockTransferIsLost() {
    UUID jobId = UUID.randomUUID();
    SearchIndexJob created =
        SearchIndexJob.builder().id(jobId).status(IndexJobStatus.INITIALIZING).build();
    SearchIndexJob initialized =
        SearchIndexJob.builder().id(jobId).status(IndexJobStatus.READY).totalRecords(20).build();

    when(recoveryManager.checkForBlockingJob()).thenReturn(Optional.empty());
    when(coordinator.tryAcquireReindexLock(any())).thenReturn(true);
    when(coordinator.createJob(any(), any(), anyString(), any())).thenReturn(created);
    when(coordinator.initializePartitions(eq(jobId), any())).thenReturn(initialized);
    when(coordinator.transferReindexLock(any(), eq(jobId))).thenReturn(false);
    when(partitionDAO.getAggregatedStats(jobId.toString()))
        .thenReturn(new SearchIndexPartitionDAO.AggregatedStatsRecord(20, 10, 8, 2, 3, 1, 1, 1, 0));

    IllegalStateException exception =
        assertThrows(
            IllegalStateException.class,
            () ->
                executor.createJob(
                    Set.of("table"),
                    new EventPublisherJob().withEntities(Set.of("table")),
                    "admin",
                    ReindexingConfiguration.builder().build()));

    assertTrue(exception.getMessage().contains("Failed to transfer reindex lock"));

    ArgumentCaptor<UUID> tempJobCaptor = ArgumentCaptor.forClass(UUID.class);
    verify(coordinator).tryAcquireReindexLock(tempJobCaptor.capture());
    verify(coordinator).releaseReindexLock(tempJobCaptor.getValue());
    verify(jobDAO)
        .update(
            eq(jobId.toString()),
            eq(IndexJobStatus.FAILED.name()),
            eq(10L),
            eq(8L),
            eq(2L),
            isNull(),
            isNull(),
            anyLong(),
            anyLong(),
            eq("Failed to acquire lock - another job may be running"));
    verify(partitionDAO).cancelPendingPartitions(jobId.toString());
  }

  @Test
  void performStartupRecoveryDelegatesToRecoveryManager() {
    JobRecoveryManager.RecoveryResult recovery =
        JobRecoveryManager.RecoveryResult.builder()
            .incrementRecovered()
            .incrementRecovered()
            .build();
    when(recoveryManager.performStartupRecovery()).thenReturn(recovery);

    assertSame(recovery, executor.performStartupRecovery());
  }

  @Test
  void joinJobStoresCurrentJobWhenFound() {
    SearchIndexJob job =
        SearchIndexJob.builder().id(UUID.randomUUID()).status(IndexJobStatus.RUNNING).build();
    when(coordinator.getJob(job.getId())).thenReturn(Optional.of(job));

    Optional<SearchIndexJob> result = executor.joinJob(job.getId());

    assertTrue(result.isPresent());
    assertSame(job, result.get());
    assertSame(job, executor.getCurrentJob());
  }

  @Test
  void stopStopsWorkersAndRequestsCoordinatorStopOnlyOnce() throws Exception {
    SearchIndexJob job =
        SearchIndexJob.builder().id(UUID.randomUUID()).status(IndexJobStatus.RUNNING).build();
    PartitionWorker worker = mock(PartitionWorker.class);
    @SuppressWarnings("unchecked")
    List<PartitionWorker> activeWorkers = (List<PartitionWorker>) getField("activeWorkers");
    activeWorkers.add(worker);
    setField("currentJob", job);

    executor.stop();
    executor.stop();

    assertTrue(executor.isStopped());
    verify(worker, times(1)).stop();
    verify(coordinator, times(1)).requestStop(job.getId());
  }

  @Test
  void getFreshStatsAndUpdateStagedIndexMappingUseCurrentJob() throws Exception {
    UUID jobId = UUID.randomUUID();
    SearchIndexJob current =
        SearchIndexJob.builder().id(jobId).status(IndexJobStatus.RUNNING).build();
    SearchIndexJob refreshed = current.withSuccessRecords(12).withFailedRecords(1);
    setField("currentJob", current);
    when(coordinator.getJobWithAggregatedStats(jobId)).thenReturn(refreshed);

    SearchIndexJob job = executor.getJobWithFreshStats();
    executor.updateStagedIndexMapping(Map.of("table", "staged_table"));

    assertSame(refreshed, job);
    verify(coordinator).updateStagedIndexMapping(jobId, Map.of("table", "staged_table"));
  }

  @Test
  void initializeEntityTrackerCountsPartitionsAndWiresPromotionCallback() throws Exception {
    UUID jobId = UUID.randomUUID();
    ReindexContext recreateContext = mock(ReindexContext.class);
    SearchRepository searchRepository = mock(SearchRepository.class);
    RecreateIndexHandler recreateHandler = mock(RecreateIndexHandler.class);

    when(coordinator.getPartitions(jobId, null))
        .thenReturn(
            List.of(
                partition(jobId, "table", PartitionStatus.PENDING),
                partition(jobId, "table", PartitionStatus.COMPLETED),
                partition(jobId, "dashboard", PartitionStatus.FAILED)));
    when(recreateContext.getEntities()).thenReturn(Set.of("table", "dashboard"));
    setField("entityTracker", new EntityCompletionTracker(jobId));
    setField("recreateContext", recreateContext);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      when(searchRepository.createReindexHandler()).thenReturn(recreateHandler);

      invokePrivate(
          "initializeEntityTracker", new Class<?>[] {UUID.class, boolean.class}, jobId, true);
    }

    EntityCompletionTracker tracker = executor.getEntityTracker();
    assertNotNull(tracker);
    assertEquals(2, tracker.getStatus("table").totalPartitions());
    assertEquals(1, tracker.getStatus("dashboard").totalPartitions());
    assertSame(recreateHandler, getField("recreateIndexHandler"));
  }

  @Test
  void initializeEntityTrackerCallbackPromotesEntityWhenTrackingCompletes() throws Exception {
    UUID jobId = UUID.randomUUID();
    ReindexContext recreateContext = mock(ReindexContext.class);
    DefaultRecreateHandler recreateHandler = mock(DefaultRecreateHandler.class);
    SearchRepository searchRepository = mock(SearchRepository.class);

    when(coordinator.getPartitions(jobId, null))
        .thenReturn(List.of(partition(jobId, "table", PartitionStatus.PENDING)));
    when(recreateContext.getEntities()).thenReturn(Set.of("table"));
    when(recreateContext.getStagedIndex("table")).thenReturn(Optional.of("staged_table"));
    when(recreateContext.getCanonicalIndex("table")).thenReturn(Optional.of("table_search"));
    when(recreateContext.getOriginalIndex("table")).thenReturn(Optional.of("table_current"));
    when(recreateContext.getCanonicalAlias("table")).thenReturn(Optional.of("table_alias"));
    when(recreateContext.getExistingAliases("table")).thenReturn(Set.of("table_existing"));
    when(recreateContext.getParentAliases("table")).thenReturn(List.of("table_parent"));
    setField("entityTracker", new EntityCompletionTracker(jobId));
    setField("recreateContext", recreateContext);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);
      when(searchRepository.createReindexHandler()).thenReturn(recreateHandler);

      invokePrivate(
          "initializeEntityTracker", new Class<?>[] {UUID.class, boolean.class}, jobId, true);
    }

    executor.getEntityTracker().recordPartitionComplete("table", false);

    verify(recreateHandler).promoteEntityIndex(any(EntityReindexContext.class), eq(true));
  }

  @Test
  void promoteEntityIndexUsesDefaultAndGenericHandlers() throws Exception {
    ReindexContext recreateContext = mock(ReindexContext.class);
    DefaultRecreateHandler defaultHandler = mock(DefaultRecreateHandler.class);
    RecreateIndexHandler genericHandler = mock(RecreateIndexHandler.class);
    when(recreateContext.getStagedIndex("table")).thenReturn(Optional.of("staged_table"));
    when(recreateContext.getCanonicalIndex("table")).thenReturn(Optional.of("table_search"));
    when(recreateContext.getOriginalIndex("table")).thenReturn(Optional.of("table_current"));
    when(recreateContext.getCanonicalAlias("table")).thenReturn(Optional.of("table_alias"));
    when(recreateContext.getExistingAliases("table")).thenReturn(Set.of("table_existing"));
    when(recreateContext.getParentAliases("table")).thenReturn(List.of("table_parent"));

    setField("recreateContext", recreateContext);
    setField("recreateIndexHandler", defaultHandler);

    invokePrivate(
        "promoteEntityIndex", new Class<?>[] {String.class, boolean.class}, "table", false);

    ArgumentCaptor<EntityReindexContext> contextCaptor =
        ArgumentCaptor.forClass(EntityReindexContext.class);
    verify(defaultHandler).promoteEntityIndex(contextCaptor.capture(), eq(false));
    assertEquals("table", contextCaptor.getValue().getEntityType());
    assertEquals("staged_table", contextCaptor.getValue().getStagedIndex());
    assertTrue(contextCaptor.getValue().getParentAliases().contains("table_parent"));

    setField("recreateIndexHandler", genericHandler);
    invokePrivate(
        "promoteEntityIndex", new Class<?>[] {String.class, boolean.class}, "table", true);
    verify(genericHandler).finalizeReindex(any(EntityReindexContext.class), eq(true));

    when(recreateContext.getStagedIndex("topic")).thenReturn(Optional.empty());
    invokePrivate(
        "promoteEntityIndex", new Class<?>[] {String.class, boolean.class}, "topic", true);
    verifyNoMoreInteractions(genericHandler);
  }

  @Test
  void promoteEntityIndexReturnsWithoutContextAndSwallowsHandlerFailures() throws Exception {
    invokePrivate(
        "promoteEntityIndex", new Class<?>[] {String.class, boolean.class}, "table", true);

    ReindexContext recreateContext = mock(ReindexContext.class);
    DefaultRecreateHandler defaultHandler = mock(DefaultRecreateHandler.class);
    when(recreateContext.getStagedIndex("table")).thenReturn(Optional.of("staged_table"));
    when(recreateContext.getCanonicalIndex("table")).thenReturn(Optional.of("table_search"));
    when(recreateContext.getOriginalIndex("table")).thenReturn(Optional.of("table_current"));
    when(recreateContext.getCanonicalAlias("table")).thenReturn(Optional.of("table_alias"));
    when(recreateContext.getExistingAliases("table")).thenReturn(Set.of());
    when(recreateContext.getParentAliases("table")).thenReturn(List.of());
    doThrow(new IllegalStateException("promotion failed"))
        .when(defaultHandler)
        .promoteEntityIndex(any(EntityReindexContext.class), eq(true));

    setField("recreateContext", recreateContext);
    setField("recreateIndexHandler", defaultHandler);

    invokePrivate(
        "promoteEntityIndex", new Class<?>[] {String.class, boolean.class}, "table", true);

    verify(defaultHandler).promoteEntityIndex(any(EntityReindexContext.class), eq(true));
  }

  @Test
  void applyAndResetPoolSizesRouteToMatchingSinkTypes() throws Exception {
    ReindexingConfiguration config =
        ReindexingConfiguration.builder().fieldFetchThreads(3).docBuildThreads(4).build();
    OpenSearchBulkSink openSearchSink = mock(OpenSearchBulkSink.class);
    ElasticSearchBulkSink elasticSearchSink = mock(ElasticSearchBulkSink.class);

    try (MockedStatic<EntityRepository> entityRepositoryMock = mockStatic(EntityRepository.class);
        MockedStatic<OpenSearchBulkSink> openSearchMock = mockStatic(OpenSearchBulkSink.class);
        MockedStatic<ElasticSearchBulkSink> elasticSearchMock =
            mockStatic(ElasticSearchBulkSink.class)) {

      invokePrivate(
          "applyPoolSizes",
          new Class<?>[] {
            ReindexingConfiguration.class,
            org.openmetadata.service.apps.bundles.searchIndex.BulkSink.class
          },
          config,
          openSearchSink);
      invokePrivate(
          "resetPoolSizes",
          new Class<?>[] {org.openmetadata.service.apps.bundles.searchIndex.BulkSink.class},
          openSearchSink);
      invokePrivate(
          "applyPoolSizes",
          new Class<?>[] {
            ReindexingConfiguration.class,
            org.openmetadata.service.apps.bundles.searchIndex.BulkSink.class
          },
          config,
          elasticSearchSink);
      invokePrivate(
          "resetPoolSizes",
          new Class<?>[] {org.openmetadata.service.apps.bundles.searchIndex.BulkSink.class},
          elasticSearchSink);

      entityRepositoryMock.verify(() -> EntityRepository.setFieldFetchPoolSize(3), times(2));
      entityRepositoryMock.verify(EntityRepository::resetFieldFetchPoolSize, times(2));
      openSearchMock.verify(() -> OpenSearchBulkSink.setDocBuildPoolSize(4));
      openSearchMock.verify(OpenSearchBulkSink::resetDocBuildPoolSize);
      elasticSearchMock.verify(() -> ElasticSearchBulkSink.setDocBuildPoolSize(4));
      elasticSearchMock.verify(ElasticSearchBulkSink::resetDocBuildPoolSize);
    }
  }

  @Test
  void resetPoolSizesSwallowsStaticResetFailures() throws Exception {
    try (MockedStatic<EntityRepository> entityRepositoryMock = mockStatic(EntityRepository.class)) {
      entityRepositoryMock
          .when(EntityRepository::resetFieldFetchPoolSize)
          .thenThrow(new IllegalStateException("reset failed"));

      invokePrivate(
          "resetPoolSizes",
          new Class<?>[] {org.openmetadata.service.apps.bundles.searchIndex.BulkSink.class},
          mock(OpenSearchBulkSink.class));
    }
  }

  @Test
  void executeDoesNotNotifyPeersWhenStartedJobIsNotRunning() throws Exception {
    UUID jobId = UUID.randomUUID();
    SearchIndexJob readyJob =
        SearchIndexJob.builder().id(jobId).status(IndexJobStatus.READY).build();
    SearchIndexJob failedStart = readyJob.withStatus(IndexJobStatus.FAILED);
    DistributedJobNotifier notifier = mock(DistributedJobNotifier.class);
    BulkSink bulkSink = mock(BulkSink.class);
    setField("currentJob", readyJob);
    setField("jobNotifier", notifier);
    when(coordinator.getJob(jobId)).thenReturn(Optional.of(failedStart));

    IllegalStateException exception =
        assertThrows(
            IllegalStateException.class,
            () ->
                executor.execute(
                    bulkSink,
                    null,
                    false,
                    ReindexingConfiguration.builder().entities(Set.of("table")).build()));

    assertTrue(exception.getMessage().contains(IndexJobStatus.FAILED.name()));
    verify(coordinator).startJob(jobId);
    verify(notifier, never()).notifyJobStarted(any(), anyString());
  }

  @Test
  void executeDoesNotRebroadcastStartWhenJoiningRunningJob() throws Exception {
    UUID jobId = UUID.randomUUID();
    SearchIndexJob runningJob =
        SearchIndexJob.builder()
            .id(jobId)
            .status(IndexJobStatus.RUNNING)
            .startedAt(100L)
            .totalRecords(10)
            .successRecords(10)
            .completedAt(200L)
            .build();
    BulkSink bulkSink = mock(BulkSink.class);
    DistributedJobNotifier notifier = mock(DistributedJobNotifier.class);
    ReindexingMetrics metrics = mock(ReindexingMetrics.class);
    Timer.Sample timerSample = mock(Timer.Sample.class);

    setField("currentJob", runningJob);
    setField("jobNotifier", notifier);
    when(coordinator.getJob(jobId)).thenReturn(Optional.of(runningJob), Optional.of(runningJob));
    when(coordinator.claimNextPartition(jobId)).thenReturn(Optional.empty());
    when(coordinator.getPartitions(eq(jobId), any())).thenReturn(List.of());
    when(coordinator.getJobWithAggregatedStats(jobId)).thenReturn(runningJob);
    when(bulkSink.flushAndAwait(60)).thenReturn(true);

    try (MockedConstruction<DistributedJobStatsAggregator> aggregatorConstruction =
            mockConstruction(DistributedJobStatsAggregator.class);
        MockedConstruction<IndexingFailureRecorder> failureConstruction =
            mockConstruction(IndexingFailureRecorder.class);
        MockedStatic<ReindexingMetrics> metricsMock = mockStatic(ReindexingMetrics.class)) {

      metricsMock.when(ReindexingMetrics::getInstance).thenReturn(metrics);
      when(metrics.startJobTimer()).thenReturn(timerSample);

      DistributedSearchIndexExecutor.ExecutionResult result =
          executor.execute(
              bulkSink,
              null,
              false,
              ReindexingConfiguration.builder()
                  .entities(Set.of("table"))
                  .consumerThreads(1)
                  .build());

      assertEquals(IndexJobStatus.RUNNING, result.status());
      verify(notifier, never()).notifyJobStarted(any(), anyString());
      verify(aggregatorConstruction.constructed().get(0)).start();
      verify(failureConstruction.constructed().get(0)).close();
    }
  }

  @Test
  void executeRequiresCurrentJobBeforeRunning() {
    IllegalStateException exception =
        assertThrows(
            IllegalStateException.class,
            () ->
                executor.execute(
                    mock(BulkSink.class), null, false, ReindexingConfiguration.builder().build()));

    assertTrue(exception.getMessage().contains("No job to execute"));
  }

  @Test
  void executeRunsMinimalHappyPathAndCleansUpResources() throws Exception {
    UUID jobId = UUID.randomUUID();
    SearchIndexJob readyJob =
        SearchIndexJob.builder()
            .id(jobId)
            .status(IndexJobStatus.READY)
            .createdAt(100L)
            .totalRecords(15)
            .build();
    SearchIndexJob runningJob =
        readyJob
            .withStatus(IndexJobStatus.RUNNING)
            .withStartedAt(200L)
            .withSuccessRecords(0)
            .withFailedRecords(0);
    SearchIndexJob completedJob =
        runningJob
            .withStatus(IndexJobStatus.COMPLETED)
            .withSuccessRecords(15)
            .withFailedRecords(0)
            .withCompletedAt(400L);
    BulkSink bulkSink = mock(BulkSink.class);
    DistributedJobNotifier notifier = mock(DistributedJobNotifier.class);
    DistributedJobStatsAggregator aggregator = mock(DistributedJobStatsAggregator.class);
    IndexingFailureRecorder failureRecorder = mock(IndexingFailureRecorder.class);
    ReindexingMetrics metrics = mock(ReindexingMetrics.class);
    Timer.Sample timerSample = mock(Timer.Sample.class);
    AtomicInteger getJobCalls = new AtomicInteger();

    setField("currentJob", readyJob);
    setField("jobNotifier", notifier);
    when(notifier.getType()).thenReturn("redis");
    when(coordinator.getJob(jobId))
        .thenAnswer(
            invocation -> {
              int call = getJobCalls.getAndIncrement();
              if (call < 2) {
                return Optional.of(runningJob);
              }
              return Optional.of(completedJob);
            });
    when(coordinator.claimNextPartition(jobId)).thenReturn(Optional.empty());
    when(coordinator.getPartitions(eq(jobId), any())).thenReturn(List.of());
    when(coordinator.getJobWithAggregatedStats(jobId)).thenReturn(completedJob);
    when(bulkSink.flushAndAwait(60)).thenReturn(true);

    try (MockedConstruction<DistributedJobStatsAggregator> aggregatorConstruction =
            mockConstruction(DistributedJobStatsAggregator.class);
        MockedConstruction<IndexingFailureRecorder> failureConstruction =
            mockConstruction(
                IndexingFailureRecorder.class, DistributedSearchIndexExecutorTest::prepare);
        MockedStatic<ReindexingMetrics> metricsMock = mockStatic(ReindexingMetrics.class)) {

      metricsMock.when(ReindexingMetrics::getInstance).thenReturn(metrics);
      when(metrics.startJobTimer()).thenReturn(timerSample);

      DistributedSearchIndexExecutor.ExecutionResult result =
          executor.execute(
              bulkSink,
              null,
              false,
              ReindexingConfiguration.builder()
                  .entities(Set.of("table"))
                  .consumerThreads(1)
                  .statsIntervalMs(1)
                  .build());

      assertEquals(IndexJobStatus.COMPLETED, result.status());
      assertEquals(15, result.successRecords());
      assertFalse(DistributedSearchIndexExecutor.isCoordinatingJob(jobId));
      assertSame(completedJob, executor.getCurrentJob());

      assertEquals(1, aggregatorConstruction.constructed().size());
      assertEquals(1, failureConstruction.constructed().size());
      aggregator = aggregatorConstruction.constructed().get(0);
      failureRecorder = failureConstruction.constructed().get(0);

      verify(coordinator).startJob(jobId);
      verify(notifier).notifyJobStarted(jobId, "SEARCH_INDEX");
      verify(notifier).notifyJobCompleted(jobId);
      verify(aggregator).start();
      verify(aggregator).forceUpdate();
      verify(aggregator).stop();
      verify(failureRecorder).close();
      verify(bulkSink).flushAndAwait(60);
      verify(bulkSink, times(2)).setFailureCallback(any());
      verify(metrics).recordJobStarted();
      verify(metrics).recordJobCompleted(timerSample);
      verify(coordinator, times(2)).checkAndUpdateJobCompletion(jobId);
      verify(coordinator).releaseReindexLock(jobId);
    }
  }

  @Test
  void executeRecordsFailuresFromCleanupWithoutAbortingResult() throws Exception {
    UUID jobId = UUID.randomUUID();
    SearchIndexJob runningJob =
        SearchIndexJob.builder()
            .id(jobId)
            .status(IndexJobStatus.RUNNING)
            .createdAt(100L)
            .startedAt(150L)
            .totalRecords(12)
            .build();
    SearchIndexJob failedJob =
        runningJob.withStatus(IndexJobStatus.FAILED).withFailedRecords(2).withCompletedAt(400L);
    BulkSink bulkSink = mock(BulkSink.class);
    ReindexingProgressListener listener = mock(ReindexingProgressListener.class);
    ReindexContext recreateContext = mock(ReindexContext.class);
    ReindexingMetrics metrics = mock(ReindexingMetrics.class);
    Timer.Sample timerSample = mock(Timer.Sample.class);
    AtomicReference<BulkSink.FailureCallback> callbackRef = new AtomicReference<>();

    executor.addListener(listener);
    setField("currentJob", runningJob);
    when(coordinator.getJob(jobId))
        .thenReturn(Optional.of(runningJob), Optional.of(failedJob), Optional.of(failedJob));
    when(coordinator.claimNextPartition(jobId)).thenReturn(Optional.empty());
    when(coordinator.getPartitions(eq(jobId), isNull()))
        .thenReturn(List.of(partition(jobId, "table", PartitionStatus.COMPLETED)));
    when(coordinator.getPartitions(eq(jobId), eq(PartitionStatus.PENDING))).thenReturn(List.of());
    when(coordinator.getPartitions(eq(jobId), eq(PartitionStatus.PROCESSING)))
        .thenReturn(List.of());
    when(coordinator.getPartitions(eq(jobId), eq(PartitionStatus.COMPLETED)))
        .thenReturn(List.of(partition(jobId, "table", PartitionStatus.COMPLETED)));
    when(coordinator.getPartitions(eq(jobId), eq(PartitionStatus.FAILED))).thenReturn(List.of());
    when(coordinator.getJobWithAggregatedStats(jobId)).thenReturn(failedJob);
    doAnswer(
            invocation -> {
              BulkSink.FailureCallback callback = invocation.getArgument(0);
              if (callback != null) {
                callbackRef.set(callback);
              }
              return null;
            })
        .when(bulkSink)
        .setFailureCallback(any());
    when(bulkSink.flushAndAwait(60)).thenThrow(new IllegalStateException("flush failed"));
    doThrow(new IllegalStateException("clear failed")).when(bulkSink).setFailureCallback(null);
    doThrow(new IllegalStateException("release failed"))
        .when(coordinator)
        .releaseReindexLock(jobId);

    try (MockedConstruction<DistributedJobStatsAggregator> aggregatorConstruction =
            mockConstruction(
                DistributedJobStatsAggregator.class,
                (mock, context) ->
                    doThrow(new IllegalStateException("stats failed")).when(mock).forceUpdate());
        MockedConstruction<IndexingFailureRecorder> failureConstruction =
            mockConstruction(
                IndexingFailureRecorder.class,
                (mock, context) ->
                    doThrow(new IllegalStateException("close failed")).when(mock).close());
        MockedStatic<ReindexingMetrics> metricsMock = mockStatic(ReindexingMetrics.class)) {

      metricsMock.when(ReindexingMetrics::getInstance).thenReturn(metrics);
      when(metrics.startJobTimer()).thenReturn(timerSample);

      DistributedSearchIndexExecutor.ExecutionResult result =
          executor.execute(
              bulkSink,
              recreateContext,
              false,
              ReindexingConfiguration.builder()
                  .entities(Set.of("table"))
                  .consumerThreads(1)
                  .build());

      assertEquals(IndexJobStatus.FAILED, result.status());
      assertEquals(failedJob, executor.getCurrentJob());
      assertNotNull(callbackRef.get());

      IndexingFailureRecorder failureRecorder = failureConstruction.constructed().get(0);
      callbackRef
          .get()
          .onFailure(
              "table",
              "1",
              "table.fqn",
              "process failed",
              IndexingFailureRecorder.FailureStage.PROCESS);
      callbackRef
          .get()
          .onFailure(
              "table", "1", "table.fqn", "sink failed", IndexingFailureRecorder.FailureStage.SINK);

      verify(failureRecorder).recordProcessFailure("table", "1", "table.fqn", "process failed");
      verify(failureRecorder).recordSinkFailure("table", "1", "table.fqn", "sink failed");
      verify(aggregatorConstruction.constructed().get(0)).setProgressListener(any(), any());
      verify(metrics).recordJobFailed(timerSample);
    }
  }

  @Test
  void executeHandlesInterruptedAwaitAndStoppedMetricsCleanup() throws Exception {
    UUID jobId = UUID.randomUUID();
    SearchIndexJob runningJob =
        SearchIndexJob.builder()
            .id(jobId)
            .status(IndexJobStatus.RUNNING)
            .startedAt(100L)
            .totalRecords(8)
            .build();
    SearchIndexJob stoppedJob =
        runningJob
            .withStatus(IndexJobStatus.STOPPED)
            .withSuccessRecords(6)
            .withFailedRecords(2)
            .withCompletedAt(200L);
    BulkSink bulkSink = mock(BulkSink.class);
    DistributedJobNotifier notifier = mock(DistributedJobNotifier.class);
    ReindexingMetrics metrics = mock(ReindexingMetrics.class);
    Timer.Sample timerSample = mock(Timer.Sample.class);

    setField("currentJob", runningJob);
    setField("jobNotifier", notifier);
    when(coordinator.getJob(jobId)).thenReturn(Optional.of(stoppedJob));
    when(coordinator.getJobWithAggregatedStats(jobId)).thenReturn(stoppedJob);
    when(coordinator.claimNextPartition(jobId)).thenReturn(Optional.empty());
    when(coordinator.getPartitions(eq(jobId), any())).thenReturn(List.of());
    when(bulkSink.flushAndAwait(60)).thenReturn(false);
    doThrow(new IllegalStateException("metrics failed"))
        .when(metrics)
        .recordJobStopped(timerSample);
    doThrow(new IllegalStateException("notify failed")).when(notifier).notifyJobCompleted(jobId);

    try (MockedConstruction<DistributedJobStatsAggregator> aggregatorConstruction =
            mockConstruction(DistributedJobStatsAggregator.class);
        MockedConstruction<IndexingFailureRecorder> failureConstruction =
            mockConstruction(IndexingFailureRecorder.class);
        MockedStatic<ReindexingMetrics> metricsMock = mockStatic(ReindexingMetrics.class)) {

      metricsMock.when(ReindexingMetrics::getInstance).thenReturn(metrics);
      when(metrics.startJobTimer()).thenReturn(timerSample);

      Thread.currentThread().interrupt();
      try {
        DistributedSearchIndexExecutor.ExecutionResult result =
            executor.execute(
                bulkSink,
                null,
                false,
                ReindexingConfiguration.builder()
                    .entities(Set.of("table"))
                    .consumerThreads(1)
                    .build());

        assertEquals(IndexJobStatus.STOPPED, result.status());
        assertSame(stoppedJob, executor.getCurrentJob());
      } finally {
        Thread.interrupted();
      }

      verify(aggregatorConstruction.constructed().get(0)).start();
      verify(aggregatorConstruction.constructed().get(0)).forceUpdate();
      verify(aggregatorConstruction.constructed().get(0)).stop();
      verify(failureConstruction.constructed().get(0)).close();
      verify(bulkSink).flushAndAwait(60);
      verify(metrics).recordJobStopped(timerSample);
      verify(notifier).notifyJobCompleted(jobId);
    }
  }

  @Test
  void executeForceCompletesStoppingJobsDuringCleanupAndRecordsStoppedMetrics() throws Exception {
    UUID jobId = UUID.randomUUID();
    SearchIndexJob runningJob =
        SearchIndexJob.builder()
            .id(jobId)
            .status(IndexJobStatus.RUNNING)
            .startedAt(100L)
            .totalRecords(3)
            .build();
    SearchIndexJob stoppingJob = runningJob.withStatus(IndexJobStatus.STOPPING);
    SearchIndexJob stoppedJob =
        runningJob
            .withStatus(IndexJobStatus.STOPPED)
            .withSuccessRecords(2)
            .withFailedRecords(1)
            .withCompletedAt(200L);
    BulkSink bulkSink = mock(BulkSink.class);
    ReindexingMetrics metrics = mock(ReindexingMetrics.class);
    Timer.Sample timerSample = mock(Timer.Sample.class);

    setField("currentJob", runningJob);
    when(coordinator.getJob(jobId))
        .thenReturn(Optional.of(runningJob), Optional.of(stoppingJob), Optional.of(stoppedJob));
    when(coordinator.claimNextPartition(jobId)).thenReturn(Optional.empty());
    when(coordinator.getPartitions(jobId, PartitionStatus.PENDING)).thenReturn(List.of());
    when(coordinator.getPartitions(jobId, PartitionStatus.PROCESSING)).thenReturn(List.of());
    when(coordinator.getPartitions(jobId, PartitionStatus.COMPLETED)).thenReturn(List.of());
    when(coordinator.getPartitions(jobId, PartitionStatus.FAILED)).thenReturn(List.of());
    when(coordinator.getJobWithAggregatedStats(jobId)).thenReturn(stoppedJob);
    when(bulkSink.flushAndAwait(60)).thenReturn(true);
    doThrow(new IllegalStateException("cleanup failed"))
        .when(coordinator)
        .forceCompleteProcessingPartitions(jobId);

    try (MockedConstruction<DistributedJobStatsAggregator> aggregatorConstruction =
            mockConstruction(DistributedJobStatsAggregator.class);
        MockedConstruction<IndexingFailureRecorder> failureConstruction =
            mockConstruction(IndexingFailureRecorder.class);
        MockedStatic<ReindexingMetrics> metricsMock = mockStatic(ReindexingMetrics.class)) {

      metricsMock.when(ReindexingMetrics::getInstance).thenReturn(metrics);
      when(metrics.startJobTimer()).thenReturn(timerSample);

      DistributedSearchIndexExecutor.ExecutionResult result =
          executor.execute(
              bulkSink,
              null,
              false,
              ReindexingConfiguration.builder()
                  .entities(Set.of("table"))
                  .consumerThreads(1)
                  .build());

      assertEquals(IndexJobStatus.STOPPED, result.status());
      assertSame(stoppedJob, executor.getCurrentJob());
      verify(aggregatorConstruction.constructed().get(0)).forceUpdate();
      verify(failureConstruction.constructed().get(0)).close();
      verify(coordinator).forceCompleteProcessingPartitions(jobId);
      verify(metrics).recordJobStopped(timerSample);
    }
  }

  @Test
  void runWorkerLoopAggregatesPartitionResults() throws Exception {
    UUID jobId = UUID.randomUUID();
    SearchIndexJob runningJob =
        SearchIndexJob.builder().id(jobId).status(IndexJobStatus.RUNNING).build();
    SearchIndexJob completedJob = runningJob.withStatus(IndexJobStatus.COMPLETED);
    SearchIndexPartition partition = partition(jobId, "table", PartitionStatus.PENDING);
    BulkSink bulkSink = mock(BulkSink.class);
    AtomicLong totalSuccess = new AtomicLong();
    AtomicLong totalFailed = new AtomicLong();

    setField("currentJob", runningJob);
    when(coordinator.getJob(jobId)).thenReturn(Optional.of(runningJob), Optional.of(completedJob));
    when(coordinator.claimNextPartition(jobId)).thenReturn(Optional.of(partition));

    try (MockedConstruction<PartitionWorker> workerConstruction =
        mockConstruction(
            PartitionWorker.class,
            (mock, context) ->
                when(mock.processPartition(partition))
                    .thenReturn(new PartitionWorker.PartitionResult(5, 2, false, 1, 1)))) {

      invokePrivate(
          "runWorkerLoop",
          new Class<?>[] {
            int.class,
            BulkSink.class,
            int.class,
            ReindexContext.class,
            boolean.class,
            AtomicLong.class,
            AtomicLong.class,
            ReindexingConfiguration.class
          },
          0,
          bulkSink,
          100,
          null,
          false,
          totalSuccess,
          totalFailed,
          ReindexingConfiguration.builder().build());

      assertEquals(5L, totalSuccess.get());
      assertEquals(2L, totalFailed.get());
      assertEquals(5L, ((AtomicLong) getField("coordinatorReaderSuccess")).get());
      assertEquals(1L, ((AtomicLong) getField("coordinatorReaderFailed")).get());
      assertEquals(1L, ((AtomicLong) getField("coordinatorReaderWarnings")).get());
      assertEquals(1, ((AtomicInteger) getField("coordinatorPartitionsCompleted")).get());
      assertTrue(((Set<?>) getField("activePartitions")).isEmpty());
      assertTrue(((List<?>) getField("activeWorkers")).isEmpty());
      verify(workerConstruction.constructed().get(0)).processPartition(partition);
    }
  }

  @Test
  void runWorkerLoopRetriesClaimingAndBreaksOnInterruptedSleep() throws Exception {
    UUID jobId = UUID.randomUUID();
    SearchIndexJob runningJob =
        SearchIndexJob.builder().id(jobId).status(IndexJobStatus.RUNNING).build();
    SearchIndexPartition pendingPartition = partition(jobId, "table", PartitionStatus.PENDING);
    SearchIndexPartition processingPartition =
        partition(jobId, "table", PartitionStatus.PROCESSING);

    setField("currentJob", runningJob);
    when(coordinator.getJob(jobId)).thenReturn(Optional.of(runningJob));
    when(coordinator.claimNextPartition(jobId)).thenReturn(Optional.empty());
    when(coordinator.getPartitions(jobId, PartitionStatus.PENDING))
        .thenReturn(List.of(pendingPartition));
    when(coordinator.getPartitions(jobId, PartitionStatus.PROCESSING))
        .thenReturn(List.of(processingPartition));

    AtomicReference<Throwable> failure = new AtomicReference<>();
    Thread workerThread =
        Thread.ofPlatform()
            .start(
                () -> {
                  try {
                    invokePrivate(
                        "runWorkerLoop",
                        new Class<?>[] {
                          int.class,
                          BulkSink.class,
                          int.class,
                          ReindexContext.class,
                          boolean.class,
                          AtomicLong.class,
                          AtomicLong.class,
                          ReindexingConfiguration.class
                        },
                        2,
                        mock(BulkSink.class),
                        100,
                        null,
                        false,
                        new AtomicLong(),
                        new AtomicLong(),
                        ReindexingConfiguration.builder().build());
                  } catch (Throwable t) {
                    failure.set(t);
                  }
                });

    Thread.sleep(1100);
    workerThread.interrupt();
    workerThread.join(2000);

    assertFalse(workerThread.isAlive());
    assertNull(failure.get());
    assertTrue(((Set<?>) getField("activePartitions")).isEmpty());
    assertTrue(((List<?>) getField("activeWorkers")).isEmpty());
  }

  @Test
  void runWorkerLoopSwallowsPartitionProcessingErrorsAndCleansUpState() throws Exception {
    UUID jobId = UUID.randomUUID();
    SearchIndexJob runningJob =
        SearchIndexJob.builder().id(jobId).status(IndexJobStatus.RUNNING).build();
    SearchIndexJob completedJob = runningJob.withStatus(IndexJobStatus.COMPLETED);
    SearchIndexPartition partition = partition(jobId, "table", PartitionStatus.PENDING);

    setField("currentJob", runningJob);
    when(coordinator.getJob(jobId)).thenReturn(Optional.of(runningJob), Optional.of(completedJob));
    when(coordinator.claimNextPartition(jobId)).thenReturn(Optional.of(partition));

    try (MockedConstruction<PartitionWorker> workerConstruction =
        mockConstruction(
            PartitionWorker.class,
            (mock, context) ->
                when(mock.processPartition(partition))
                    .thenThrow(new IllegalStateException("boom")))) {

      invokePrivate(
          "runWorkerLoop",
          new Class<?>[] {
            int.class,
            BulkSink.class,
            int.class,
            ReindexContext.class,
            boolean.class,
            AtomicLong.class,
            AtomicLong.class,
            ReindexingConfiguration.class
          },
          1,
          mock(BulkSink.class),
          100,
          null,
          false,
          new AtomicLong(),
          new AtomicLong(),
          ReindexingConfiguration.builder().build());

      assertTrue(((Set<?>) getField("activePartitions")).isEmpty());
      assertTrue(((List<?>) getField("activeWorkers")).isEmpty());
      assertEquals(0, ((AtomicInteger) getField("coordinatorPartitionsCompleted")).get());
      verify(workerConstruction.constructed().get(0)).processPartition(partition);
    }
  }

  @Test
  void backgroundLoopsExitCleanlyWhenInterrupted() throws Exception {
    SearchIndexJob runningJob =
        SearchIndexJob.builder().id(UUID.randomUUID()).status(IndexJobStatus.RUNNING).build();
    setField("currentJob", runningJob);

    runLoopUntilInterrupted(
        "runStaleReclaimerLoop", new Class<?>[] {UUID.class}, runningJob.getId());
    runLoopUntilInterrupted("runLockRefreshLoop", new Class<?>[] {UUID.class}, runningJob.getId());
    runLoopUntilInterrupted("runPartitionHeartbeatLoop", new Class<?>[] {});
  }

  @Test
  void markJobAsFailedDueToLostLockUsesZeroCountsWhenStatsMissing() throws Exception {
    UUID jobId = UUID.randomUUID();
    when(partitionDAO.getAggregatedStats(jobId.toString())).thenReturn(null);

    invokePrivate("markJobAsFailedDueToLostLock", new Class<?>[] {UUID.class}, jobId);

    verify(jobDAO)
        .update(
            eq(jobId.toString()),
            eq(IndexJobStatus.FAILED.name()),
            eq(0L),
            eq(0L),
            eq(0L),
            isNull(),
            isNull(),
            anyLong(),
            anyLong(),
            eq("Lost distributed lock - another server may have taken over or lock expired"));
    verify(partitionDAO).cancelPendingPartitions(jobId.toString());
  }

  @Test
  void markJobAsFailedDueToLostLockSwallowsDaoFailures() throws Exception {
    when(collectionDAO.searchIndexJobDAO())
        .thenThrow(new IllegalStateException("job dao unavailable"));

    invokePrivate("markJobAsFailedDueToLostLock", new Class<?>[] {UUID.class}, UUID.randomUUID());
  }

  @Test
  void markJobAsFailedSwallowsDaoFailures() throws Exception {
    when(collectionDAO.searchIndexJobDAO())
        .thenThrow(new IllegalStateException("job dao unavailable"));

    invokePrivate(
        "markJobAsFailed", new Class<?>[] {UUID.class, String.class}, UUID.randomUUID(), "failed");
  }

  @Test
  void executionResultComputesSuccessRateAndDuration() {
    DistributedSearchIndexExecutor.ExecutionResult result =
        new DistributedSearchIndexExecutor.ExecutionResult(
            IndexJobStatus.COMPLETED, 20, 15, 5, 100L, 145L);

    assertEquals(75.0, result.getSuccessRate());
    assertEquals(45L, result.getDurationMs());
  }

  @Test
  void interruptAndJoinHandlesNullAndInterruptedCaller() throws Exception {
    invokePrivate("interruptAndJoin", new Class<?>[] {Thread.class, String.class}, null, "missing");

    Thread worker =
        Thread.ofPlatform()
            .start(
                () -> {
                  try {
                    Thread.sleep(30_000);
                  } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                  }
                });

    Thread.currentThread().interrupt();
    invokePrivate(
        "interruptAndJoin", new Class<?>[] {Thread.class, String.class}, worker, "worker");
    assertTrue(Thread.currentThread().isInterrupted());
    Thread.interrupted();
    worker.join(1_000);
    assertFalse(worker.isAlive());
  }

  @Test
  void interruptAndJoinReturnsAfterTimeoutWhenThreadIgnoresInterrupt() throws Exception {
    AtomicReference<Throwable> workerFailure = new AtomicReference<>();
    AtomicReference<Boolean> keepRunning = new AtomicReference<>(true);
    Thread worker =
        Thread.ofPlatform()
            .start(
                () -> {
                  try {
                    while (Boolean.TRUE.equals(keepRunning.get())) {
                      try {
                        Thread.sleep(30_000);
                      } catch (InterruptedException ignored) {
                        // Keep the thread alive so the join timeout branch executes.
                      }
                    }
                  } catch (Throwable t) {
                    workerFailure.set(t);
                  }
                });

    long start = System.nanoTime();
    invokePrivate(
        "interruptAndJoin", new Class<?>[] {Thread.class, String.class}, worker, "stubborn");
    long elapsedMs = (System.nanoTime() - start) / 1_000_000;

    assertTrue(elapsedMs >= 4_500, "join should wait close to the timeout before returning");
    assertTrue(worker.isAlive());
    assertNull(workerFailure.get());

    keepRunning.set(false);
    worker.interrupt();
    worker.join(1_000);
    assertFalse(worker.isAlive());
  }

  private SearchIndexPartition partition(UUID jobId, String entityType, PartitionStatus status) {
    return SearchIndexPartition.builder()
        .id(UUID.randomUUID())
        .jobId(jobId)
        .entityType(entityType)
        .partitionIndex(0)
        .rangeStart(0)
        .rangeEnd(10)
        .estimatedCount(10)
        .workUnits(10)
        .priority(50)
        .status(status)
        .cursor(0)
        .assignedServer(SERVER_ID)
        .build();
  }

  private Object invokePrivate(String methodName, Class<?>[] parameterTypes, Object... args)
      throws Exception {
    Method method =
        DistributedSearchIndexExecutor.class.getDeclaredMethod(methodName, parameterTypes);
    method.setAccessible(true);
    return method.invoke(executor, args);
  }

  private Object getField(String fieldName) throws Exception {
    Field field = DistributedSearchIndexExecutor.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    return field.get(executor);
  }

  private void setField(String fieldName, Object value) throws Exception {
    Field field = DistributedSearchIndexExecutor.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(executor, value);
  }

  private void runLoopUntilInterrupted(String methodName, Class<?>[] parameterTypes, Object... args)
      throws Exception {
    AtomicReference<Throwable> failure = new AtomicReference<>();
    Thread loopThread =
        Thread.ofPlatform()
            .start(
                () -> {
                  try {
                    invokePrivate(methodName, parameterTypes, args);
                  } catch (Throwable t) {
                    failure.set(t);
                  }
                });

    Thread.sleep(100);
    loopThread.interrupt();
    loopThread.join(2_000);

    assertFalse(loopThread.isAlive());
    assertNull(failure.get());
  }

  @SuppressWarnings("unchecked")
  private void clearCoordinatedJobs() throws Exception {
    Field field = DistributedSearchIndexExecutor.class.getDeclaredField("COORDINATED_JOBS");
    field.setAccessible(true);
    ((Set<UUID>) field.get(null)).clear();
  }
}
