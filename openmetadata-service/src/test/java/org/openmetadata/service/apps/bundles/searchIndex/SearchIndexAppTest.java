package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.service.apps.ApplicationContext;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.DistributedSearchIndexCoordinator;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.ServerIdentityResolver;
import org.openmetadata.service.exception.AppException;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexJobDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexJobDAO.SearchIndexJobRecord;
import org.openmetadata.service.search.SearchRepository;
import org.quartz.JobExecutionContext;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SearchIndexAppTest {

  @Mock private CollectionDAO collectionDAO;
  @Mock private SearchRepository searchRepository;
  @Mock private SearchIndexJobDAO jobDAO;
  @Mock private CollectionDAO.SearchIndexPartitionDAO partitionDAO;
  @Mock private CollectionDAO.SearchIndexServerStatsDAO serverStatsDAO;
  @Mock private CollectionDAO.SearchIndexFailureDAO failureDAO;
  @Mock private CollectionDAO.SearchReindexLockDAO lockDAO;
  @Mock private CollectionDAO.AppExtensionTimeSeries appExtDAO;

  private MockedStatic<ServerIdentityResolver> serverIdentityMock;
  private SearchIndexApp searchIndexApp;

  @BeforeEach
  void setUp() {
    ServerIdentityResolver mockResolver = mock(ServerIdentityResolver.class);
    when(mockResolver.getServerId()).thenReturn("test-server-1");
    serverIdentityMock = mockStatic(ServerIdentityResolver.class);
    serverIdentityMock.when(ServerIdentityResolver::getInstance).thenReturn(mockResolver);

    when(collectionDAO.searchIndexJobDAO()).thenReturn(jobDAO);
    when(collectionDAO.searchIndexPartitionDAO()).thenReturn(partitionDAO);
    when(collectionDAO.searchIndexServerStatsDAO()).thenReturn(serverStatsDAO);
    when(collectionDAO.searchIndexFailureDAO()).thenReturn(failureDAO);
    when(collectionDAO.searchReindexLockDAO()).thenReturn(lockDAO);
    when(collectionDAO.appExtensionTimeSeriesDao()).thenReturn(appExtDAO);

    searchIndexApp = new SearchIndexApp(collectionDAO, searchRepository);
  }

  @AfterEach
  void tearDown() {
    if (serverIdentityMock != null) {
      serverIdentityMock.close();
    }
  }

  @Test
  void executeAndStopDelegateToReindexingOrchestrator() throws Exception {
    App appEntity = mock(App.class);
    when(appEntity.getName()).thenReturn("SearchIndexing");
    setField(searchIndexApp, "app", appEntity);

    EventPublisherJob initialJob = new EventPublisherJob().withEntities(Set.of("table"));
    EventPublisherJob updatedJob = new EventPublisherJob().withEntities(Set.of("table", "user"));
    setField(searchIndexApp, "jobData", initialJob);

    try (MockedConstruction<ReindexingOrchestrator> mocked =
        Mockito.mockConstruction(
            ReindexingOrchestrator.class,
            (orchestrator, context) -> when(orchestrator.getJobData()).thenReturn(updatedJob))) {
      searchIndexApp.execute(mock(JobExecutionContext.class));

      ReindexingOrchestrator orchestrator = mocked.constructed().get(0);
      verify(orchestrator).run(initialJob);
      assertSame(updatedJob, searchIndexApp.getJobData());

      searchIndexApp.stop();

      verify(orchestrator).stop();
      assertSame(updatedJob, searchIndexApp.getJobData());
    }
  }

  @Test
  void stopWithoutOrchestratorIsANoopAndValidationRejectsInvalidConfig() {
    searchIndexApp.stop();

    searchIndexApp.validateConfig(Map.of("entities", Set.of("table"), "batchSize", 100));

    AppException exception =
        assertThrows(
            AppException.class,
            () -> searchIndexApp.validateConfig(Map.of("batchSize", Map.of("bad", true))));
    assertNotNull(exception.getMessage());
  }

  @Test
  void reindexingExceptionConstructorsPreserveMessageAndCause() {
    SearchIndexApp.ReindexingException simple = new SearchIndexApp.ReindexingException("message");
    RuntimeException cause = new RuntimeException("boom");
    SearchIndexApp.ReindexingException wrapped =
        new SearchIndexApp.ReindexingException("wrapped", cause);

    assertEquals("message", simple.getMessage());
    assertEquals("wrapped", wrapped.getMessage());
    assertSame(cause, wrapped.getCause());
  }

  @Test
  void tryStopOutsideQuartzReturnsFalseWhenNoRunningJobs() {
    when(jobDAO.getRunningJobIds()).thenReturn(List.of());

    boolean result = searchIndexApp.tryStopOutsideQuartz();

    assertFalse(result);
  }

  @Test
  void tryStopOutsideQuartzStopsRunningJobsAndUpdatesRecord() throws Exception {
    UUID jobId = UUID.randomUUID();
    when(jobDAO.getRunningJobIds()).thenReturn(List.of(jobId.toString()));

    App appEntity = new App();
    appEntity.setId(UUID.randomUUID());
    appEntity.setName("SearchIndexing");
    setField(searchIndexApp, "app", appEntity);

    AppRunRecord runningRecord = new AppRunRecord().withStatus(AppRunRecord.Status.RUNNING);

    try (MockedConstruction<DistributedSearchIndexCoordinator> coordMock =
            Mockito.mockConstruction(DistributedSearchIndexCoordinator.class);
        MockedConstruction<AppRepository> repoMock =
            Mockito.mockConstruction(
                AppRepository.class,
                (repo, ctx) ->
                    when(repo.getLatestAppRunsOptional(any(App.class)))
                        .thenReturn(Optional.of(runningRecord)))) {

      boolean result = searchIndexApp.tryStopOutsideQuartz();

      assertTrue(result);

      DistributedSearchIndexCoordinator coordinator = coordMock.constructed().get(0);
      verify(coordinator).requestStop(jobId);

      AppRepository repo = repoMock.constructed().get(0);
      verify(repo).getLatestAppRunsOptional(appEntity);
      verify(repo).updateAppStatus(eq(appEntity.getId()), eq(runningRecord));
      assertEquals(AppRunRecord.Status.STOPPED, runningRecord.getStatus());
    }
  }

  @Test
  void tryStopOutsideQuartzHandlesExceptionPerJobGracefully() throws Exception {
    UUID jobId1 = UUID.randomUUID();
    UUID jobId2 = UUID.randomUUID();
    when(jobDAO.getRunningJobIds()).thenReturn(List.of(jobId1.toString(), jobId2.toString()));

    App appEntity = new App();
    appEntity.setId(UUID.randomUUID());
    appEntity.setName("SearchIndexing");
    setField(searchIndexApp, "app", appEntity);

    try (MockedConstruction<DistributedSearchIndexCoordinator> coordMock =
            Mockito.mockConstruction(
                DistributedSearchIndexCoordinator.class,
                (coordinator, ctx) -> {
                  doThrow(new RuntimeException("stop failed"))
                      .when(coordinator)
                      .requestStop(jobId1);
                });
        MockedConstruction<AppRepository> repoMock =
            Mockito.mockConstruction(
                AppRepository.class,
                (repo, ctx) ->
                    when(repo.getLatestAppRunsOptional(any(App.class)))
                        .thenReturn(Optional.empty()))) {

      boolean result = searchIndexApp.tryStopOutsideQuartz();

      assertTrue(result);
      DistributedSearchIndexCoordinator coordinator = coordMock.constructed().get(0);
      verify(coordinator).requestStop(jobId1);
      verify(coordinator).requestStop(jobId2);
    }
  }

  @Test
  void updateRunRecordToStoppedSkipsWhenAppIsNull() throws Exception {
    setField(searchIndexApp, "app", null);
    when(jobDAO.getRunningJobIds()).thenReturn(List.of(UUID.randomUUID().toString()));

    try (MockedConstruction<DistributedSearchIndexCoordinator> ignored =
            Mockito.mockConstruction(DistributedSearchIndexCoordinator.class);
        MockedConstruction<AppRepository> repoMock =
            Mockito.mockConstruction(AppRepository.class)) {

      searchIndexApp.tryStopOutsideQuartz();

      assertTrue(repoMock.constructed().isEmpty());
    }
  }

  @Test
  void updateRunRecordToStoppedSkipsWhenRecordNotRunning() throws Exception {
    App appEntity = new App();
    appEntity.setId(UUID.randomUUID());
    appEntity.setName("SearchIndexing");
    setField(searchIndexApp, "app", appEntity);

    AppRunRecord completedRecord = new AppRunRecord().withStatus(AppRunRecord.Status.SUCCESS);

    when(jobDAO.getRunningJobIds()).thenReturn(List.of(UUID.randomUUID().toString()));

    try (MockedConstruction<DistributedSearchIndexCoordinator> ignored =
            Mockito.mockConstruction(DistributedSearchIndexCoordinator.class);
        MockedConstruction<AppRepository> repoMock =
            Mockito.mockConstruction(
                AppRepository.class,
                (repo, ctx) ->
                    when(repo.getLatestAppRunsOptional(any(App.class)))
                        .thenReturn(Optional.of(completedRecord)))) {

      searchIndexApp.tryStopOutsideQuartz();

      AppRepository repo = repoMock.constructed().get(0);
      verify(repo).getLatestAppRunsOptional(appEntity);
      verify(repo, never()).updateAppStatus(any(), any());
    }
  }

  @Test
  void purgeSearchIndexTablesForceStopsActiveJobs() throws Exception {
    UUID jobId = UUID.randomUUID();
    SearchIndexJobRecord activeJob =
        new SearchIndexJobRecord(
            jobId.toString(),
            "RUNNING",
            "{}",
            "staged_",
            null,
            1000,
            500,
            400,
            100,
            "{}",
            "admin",
            System.currentTimeMillis(),
            System.currentTimeMillis(),
            null,
            System.currentTimeMillis(),
            null,
            System.currentTimeMillis(),
            1);
    when(jobDAO.findByStatuses(List.of("RUNNING", "READY", "INITIALIZING")))
        .thenReturn(List.of(activeJob));

    App appEntity = new App();
    appEntity.setId(UUID.randomUUID());
    appEntity.setName("SearchIndexing");
    setField(searchIndexApp, "app", appEntity);

    try (MockedConstruction<ApplicationContext> ctxMock =
        Mockito.mockConstruction(ApplicationContext.class)) {
      try (MockedStatic<ApplicationContext> appCtxStatic = mockStatic(ApplicationContext.class)) {
        ApplicationContext mockAppCtx = mock(ApplicationContext.class);
        appCtxStatic.when(ApplicationContext::getInstance).thenReturn(mockAppCtx);

        searchIndexApp.uninstall();
      }
    }

    verify(jobDAO)
        .update(
            eq(jobId.toString()),
            eq("STOPPED"),
            eq(500L),
            eq(400L),
            eq(100L),
            eq("{}"),
            anyLong(),
            anyLong(),
            anyLong(),
            eq("Job force-stopped by uninstall"));
    verify(partitionDAO).deleteAll();
    verify(serverStatsDAO).deleteAll();
    verify(failureDAO).deleteAll();
    verify(lockDAO).delete("SEARCH_REINDEX_LOCK");
    verify(jobDAO).deleteAll();
    verify(appExtDAO).deleteAllByAppId(appEntity.getId().toString());
  }

  @Test
  void purgeSearchIndexTablesSkipsAppExtensionDeleteWhenAppIsNull() throws Exception {
    when(jobDAO.findByStatuses(any())).thenReturn(List.of());
    setField(searchIndexApp, "app", null);

    try (MockedStatic<ApplicationContext> appCtxStatic = mockStatic(ApplicationContext.class)) {
      ApplicationContext mockAppCtx = mock(ApplicationContext.class);
      appCtxStatic.when(ApplicationContext::getInstance).thenReturn(mockAppCtx);

      searchIndexApp.uninstall();
    }

    verify(partitionDAO).deleteAll();
    verify(serverStatsDAO).deleteAll();
    verify(failureDAO).deleteAll();
    verify(lockDAO).delete("SEARCH_REINDEX_LOCK");
    verify(jobDAO).deleteAll();
    verify(appExtDAO, never()).deleteAllByAppId(anyString());
  }

  @Test
  void purgeSearchIndexTablesHandlesForceStopException() throws Exception {
    UUID jobId = UUID.randomUUID();
    SearchIndexJobRecord activeJob =
        new SearchIndexJobRecord(
            jobId.toString(),
            "RUNNING",
            "{}",
            "staged_",
            null,
            1000,
            500,
            400,
            100,
            "{}",
            "admin",
            System.currentTimeMillis(),
            System.currentTimeMillis(),
            null,
            System.currentTimeMillis(),
            null,
            System.currentTimeMillis(),
            1);
    when(jobDAO.findByStatuses(List.of("RUNNING", "READY", "INITIALIZING")))
        .thenReturn(List.of(activeJob));
    doThrow(new RuntimeException("DB error"))
        .when(jobDAO)
        .update(
            anyString(),
            anyString(),
            anyLong(),
            anyLong(),
            anyLong(),
            anyString(),
            anyLong(),
            anyLong(),
            anyLong(),
            anyString());

    setField(searchIndexApp, "app", null);

    try (MockedStatic<ApplicationContext> appCtxStatic = mockStatic(ApplicationContext.class)) {
      ApplicationContext mockAppCtx = mock(ApplicationContext.class);
      appCtxStatic.when(ApplicationContext::getInstance).thenReturn(mockAppCtx);

      searchIndexApp.uninstall();
    }

    verify(partitionDAO).deleteAll();
    verify(serverStatsDAO).deleteAll();
  }

  @Test
  void uninstallCallsStopThenPurgeThenSuperUninstall() throws Exception {
    when(jobDAO.findByStatuses(any())).thenReturn(List.of());

    App appEntity = new App();
    appEntity.setId(UUID.randomUUID());
    appEntity.setName("SearchIndexing");
    setField(searchIndexApp, "app", appEntity);

    try (MockedStatic<ApplicationContext> appCtxStatic = mockStatic(ApplicationContext.class)) {
      ApplicationContext mockAppCtx = mock(ApplicationContext.class);
      appCtxStatic.when(ApplicationContext::getInstance).thenReturn(mockAppCtx);

      searchIndexApp.uninstall();

      verify(mockAppCtx).unregisterApp(searchIndexApp);
    }

    verify(partitionDAO).deleteAll();
    verify(jobDAO).deleteAll();
  }

  private void setField(Object target, String name, Object value) throws Exception {
    Field field = findField(target.getClass(), name);
    field.setAccessible(true);
    field.set(target, value);
  }

  private Field findField(Class<?> type, String name) throws NoSuchFieldException {
    Class<?> current = type;
    while (current != null) {
      try {
        return current.getDeclaredField(name);
      } catch (NoSuchFieldException ignored) {
        current = current.getSuperclass();
      }
    }
    throw new NoSuchFieldException(name);
  }
}
