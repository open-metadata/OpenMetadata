/*
 *  Copyright 2026 Collate
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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.function.Predicate;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.app.CreateAppMarketPlaceDefinitionReq;
import org.openmetadata.schema.entity.app.NativeAppPermission;
import org.openmetadata.schema.entity.app.ScheduleType;
import org.openmetadata.schema.entity.app.ScheduledExecutionContext;
import org.openmetadata.sdk.exceptions.ConflictException;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.apps.scheduler.AppAlreadyRunningException;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.exception.CatalogGenericExceptionMapper;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.apps.TestApp;
import org.openmetadata.service.search.SearchRepository;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;
import org.quartz.JobKey;
import org.quartz.JobListener;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.impl.matchers.KeyMatcher;
import org.slf4j.LoggerFactory;

/**
 * Triggering an app that is already running is a 409, and a trigger sent right after a run reports
 * completion is accepted rather than refused while Quartz releases the finished job.
 *
 * <p>Each test installs its own app and holds its run at one point, inside the run itself or inside
 * a Quartz listener on the embedded server, so the timing is deterministic.
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class AppTriggerConflictIT {
  private static final Duration HOLD_LIMIT = Duration.ofSeconds(60);
  private static final Duration RUN_TIMEOUT = Duration.ofSeconds(30);
  private static final String WAITING_FOR_FINISHING_RUN = "Waiting for the finishing run of";

  @BeforeAll
  static void setup() {
    assumeFalse(
        OssTestServer.isExternalMode(),
        "Holds runs through a listener on the embedded server's Quartz scheduler");
    assumeFalse(
        TestSuiteBootstrap.isK8sEnabled(), "App trigger not compatible with K8s pipeline backend");
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void triggeringAnAppWhoseRunIsExecutingIsAConflict(TestNamespace ns) throws Exception {
    String appName = installManualApp(ns.prefix("executingApp"), HeldExecutionApp.class);
    HeldExecutionApp.holdNextRun(appName);
    try {
      Apps.trigger(appName).run();
      HeldExecutionApp.awaitStarted(appName);

      assertTriggerIsAConflictWithoutAnErrorLog(appName);
    } finally {
      HeldExecutionApp.release(appName);
      awaitReleased(appName);
      Apps.uninstall(appName, true);
    }
  }

  /** The run is accepted but not executing yet, so only the stored job reveals it. */
  @Test
  void triggeringAnAppWhoseRunIsStartingIsAConflict(TestNamespace ns) throws Exception {
    String appName = installManualApp(ns.prefix("startingApp"), TestApp.class);
    HeldRun hold = HeldRun.beforeExecution(appName);
    try {
      Apps.trigger(appName).run();
      hold.awaitEntered();

      assertTriggerIsAConflictWithoutAnErrorLog(appName);
    } finally {
      hold.releaseAndRemove();
      awaitReleased(appName);
      Apps.uninstall(appName, true);
    }
  }

  @Test
  void aTriggerRightAfterTheRunReportsCompletionIsAccepted(TestNamespace ns) throws Exception {
    String appName = installManualApp(ns.prefix("finishingApp"), TestApp.class);
    HeldRun hold = HeldRun.afterExecution(appName);
    ListAppender<ILoggingEvent> schedulerLog = capture(AppScheduler.class.getPackageName());
    try {
      Apps.trigger(appName).run();
      hold.awaitEntered();
      AppRunRecord firstRun = latestRun(appName);
      assertEquals(AppRunRecord.Status.SUCCESS, firstRun.getStatus());

      CompletableFuture<Void> retrigger =
          CompletableFuture.runAsync(() -> Apps.trigger(appName).run());
      Awaitility.await("the retrigger answers or waits for the finishing run")
          .atMost(RUN_TIMEOUT)
          .until(() -> retrigger.isDone() || hasWaited(schedulerLog, appName));
      assertFalse(retrigger.isDone(), "the trigger must wait for the finishing run, not fail");

      hold.releaseAndRemove();
      assertDoesNotThrow(() -> retrigger.get(RUN_TIMEOUT.toSeconds(), TimeUnit.SECONDS));
      Awaitility.await("the second run finishes")
          .atMost(RUN_TIMEOUT)
          .ignoreExceptions()
          .until(() -> isLaterFinishedRun(latestRun(appName), firstRun));
    } finally {
      release(schedulerLog, AppScheduler.class.getPackageName());
      hold.releaseAndRemove();
      awaitReleased(appName);
      Apps.uninstall(appName, true);
    }
  }

  private static void assertTriggerIsAConflictWithoutAnErrorLog(String appName) {
    ListAppender<ILoggingEvent> mapperLog = capture(CatalogGenericExceptionMapper.class);
    try {
      ConflictException conflict =
          assertThrows(ConflictException.class, () -> Apps.trigger(appName).run());

      assertEquals(409, conflict.getStatusCode());
      assertEquals(new AppAlreadyRunningException(appName).getMessage(), conflict.getMessage());
      assertFalse(
          anyEvent(mapperLog, event -> event.getLevel() == Level.ERROR),
          "a busy app must not be logged as a server error");
    } finally {
      release(mapperLog, CatalogGenericExceptionMapper.class);
    }
  }

  private static String installManualApp(String appName, Class<?> appClass) {
    CreateAppMarketPlaceDefinitionReq marketPlace =
        new CreateAppMarketPlaceDefinitionReq()
            .withName(appName)
            .withDisplayName("Trigger Conflict Test App")
            .withDescription("An app whose runs a test holds open")
            .withFeatures("test features")
            .withDeveloper("Test Developer")
            .withDeveloperUrl("https://www.example.com")
            .withPrivacyPolicyUrl("https://www.example.com/privacy")
            .withSupportEmail("support@example.com")
            .withClassName(appClass.getName())
            .withAppType(AppType.Internal)
            .withScheduleType(ScheduleType.OnlyManual)
            .withRuntime(new ScheduledExecutionContext().withEnabled(true))
            .withAppConfiguration(new HashMap<>())
            .withPermission(NativeAppPermission.All);
    httpClient()
        .execute(
            HttpMethod.PUT, "/v1/apps/marketplace", marketPlace, AppMarketPlaceDefinition.class);
    Apps.install().name(appName).execute();
    return appName;
  }

  private static AppRunRecord latestRun(String appName) {
    return httpClient()
        .execute(
            HttpMethod.GET, "/v1/apps/name/" + appName + "/runs/latest", null, AppRunRecord.class);
  }

  private static boolean isLaterFinishedRun(AppRunRecord run, AppRunRecord previous) {
    return run.getTimestamp() > previous.getTimestamp()
        && run.getStatus() == AppRunRecord.Status.SUCCESS;
  }

  /** Quartz deletes a finished on-demand job last, so its absence means the run is released. */
  private static void awaitReleased(String appName) {
    JobKey onDemandJob = onDemandJob(appName);
    Awaitility.await("Quartz releases the runs of " + appName)
        .atMost(RUN_TIMEOUT)
        .until(() -> !scheduler().checkExists(onDemandJob));
  }

  private static boolean hasWaited(ListAppender<ILoggingEvent> log, String appName) {
    return anyEvent(
        log,
        event ->
            event.getFormattedMessage().contains(WAITING_FOR_FINISHING_RUN)
                && event.getFormattedMessage().contains(appName));
  }

  /** The server thread appends under the appender's lock, so read the list under it too. */
  private static boolean anyEvent(
      ListAppender<ILoggingEvent> log, Predicate<ILoggingEvent> matches) {
    synchronized (log) {
      return log.list.stream().anyMatch(matches);
    }
  }

  private static ListAppender<ILoggingEvent> capture(Class<?> source) {
    return capture(source.getName());
  }

  private static ListAppender<ILoggingEvent> capture(String loggerName) {
    ListAppender<ILoggingEvent> appender = new ListAppender<>();
    appender.start();
    Logger logger = (Logger) LoggerFactory.getLogger(loggerName);
    logger.setLevel(Level.INFO);
    logger.addAppender(appender);
    return appender;
  }

  private static void release(ListAppender<ILoggingEvent> appender, Class<?> source) {
    release(appender, source.getName());
  }

  private static void release(ListAppender<ILoggingEvent> appender, String loggerName) {
    Logger logger = (Logger) LoggerFactory.getLogger(loggerName);
    logger.detachAppender(appender);
    logger.setLevel(null);
    appender.stop();
  }

  private static JobKey onDemandJob(String appName) {
    return new JobKey(appName + "-" + AppScheduler.ON_DEMAND_JOB, AppScheduler.APPS_JOB_GROUP);
  }

  private static Scheduler scheduler() {
    return AppScheduler.getInstance().getScheduler();
  }

  private static HttpClient httpClient() {
    return SdkClients.adminClient().getHttpClient();
  }

  /**
   * Holds the first run of an app inside a Quartz listener callback until the test releases it.
   * Quartz calls registered listeners before its own, so this one runs after {@code
   * OmAppJobListener} has recorded the run. Before execution, the run is not yet in Quartz's
   * executing list; after execution, it still is. It never throws: a listener that throws leaves
   * the job executing forever.
   */
  private static final class HeldRun implements JobListener {
    private final String name;
    private final boolean afterExecution;
    private final CountDownLatch entered = new CountDownLatch(1);
    private final CountDownLatch released = new CountDownLatch(1);

    private HeldRun(String appName, boolean afterExecution) {
      this.name = "it-held-run-" + appName;
      this.afterExecution = afterExecution;
    }

    static HeldRun beforeExecution(String appName) throws SchedulerException {
      return register(new HeldRun(appName, false), appName);
    }

    static HeldRun afterExecution(String appName) throws SchedulerException {
      return register(new HeldRun(appName, true), appName);
    }

    private static HeldRun register(HeldRun hold, String appName) throws SchedulerException {
      scheduler()
          .getListenerManager()
          .addJobListener(hold, KeyMatcher.keyEquals(onDemandJob(appName)));
      return hold;
    }

    void awaitEntered() throws InterruptedException {
      assertTrue(entered.await(RUN_TIMEOUT.toSeconds(), TimeUnit.SECONDS), "the run never started");
    }

    void releaseAndRemove() throws SchedulerException {
      released.countDown();
      scheduler().getListenerManager().removeJobListener(name);
    }

    @Override
    public String getName() {
      return name;
    }

    @Override
    public void jobToBeExecuted(JobExecutionContext context) {
      if (!afterExecution) {
        hold();
      }
    }

    @Override
    public void jobExecutionVetoed(JobExecutionContext context) {}

    @Override
    public void jobWasExecuted(JobExecutionContext context, JobExecutionException jobException) {
      if (afterExecution) {
        hold();
      }
    }

    private void hold() {
      entered.countDown();
      awaitQuietly(released);
    }
  }

  /** An app whose run waits inside its execution until the test releases it. */
  public static final class HeldExecutionApp extends AbstractNativeApplication {
    private static final Map<String, CountDownLatch> STARTED = new ConcurrentHashMap<>();
    private static final Map<String, CountDownLatch> RELEASED = new ConcurrentHashMap<>();

    public HeldExecutionApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
      super(collectionDAO, searchRepository);
    }

    static void holdNextRun(String appName) {
      STARTED.put(appName, new CountDownLatch(1));
      RELEASED.put(appName, new CountDownLatch(1));
    }

    static void awaitStarted(String appName) throws InterruptedException {
      assertTrue(
          STARTED.get(appName).await(RUN_TIMEOUT.toSeconds(), TimeUnit.SECONDS),
          "the run never started");
    }

    static void release(String appName) {
      RELEASED.get(appName).countDown();
    }

    @Override
    public void startApp(JobExecutionContext jobExecutionContext) {
      CountDownLatch started = STARTED.get(getApp().getName());
      if (started != null) {
        started.countDown();
        awaitQuietly(RELEASED.get(getApp().getName()));
      }
    }
  }

  private static void awaitQuietly(CountDownLatch latch) {
    try {
      latch.await(HOLD_LIMIT.toSeconds(), TimeUnit.SECONDS);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }
}
