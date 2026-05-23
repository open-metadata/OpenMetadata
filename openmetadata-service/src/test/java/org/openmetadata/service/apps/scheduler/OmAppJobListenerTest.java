package org.openmetadata.service.apps.scheduler;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.apps.ApplicationHandler;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.ServerIdentityResolver;
import org.openmetadata.service.apps.logging.AppRunLogAppender;
import org.openmetadata.service.jdbi3.AppRepository;
import org.quartz.JobDataMap;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;
import org.slf4j.MDC;
import sun.misc.Unsafe;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OmAppJobListenerTest {

  @Mock private AppRepository repository;
  @Mock private JobExecutionContext jobExecutionContext;
  @Mock private JobDetail jobDetail;
  @Mock private ApplicationHandler applicationHandler;
  @Mock private ServerIdentityResolver serverIdentityResolver;

  private OmAppJobListener listener;

  @BeforeEach
  void setUp() throws Exception {
    Field unsafeField = Unsafe.class.getDeclaredField("theUnsafe");
    unsafeField.setAccessible(true);
    Unsafe unsafe = (Unsafe) unsafeField.get(null);
    listener = (OmAppJobListener) unsafe.allocateInstance(OmAppJobListener.class);

    Field repoField = OmAppJobListener.class.getDeclaredField("repository");
    repoField.setAccessible(true);
    repoField.set(listener, repository);
  }

  @Test
  void getThreadPrefixesForApp_returnsThreadPrefixesForSearchIndexApp() throws Exception {
    Method method =
        OmAppJobListener.class.getDeclaredMethod("getThreadPrefixesForApp", String.class);
    method.setAccessible(true);

    String[] result = (String[]) method.invoke(null, "SearchIndexingApplication");
    assertArrayEquals(new String[] {"reindex-", "om-field-fetch-", "search-index-retry-"}, result);
  }

  @Test
  void getThreadPrefixesForApp_returnsPrefixesForCaseInsensitiveSearchIndex() throws Exception {
    Method method =
        OmAppJobListener.class.getDeclaredMethod("getThreadPrefixesForApp", String.class);
    method.setAccessible(true);

    String[] result = (String[]) method.invoke(null, "mysearchindexapp");
    assertArrayEquals(new String[] {"reindex-", "om-field-fetch-", "search-index-retry-"}, result);
  }

  @Test
  void getThreadPrefixesForApp_returnsEmptyForNonSearchIndexApp() throws Exception {
    Method method =
        OmAppJobListener.class.getDeclaredMethod("getThreadPrefixesForApp", String.class);
    method.setAccessible(true);

    String[] result = (String[]) method.invoke(null, "DataInsightsApplication");
    assertArrayEquals(new String[0], result);
  }

  @Test
  void getThreadPrefixesForApp_returnsEmptyForNull() throws Exception {
    Method method =
        OmAppJobListener.class.getDeclaredMethod("getThreadPrefixesForApp", String.class);
    method.setAccessible(true);

    String[] result = (String[]) method.invoke(null, (String) null);
    assertArrayEquals(new String[0], result);
  }

  @Test
  void cleanupLogCapture_stopsAppenderAndClearsMDC() throws Exception {
    JobDataMap dataMap = new JobDataMap();
    dataMap.put("appRunLogId", "12345");
    dataMap.put("appName", "TestApp");
    when(jobExecutionContext.getJobDetail()).thenReturn(jobDetail);
    when(jobDetail.getJobDataMap()).thenReturn(dataMap);

    MDC.put(AppRunLogAppender.MDC_APP_RUN_ID, "12345");
    MDC.put(AppRunLogAppender.MDC_APP_NAME, "TestApp");
    MDC.put(AppRunLogAppender.MDC_SERVER_ID, "server1");
    MDC.put(AppRunLogAppender.MDC_APP_ID, UUID.randomUUID().toString());

    try (MockedStatic<AppRunLogAppender> appenderMock = mockStatic(AppRunLogAppender.class)) {
      Method method =
          OmAppJobListener.class.getDeclaredMethod("cleanupLogCapture", JobExecutionContext.class);
      method.setAccessible(true);
      method.invoke(null, jobExecutionContext);

      appenderMock.verify(() -> AppRunLogAppender.stopCapture("TestApp", "12345"));
    }

    assertNull(MDC.get(AppRunLogAppender.MDC_APP_RUN_ID));
    assertNull(MDC.get(AppRunLogAppender.MDC_APP_NAME));
    assertNull(MDC.get(AppRunLogAppender.MDC_SERVER_ID));
    assertNull(MDC.get(AppRunLogAppender.MDC_APP_ID));
  }

  @Test
  void cleanupLogCapture_skipsStopCaptureWhenNoRunId() throws Exception {
    JobDataMap dataMap = new JobDataMap();
    when(jobExecutionContext.getJobDetail()).thenReturn(jobDetail);
    when(jobDetail.getJobDataMap()).thenReturn(dataMap);

    try (MockedStatic<AppRunLogAppender> appenderMock = mockStatic(AppRunLogAppender.class)) {
      Method method =
          OmAppJobListener.class.getDeclaredMethod("cleanupLogCapture", JobExecutionContext.class);
      method.setAccessible(true);
      method.invoke(null, jobExecutionContext);

      appenderMock.verify(() -> AppRunLogAppender.stopCapture(anyString(), anyString()), never());
    }
  }

  @Test
  void cleanupLogCapture_handlesExceptionGracefully() throws Exception {
    JobDataMap dataMap = new JobDataMap();
    dataMap.put("appRunLogId", "12345");
    dataMap.put("appName", "TestApp");
    when(jobExecutionContext.getJobDetail()).thenReturn(jobDetail);
    when(jobDetail.getJobDataMap()).thenReturn(dataMap);

    try (MockedStatic<AppRunLogAppender> appenderMock = mockStatic(AppRunLogAppender.class)) {
      appenderMock
          .when(() -> AppRunLogAppender.stopCapture("TestApp", "12345"))
          .thenThrow(new RuntimeException("stop failed"));

      Method method =
          OmAppJobListener.class.getDeclaredMethod("cleanupLogCapture", JobExecutionContext.class);
      method.setAccessible(true);
      assertDoesNotThrow(() -> method.invoke(null, jobExecutionContext));
    }
  }

  @Test
  void jobToBeExecuted_setsMdcAndStartsLogCapture() {
    UUID appId = UUID.randomUUID();
    App jobApp = new App().withId(appId).withName("SearchIndexingApplication");

    JobDataMap dataMap = new JobDataMap();
    dataMap.put("triggerType", "OnDemandJob");
    dataMap.put(AppScheduler.APP_NAME, "SearchIndexingApplication");

    JobDataMap mergedMap = new JobDataMap();
    Map<String, Object> wrappedMap = new HashMap<>();
    mergedMap.putAll(wrappedMap);

    when(jobExecutionContext.getJobDetail()).thenReturn(jobDetail);
    when(jobDetail.getJobDataMap()).thenReturn(dataMap);
    when(jobExecutionContext.getMergedJobDataMap()).thenReturn(mergedMap);
    when(jobExecutionContext.isRecovering()).thenReturn(false);
    when(repository.getByName(
            any(), eq("SearchIndexingApplication"), any(), eq(Include.NON_DELETED), eq(true)))
        .thenReturn(jobApp);

    try (MockedStatic<ServerIdentityResolver> sirMock = mockStatic(ServerIdentityResolver.class);
        MockedStatic<AppRunLogAppender> appenderMock = mockStatic(AppRunLogAppender.class);
        MockedStatic<ApplicationHandler> ahMock = mockStatic(ApplicationHandler.class)) {

      sirMock.when(ServerIdentityResolver::getInstance).thenReturn(serverIdentityResolver);
      when(serverIdentityResolver.getServerId()).thenReturn("test-server-1");
      ahMock.when(ApplicationHandler::getInstance).thenReturn(applicationHandler);

      listener.jobToBeExecuted(jobExecutionContext);

      appenderMock.verify(
          () ->
              AppRunLogAppender.startCapture(
                  anyString(),
                  eq(appId.toString()),
                  eq("SearchIndexingApplication"),
                  eq("test-server-1"),
                  eq(new String[] {"reindex-", "om-field-fetch-", "search-index-retry-"})));
    }
  }

  @Test
  void jobToBeExecuted_callsCleanupOnException() {
    JobDataMap dataMap = new JobDataMap();
    dataMap.put("triggerType", "OnDemandJob");
    dataMap.put(AppScheduler.APP_NAME, "NonExistentApp");

    when(jobExecutionContext.getJobDetail()).thenReturn(jobDetail);
    when(jobDetail.getJobDataMap()).thenReturn(dataMap);
    when(repository.getByName(
            any(), eq("NonExistentApp"), any(), eq(Include.NON_DELETED), eq(true)))
        .thenThrow(new RuntimeException("App not found"));

    try (MockedStatic<AppRunLogAppender> appenderMock = mockStatic(AppRunLogAppender.class)) {
      assertDoesNotThrow(() -> listener.jobToBeExecuted(jobExecutionContext));
    }
  }

  @Test
  void jobWasExecuted_setsSuccessStatusWhenNoException() {
    UUID appId = UUID.randomUUID();
    long startTime = System.currentTimeMillis() - 5000;
    AppRunRecord runRecord =
        new AppRunRecord()
            .withAppId(appId)
            .withAppName("TestApp")
            .withStartTime(startTime)
            .withTimestamp(startTime)
            .withStatus(AppRunRecord.Status.RUNNING);

    Stats jobStats = new Stats();

    JobDataMap dataMap = new JobDataMap();
    dataMap.put("AppScheduleRun", JsonUtils.pojoToJson(runRecord));
    dataMap.put("AppRunStats", JsonUtils.getMap(jobStats));
    dataMap.put(OmAppJobListener.APP_ID, appId);

    when(jobExecutionContext.getJobDetail()).thenReturn(jobDetail);
    when(jobDetail.getJobDataMap()).thenReturn(dataMap);

    try (MockedStatic<AppRunLogAppender> appenderMock = mockStatic(AppRunLogAppender.class)) {
      listener.jobWasExecuted(jobExecutionContext, null);
    }

    AppRunRecord updatedRecord =
        JsonUtils.readOrConvertValue(dataMap.get("AppScheduleRun"), AppRunRecord.class);
    assert updatedRecord.getStatus() == AppRunRecord.Status.SUCCESS;
    assert updatedRecord.getEndTime() != null;
  }

  @Test
  void jobWasExecuted_setsFailedStatusOnException() {
    UUID appId = UUID.randomUUID();
    long startTime = System.currentTimeMillis() - 5000;
    AppRunRecord runRecord =
        new AppRunRecord()
            .withAppId(appId)
            .withAppName("TestApp")
            .withStartTime(startTime)
            .withTimestamp(startTime)
            .withStatus(AppRunRecord.Status.RUNNING);

    JobDataMap dataMap = new JobDataMap();
    dataMap.put("AppScheduleRun", JsonUtils.pojoToJson(runRecord));
    dataMap.put(OmAppJobListener.APP_ID, appId);

    when(jobExecutionContext.getJobDetail()).thenReturn(jobDetail);
    when(jobDetail.getJobDataMap()).thenReturn(dataMap);

    JobExecutionException jobException = new JobExecutionException("Something went wrong");

    try (MockedStatic<AppRunLogAppender> appenderMock = mockStatic(AppRunLogAppender.class)) {
      listener.jobWasExecuted(jobExecutionContext, jobException);
    }

    AppRunRecord updatedRecord =
        JsonUtils.readOrConvertValue(dataMap.get("AppScheduleRun"), AppRunRecord.class);
    assert updatedRecord.getStatus() == AppRunRecord.Status.FAILED;
    assert updatedRecord.getFailureContext() != null;
  }

  @Test
  void jobWasExecuted_setsStoppedStatusWhenAlreadyStopped() {
    UUID appId = UUID.randomUUID();
    long startTime = System.currentTimeMillis() - 5000;
    AppRunRecord runRecord =
        new AppRunRecord()
            .withAppId(appId)
            .withAppName("TestApp")
            .withStartTime(startTime)
            .withTimestamp(startTime)
            .withStatus(AppRunRecord.Status.STOPPED);

    Stats jobStats = new Stats();

    JobDataMap dataMap = new JobDataMap();
    dataMap.put("AppScheduleRun", JsonUtils.pojoToJson(runRecord));
    dataMap.put("AppRunStats", JsonUtils.getMap(jobStats));
    dataMap.put(OmAppJobListener.APP_ID, appId);

    when(jobExecutionContext.getJobDetail()).thenReturn(jobDetail);
    when(jobDetail.getJobDataMap()).thenReturn(dataMap);

    try (MockedStatic<AppRunLogAppender> appenderMock = mockStatic(AppRunLogAppender.class)) {
      listener.jobWasExecuted(jobExecutionContext, null);
    }

    AppRunRecord updatedRecord =
        JsonUtils.readOrConvertValue(dataMap.get("AppScheduleRun"), AppRunRecord.class);
    assert updatedRecord.getStatus() == AppRunRecord.Status.STOPPED;
  }

  @Test
  void jobExecutionVetoed_callsCleanup() {
    JobDataMap dataMap = new JobDataMap();
    when(jobExecutionContext.getJobDetail()).thenReturn(jobDetail);
    when(jobDetail.getJobDataMap()).thenReturn(dataMap);

    try (MockedStatic<AppRunLogAppender> appenderMock = mockStatic(AppRunLogAppender.class)) {
      assertDoesNotThrow(() -> listener.jobExecutionVetoed(jobExecutionContext));
    }
  }
}
